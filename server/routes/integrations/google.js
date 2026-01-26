const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../../lib/supabaseClient');
const { logGoogleEvent } = require('../../utils/logger');
const axios = require('axios'); // Optimizing: Move to top
const jwt = require('jsonwebtoken'); // Optimizing: Move to top

// Simple in-memory cache for Service Account Tokens to prevent redundant exchanges
// Key: client_email, Value: { token: string, expiresAt: number }
const serviceAccountCache = new Map();

// Helper to get Google Creds (Prefer Body > Env)
const getGoogleCreds = (reqBody) => {
    return {
        clientId: reqBody.clientId || process.env.GOOGLE_CLIENT_ID,
        clientSecret: reqBody.clientSecret || process.env.GOOGLE_CLIENT_SECRET,
        // If redirectUrl is not passed, and we are using env creds, use env redirect.
        // If user passed creds, they MUST pass redirectUrl.
        redirectUrl: reqBody.redirectUrl || process.env.GOOGLE_REDIRECT_URL
    };
};

// 1. Generate Auth URL
router.post('/auth-url', (req, res) => {
    try {
        // We use POST so we can accept clientId/Secret in body safely if needed
        const { clientId, redirectUrl } = req.body;

        // Allow passing overrides, otherwise use env
        const effectiveClientId = (clientId || process.env.GOOGLE_CLIENT_ID || '').trim();
        const effectiveRedirectUrl = (redirectUrl || process.env.GOOGLE_REDIRECT_URL || '').trim();

        if (!effectiveClientId || !effectiveRedirectUrl) {
            return res.status(400).json({ error: 'Missing Client ID or Redirect URL configuration' });
        }

        const { google } = require('googleapis');
        const oauth2Client = new google.auth.OAuth2(
            effectiveClientId,
            null, // Secret not needed for URL generation
            effectiveRedirectUrl
        );

        const scopes = [
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile'
        ];

        const url = oauth2Client.generateAuthUrl({
            access_type: 'offline', // Essential for refresh_token
            scope: scopes,
            prompt: 'consent' // Force refresh token generation
        });

        res.json({ url });
    } catch (error) {
        console.error('Google Auth URL Error:', error);
        res.status(500).json({ error: 'Failed to generate Auth URL' });
    }
});

// 2. Exchange Code
router.post('/exchange', async (req, res) => {
    try {
        const { code, clientId, clientSecret, redirectUrl, connectionName } = req.body;
        const userId = req.user.id;

        // Helper to sanitize inputs (remove quotes which cause "Invalid host defined options" and whitespace)
        // Aggressive clean: remove all whitespace, quotes, and non-printable chars
        const clean = (str) => (str || '').replace(/['"]/g, '').trim();

        // Use provided creds or fallback to env
        let creds = {
            clientId: clean(clientId || process.env.GOOGLE_CLIENT_ID),
            clientSecret: clean(clientSecret || process.env.GOOGLE_CLIENT_SECRET),
            redirectUrl: clean(redirectUrl || process.env.GOOGLE_REDIRECT_URL)
        };

        if (!code) return res.status(400).json({ error: 'Missing auth code' });
        if (!creds.clientId || !creds.clientSecret || !creds.redirectUrl) {
            return res.status(400).json({ error: 'Missing Google Client configuration (ID, Secret, or Redirect URL)' });
        }

        const { google } = require('googleapis');
        const oauth2Client = new google.auth.OAuth2(
            creds.clientId,
            creds.clientSecret,
            creds.redirectUrl
        );

        // A. Exchange
        console.log(`[Google Exchange] Exchanging code with Redirect URL: ${creds.redirectUrl}`);

        // DEBUG: Check for Proxy Environment Variables that might break gaxios
        // Gaxios/node-fetch will crash with "Invalid host defined options" if these are malformed.
        // We delete them to be safe.
        const proxyVars = ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy'];
        proxyVars.forEach(v => {
            if (process.env[v]) {
                console.warn(`[Google Exchange] Deleting detected proxy var: ${v}=${process.env[v]}`);
                delete process.env[v];
            }
        });

        logGoogleEvent('EXCHANGE_START', {
            redirectUrl: creds.redirectUrl,
            clientIdPrefix: creds.clientId ? creds.clientId.substring(0, 10) + '...' : 'MISSING',
            hasClientSecret: !!creds.clientSecret,
            codeLength: code ? code.length : 0
        });

        // Ensure code is a clean string
        const cleanCode = String(code).trim();

        let tokens;
        try {
            const response = await oauth2Client.getToken(cleanCode);
            tokens = response.tokens;
        } catch (tokenError) {
            console.error('[Google Exchange] oauth2Client.getToken failed. Attempting Axios fallback...', tokenError.message);

            // FALLBACK: Manual Token Exchange via Axios
            // This bypasses 'gaxios' (used by googleapis) which is prone to "Invalid host" errors in some ENV/Proxy setups.
            try {
                const axios = require('axios');
                const tokenUrl = 'https://oauth2.googleapis.com/token';
                const payload = {
                    code: cleanCode,
                    client_id: creds.clientId,
                    client_secret: creds.clientSecret,
                    redirect_uri: creds.redirectUrl,
                    grant_type: 'authorization_code'
                };

                console.log('[Google Exchange] Sending manual Axios request to:', tokenUrl);
                const { data } = await axios.post(tokenUrl, payload);
                tokens = data;
                console.log('[Google Exchange] Axios fallback SUCCESS!');
            } catch (axiosError) {
                console.error('[Google Exchange] Axios fallback FAILED:', axiosError.message);
                if (axiosError.response) {
                    console.error('Axios Response:', axiosError.response.data);
                }
                throw tokenError; // Throw the original error if fallback also fails
            }
        }

        oauth2Client.setCredentials(tokens);

        // B. Get User Info (Manual Axios Call - bypassing googleapis/gaxios completely)
        const axios = require('axios');
        console.log('[Google Exchange] Fetching User Info via Axios...');

        // We use the access_token we just got (either from standard or fallback)
        const userInfoResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${tokens.access_token}` }
        });

        const userInfoData = userInfoResponse.data;
        const email = userInfoData.email;
        console.log('[Google Exchange] User Info fetched successfully:', email);

        // Use user-provided name or default to email
        const finalConnectionName = connectionName || email;

        // C. Prepare Data to Save
        // We MUST save the clientId/Secret if they were provided by the user, 
        // because we need them later to refresh the token!
        const storedCredentials = {
            ...tokens,
            // Store param overrides if they were provided in the request
            params_client_id: clientId ? creds.clientId : null,
            params_client_secret: clientSecret ? creds.clientSecret : null,
            params_redirect_url: redirectUrl ? creds.redirectUrl : null
        };

        // D. Upsert to DB
        const { data: existing } = await supabaseAdmin
            .from('user_integrations')
            .select('id')
            .eq('user_id', userId)
            .eq('provider', 'google')
            .eq('connection_name', finalConnectionName)
            .single();

        let result;
        if (existing) {
            result = await supabaseAdmin
                .from('user_integrations')
                .update({
                    credentials: storedCredentials,
                    metadata: userInfoData,
                    updated_at: new Date()
                })
                .eq('id', existing.id);
        } else {
            result = await supabaseAdmin
                .from('user_integrations')
                .insert({
                    user_id: userId,
                    provider: 'google',
                    connection_name: finalConnectionName,
                    credentials: storedCredentials,
                    metadata: userInfoData
                });
        }

        if (result.error) throw result.error;

        res.json({ success: true, name: finalConnectionName });

        logGoogleEvent('EXCHANGE_SUCCESS', {
            connectionName: finalConnectionName,
            userId: userId,
            email: email
        });

    } catch (error) {
        const errorDetails = {
            message: error.message,
            code: error.code,
            response: error.response?.data,
            stack: error.stack // Include stack trace
        };

        console.error('Google Exchange Error Details:', errorDetails);

        logGoogleEvent('EXCHANGE_ERROR', {
            error: error.message,
            details: errorDetails
        });

        // Handle specific "invalid_grant" (Bad Request) separately for clarity
        if (error.response?.data?.error === 'invalid_grant') {
            return res.status(400).json({ error: 'Invalid or expired Authorization Code. Please try again.' });
        }

        const errorMessage = error.response?.data?.error_description || error.message || 'Failed to exchange token';
        res.status(500).json({ error: errorMessage, details: error.response?.data });
    }
});

// 2b. Save Service Account (Manual JSON)
router.post('/service-account', async (req, res) => {
    try {
        const { connectionName, credentials } = req.body;
        const userId = req.user.id;

        if (!connectionName || !credentials || !credentials.private_key || !credentials.client_email) {
            return res.status(400).json({ error: 'Invalid Service Account Data' });
        }

        const { data: existing } = await supabaseAdmin
            .from('user_integrations')
            .select('id')
            .eq('user_id', userId)
            .eq('provider', 'google')
            .eq('connection_name', connectionName)
            .single();

        let result;
        if (existing) {
            result = await supabaseAdmin
                .from('user_integrations')
                .update({
                    credentials,
                    metadata: { email: credentials.client_email, type: 'service_account' },
                    updated_at: new Date()
                })
                .eq('id', existing.id);
        } else {
            result = await supabaseAdmin
                .from('user_integrations')
                .insert({
                    user_id: userId,
                    provider: 'google',
                    connection_name: connectionName,
                    credentials,
                    metadata: { email: credentials.client_email, type: 'service_account' }
                });
        }

        if (result.error) throw result.error;

        res.json({ success: true });
        logGoogleEvent('SERVICE_ACCOUNT_ADDED', { userId, connectionName, email: credentials.client_email });

    } catch (error) {
        console.error('Save Service Account Error:', error);
        res.status(500).json({ error: 'Failed to save Service Account' });
    }
});

// 3. List
router.get('/connections', async (req, res) => {
    try {
        const userId = req.user.id;
        const { data, error } = await supabaseAdmin
            .from('user_integrations')
            .select('id, connection_name, created_at, updated_at')
            .eq('user_id', userId)
            .eq('provider', 'google');

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('List Connections Error:', error);
        res.status(500).json({ error: 'Failed to list connections' });
    }
});

// 4. Delete
router.delete('/connections/:id', async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        const { error } = await supabaseAdmin
            .from('user_integrations')
            .delete()
            .eq('id', id)
            .eq('user_id', userId);

        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        console.error('Delete Connection Error:', error);
        res.status(500).json({ error: 'Failed to delete connection' });
    }
});

// 5. Sheets & Columns (Proxy)
// These routes need to recover the correct ClientID/Secret from the stored credentials
// to properly refresh tokens if needed.
// Helper to getting tokens from DB
const getLastCredentials = async (req) => {
    const { connectionId, tokens: rawTokens } = req.body;
    const userId = req.user.id;

    if (connectionId) {
        const { data, error } = await supabaseAdmin
            .from('user_integrations')
            .select('credentials')
            .eq('id', connectionId)
            .eq('user_id', userId)
            .single();

        if (error || !data) throw new Error('Connection not found');
        return data.credentials;
    }

    if (rawTokens) return rawTokens;
    throw new Error('No credentials provided');
};

const { logGoogleSheetEvent } = require('../../utils/logger');

const fetchWithRefresh = async (url, creds, connectionId, userId) => {
    // 1. Service Account Check (JWT)
    // If we have a private key, we use the googleapis JWT client to fetch a valid token.
    // JWT clients handle their own refresh logic automatically via .authorize() or .getAccessToken()

    // Robust check: key can be in 'private_key' OR checking the type
    // The provided JSON has "type": "service_account"
    const isServiceAccount = (creds.type === 'service_account') || (creds.private_key && creds.client_email);

    if (isServiceAccount) {
        const email = creds.client_email;
        const now = Math.floor(Date.now() / 1000);

        // A. CACHE CHECK
        if (serviceAccountCache.has(email)) {
            const cached = serviceAccountCache.get(email);
            // Check if valid (with 5 min buffer)
            if (cached.expiresAt > now + 300) {
                console.log(`[Google Integration] Using Cached Service Account Token for ${email}`);
                return await axios.get(url, { headers: { Authorization: `Bearer ${cached.token}` } });
            }
        }

        // B. FULL AUTH FLOW
        // GLOBAL PROXY CLEANUP (Critical for googleapis/gaxios)
        // "Invalid host defined options" occurs if proxy env vars are malformed or incompatible.
        // We force direct connection by deleting them.
        const proxyVars = ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'ALL_PROXY', 'all_proxy', 'NO_PROXY', 'no_proxy'];
        proxyVars.forEach(v => {
            if (process.env[v] !== undefined) delete process.env[v];
        });

        if (!creds.private_key || !creds.client_email) {
            throw new Error('Service Account Authentication Failed: Missing private_key or client_email in credentials.');
        }

        let privateKey = creds.private_key;
        if (privateKey && typeof privateKey === 'string') {
            // Robust Key formatting: handle escaped newlines (\n) and real newlines
            if (privateKey.includes('\\n')) {
                privateKey = privateKey.replace(/\\n/g, '\n');
            }
            // Remove surrounding quotes if they were accidentally pasted
            privateKey = privateKey.replace(/^"|"$/g, '');
        }

        const debugInfo = `Email: ${creds.client_email}, KeyLen: ${privateKey ? privateKey.length : 'NULL'}, KeyStart: ${privateKey ? privateKey.substring(0, 20) : 'NULL'}...`;

        try {
            console.log('[Google Integration] Initiating Manual JWT Exchange (Bypassing Gaxios)...');

            // 1. Prepare JWT Payload
            const payload = {
                iss: creds.client_email,
                scope: 'https://www.googleapis.com/auth/spreadsheets',
                aud: 'https://oauth2.googleapis.com/token',
                exp: now + 3600, // 1 hour
                iat: now
            };

            // 2. Sign JWT
            const token = jwt.sign(payload, privateKey, { algorithm: 'RS256' });

            // 3. Exchange for Access Token via standard Axios (no proxies)
            const exchangeUrl = 'https://oauth2.googleapis.com/token';
            const exchangeParams = new URLSearchParams();
            exchangeParams.append('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer');
            exchangeParams.append('assertion', token);

            console.log('[Google Integration] Sending signed JWT to Google Token Endpoint...');

            // Explicitly unset proxy for this specific call just in case axios picks it up
            const axiosConfig = {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                proxy: false
            };

            const response = await axios.post(exchangeUrl, exchangeParams, axiosConfig);
            const accessToken = response.data.access_token;
            const expiresIn = response.data.expires_in || 3600;

            if (!accessToken) {
                throw new Error('Manual JWT Exchange successful but returned no access_token.');
            }

            console.log('[Google Integration] Manual JWT Exchange SUCCESS.');

            // C. UPDATE CACHE
            serviceAccountCache.set(email, {
                token: accessToken,
                expiresAt: now + expiresIn
            });

            // 4. Use the token
            return await axios.get(url, { headers: { Authorization: `Bearer ${accessToken}` } });

        } catch (authError) {
            console.error('[Google Integration] Service Account Auth failed:', authError);

            // Detailed Debug
            const failureReason = authError.message || 'Unknown Error';
            const stackTrace = authError.stack || 'No Stack Trace';
            const responseData = authError.response ? JSON.stringify(authError.response.data) : 'No Response Data';

            const errorMsg = `Service Account Auth Failed: ${failureReason} | Response: ${responseData} | Debug: ${debugInfo} | Stack: ${stackTrace}`;
            console.error(errorMsg);
            throw new Error(errorMsg);
        }
    }


    // 2. Standard OAuth2 Flow (User Account)
    let activeCreds = creds;

    try {
        // PROACTIVE REFRESH: Check if token is expired or expires in < 5 mins
        // expiry_date is in milliseconds timestamp
        const now = Date.now();
        const EXPIRY_BUFFER = 5 * 60 * 1000; // 5 minutes
        const isExpiring = activeCreds.expiry_date && (activeCreds.expiry_date <= now + EXPIRY_BUFFER);

        if (isExpiring && activeCreds.refresh_token) {
            console.log('[Google Integration] Token is expired or expiring soon. Refreshing proactively...');

            const { google } = require('googleapis');
            const clientId = activeCreds.params_client_id || process.env.GOOGLE_CLIENT_ID;
            const clientSecret = activeCreds.params_client_secret || process.env.GOOGLE_CLIENT_SECRET;
            const redirectUrl = activeCreds.params_redirect_url || process.env.GOOGLE_REDIRECT_URL;

            const oauth2Client = new google.auth.OAuth2(
                (clientId || '').trim(),
                (clientSecret || '').trim(),
                (redirectUrl || '').trim()
            );

            oauth2Client.setCredentials(activeCreds);

            try {
                const { credentials } = await oauth2Client.refreshAccessToken();
                console.log('[Google Integration] Proactive refresh successful.');

                // Update DB
                if (connectionId) {
                    const newCreds = { ...activeCreds, ...credentials };
                    await supabaseAdmin
                        .from('user_integrations')
                        .update({
                            credentials: newCreds,
                            updated_at: new Date()
                        })
                        .eq('id', connectionId);

                    // Update local variable for the request
                    activeCreds = newCreds;
                }
            } catch (refreshErr) {
                console.error('[Google Integration] Proactive refresh failed:', refreshErr.message);
                // We continue, hoping the old access_token might still work or the 401 handler catches it?
                // Actually if refresh failed, probably invalid_grant, so the next request will fail anyway.
                // But let's proceed to the try/catch block.
            }
        }

        return await axios.get(url, { headers: { Authorization: `Bearer ${activeCreds.access_token}` } });
    } catch (error) {
        if (error.response && error.response.status === 401) {
            console.log('[Google Integration] OAuth Token expired (401), attempting refresh (Reactive)...');

            const { google } = require('googleapis');
            // Resolve config
            const clientId = activeCreds.params_client_id || process.env.GOOGLE_CLIENT_ID;
            const clientSecret = activeCreds.params_client_secret || process.env.GOOGLE_CLIENT_SECRET;
            const redirectUrl = activeCreds.params_redirect_url || process.env.GOOGLE_REDIRECT_URL;

            if (!activeCreds.refresh_token) {
                console.warn('[Google Integration] No refresh token available. Cannot refresh.');
                // Throw specific error for frontend to suggest reconnection
                const err = new Error('Google Authorization Expired. Please Re-Connect Account.');
                err.code = 'NO_REFRESH_TOKEN';
                throw err;
            }

            const oauth2Client = new google.auth.OAuth2(
                (clientId || '').trim(),
                (clientSecret || '').trim(),
                (redirectUrl || '').trim()
            );

            // Set credentials including refresh_token
            oauth2Client.setCredentials(activeCreds);

            try {
                const { credentials } = await oauth2Client.refreshAccessToken();
                console.log('[Google Integration] Token refreshed successfully (Reactive).');

                // Update DB if this is a stored connection
                if (connectionId) {
                    const newCreds = { ...activeCreds, ...credentials };
                    await supabaseAdmin
                        .from('user_integrations')
                        .update({
                            credentials: newCreds,
                            updated_at: new Date()
                        })
                        .eq('id', connectionId);
                }

                // Retry Request with NEW token
                return await axios.get(url, { headers: { Authorization: `Bearer ${credentials.access_token}` } });

            } catch (refreshError) {
                console.error('[Google Integration] Refresh failed:', refreshError.message);
                const err = new Error('Google Session Expired. Please Re-Connect Account.');
                err.code = 'REFRESH_FAILED';
                err.originalError = refreshError.message;
                throw err;
            }
        }
        throw error;
    }
};

router.post('/sheets', async (req, res) => {
    try {
        const { spreadsheetId, connectionId } = req.body;

        console.log('[Google Sheets] Load Sheets Request:', { spreadsheetId, connectionId, userId: req.user.id });

        logGoogleSheetEvent('FTECH_SHEETS_START', {
            spreadsheetId,
            userId: req.user.id
        });

        if (!spreadsheetId) {
            const error = 'Missing spreadsheetId';
            console.error('[Google Sheets] Missing spreadsheetId');
            logGoogleSheetEvent('FETCH_SHEETS_ERROR', { error });
            return res.status(400).json({ error });
        }

        const creds = await getLastCredentials(req);
        console.log('[Google Sheets] Got credentials, has refresh_token:', !!creds.refresh_token);

        // Manual Axios Call to Sheets API (via Helper)
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?includeGridData=false`;

        console.log(`[Google Sheets] Fetching metadata via Axios: ${url}`);

        const response = await fetchWithRefresh(url, creds, connectionId, req.user.id);

        const sheetNames = response.data.sheets.map(s => s.properties.title);

        logGoogleSheetEvent('FETCH_SHEETS_SUCCESS', {
            spreadsheetId,
            sheetCount: sheetNames.length,
            sheets: sheetNames
        });

        console.log('[Google Sheets] Success! Sheets:', sheetNames);
        res.json({ sheets: sheetNames });

    } catch (error) {
        const msg = error.response?.data?.error?.message || error.message;
        const details = error.response?.data || {};

        console.error('Fetch Sheets Error:', details);

        logGoogleSheetEvent('FETCH_SHEETS_FAIL', {
            spreadsheetId: req.body.spreadsheetId,
            error: msg,
            details: details
        });

        if (error.code === 'NO_REFRESH_TOKEN' || error.code === 'REFRESH_FAILED') {
            return res.status(401).json({ error: error.message });
        }

        res.status(500).json({ error: msg });
    }
});

router.post('/columns', async (req, res) => {
    try {
        const { spreadsheetId, sheetName, connectionId } = req.body;

        console.log('[Google Sheets] Fetch Columns Request:', { spreadsheetId, sheetName, connectionId, userId: req.user.id });

        logGoogleSheetEvent('FETCH_COLUMNS_START', {
            spreadsheetId,
            sheetName,
            userId: req.user.id
        });

        if (!spreadsheetId || !sheetName) {
            const error = 'Missing requirements';
            console.error('[Google Sheets] Missing spreadsheetId or sheetName:', { spreadsheetId, sheetName });
            logGoogleSheetEvent('FETCH_COLUMNS_ERROR', { error, body: req.body });
            return res.status(400).json({ error });
        }

        const creds = await getLastCredentials(req); // Get latest tokens
        console.log('[Google Sheets] Got credentials, has refresh_token:', !!creds.refresh_token);

        // Manual Axios Call to Sheets API (via Helper)
        // Range A1:Z1 typically covers the headers
        const encodedSheet = encodeURIComponent(sheetName);
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedSheet}!1:1`;

        console.log(`[Google Sheets] Fetching columns via Axios: ${url}`);

        const response = await fetchWithRefresh(url, creds, connectionId, req.user.id);

        const columns = response.data.values ? response.data.values[0] : [];

        logGoogleSheetEvent('FETCH_COLUMNS_SUCCESS', {
            spreadsheetId,
            sheetName,
            columnCount: columns.length,
            columns: columns
        });

        console.log('[Google Sheets] Success! Columns:', columns);
        res.json({ columns });

    } catch (error) {
        const msg = error.response?.data?.error?.message || error.message;
        const details = error.response?.data || {};

        console.error('Fetch Columns Error:', details);

        logGoogleSheetEvent('FETCH_COLUMNS_FAIL', {
            spreadsheetId: req.body.spreadsheetId,
            sheetName: req.body.sheetName,
            error: msg,
            details: details
        });

        if (error.code === 'NO_REFRESH_TOKEN' || error.code === 'REFRESH_FAILED') {
            return res.status(401).json({ error: error.message });
        }

        res.status(500).json({ error: msg });
    }
});

module.exports = router;
