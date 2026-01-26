const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../../lib/supabaseClient');
const axios = require('axios');
const jwt = require('jsonwebtoken');

// Simple in-memory cache for Service Account Tokens
const serviceAccountCache = new Map();

// Helper: Get Credentials from DB
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

// Helper: Robust Fetch with Token Refresh & Service Account Support
const fetchWithRefresh = async (url, method, body, creds, connectionId) => {
    // 1. Service Account Check (JWT)
    const isServiceAccount = (creds.type === 'service_account') || (creds.private_key && creds.client_email);

    if (isServiceAccount) {
        const email = creds.client_email;
        const now = Math.floor(Date.now() / 1000);

        // A. CACHE CHECK
        if (serviceAccountCache.has(email)) {
            const cached = serviceAccountCache.get(email);
            if (cached.expiresAt > now + 300) {
                console.log(`[Calendar Integration] Using Cached Service Account Token for ${email}`);
                return await axios({
                    method,
                    url,
                    data: body,
                    headers: { Authorization: `Bearer ${cached.token}` }
                });
            }
        }

        // B. FULL AUTH FLOW (Manual JWT)
        // Global Proxy Cleanup for safety
        ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'ALL_PROXY', 'all_proxy', 'NO_PROXY', 'no_proxy'].forEach(v => {
            if (process.env[v] !== undefined) delete process.env[v];
        });

        if (!creds.private_key || !creds.client_email) {
            throw new Error('Service Account Authentication Failed: Missing private_key or client_email.');
        }

        let privateKey = creds.private_key;
        if (typeof privateKey === 'string') {
            if (privateKey.includes('\\n')) privateKey = privateKey.replace(/\\n/g, '\n');
            privateKey = privateKey.replace(/^"|"$/g, '');
        }

        try {
            console.log('[Calendar Integration] Initiating Manual JWT Exchange...');
            const payload = {
                iss: creds.client_email,
                scope: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events',
                aud: 'https://oauth2.googleapis.com/token',
                exp: now + 3600,
                iat: now
            };

            const token = jwt.sign(payload, privateKey, { algorithm: 'RS256' });

            const exchangeUrl = 'https://oauth2.googleapis.com/token';
            const exchangeParams = new URLSearchParams();
            exchangeParams.append('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer');
            exchangeParams.append('assertion', token);

            // Explicitly unset proxy
            const response = await axios.post(exchangeUrl, exchangeParams, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                proxy: false
            });

            const accessToken = response.data.access_token;
            if (!accessToken) throw new Error('No access_token returned from JWT exchange.');

            serviceAccountCache.set(email, {
                token: accessToken,
                expiresAt: now + (response.data.expires_in || 3600)
            });

            return await axios({
                method,
                url,
                data: body,
                headers: { Authorization: `Bearer ${accessToken}` }
            });

        } catch (authError) {
            console.error('[Calendar Integration] Service Account Auth failed:', authError.message);
            throw new Error(`Service Account Auth Failed: ${authError.message}`);
        }
    }

    // 2. Standard OAuth2 Flow (User Account)
    let activeCreds = creds;

    try {
        // PROACTIVE REFRESH (5 min buffer)
        const now = Date.now();
        const EXPIRY_BUFFER = 5 * 60 * 1000;
        const isExpiring = activeCreds.expiry_date && (activeCreds.expiry_date <= now + EXPIRY_BUFFER);

        if (isExpiring && activeCreds.refresh_token) {
            console.log('[Calendar Integration] Token expiring soon. Refreshing proactively...');
            const { google } = require('googleapis');
            const oauth2Client = new google.auth.OAuth2(
                activeCreds.params_client_id || process.env.GOOGLE_CLIENT_ID,
                activeCreds.params_client_secret || process.env.GOOGLE_CLIENT_SECRET,
                activeCreds.params_redirect_url || process.env.GOOGLE_REDIRECT_URL
            );
            oauth2Client.setCredentials(activeCreds);

            const { credentials } = await oauth2Client.refreshAccessToken();

            if (connectionId) {
                const newCreds = { ...activeCreds, ...credentials };
                await supabaseAdmin.from('user_integrations').update({ credentials: newCreds, updated_at: new Date() }).eq('id', connectionId);
                activeCreds = newCreds;
            }
        }

        return await axios({
            method,
            url,
            data: body,
            headers: { Authorization: `Bearer ${activeCreds.access_token}` }
        });

    } catch (error) {
        // REACTIVE REFRESH (401)
        if (error.response && error.response.status === 401 && activeCreds.refresh_token) {
            console.log('[Calendar Integration] 401 Unauthorized. Attempting reactive refresh...');
            const { google } = require('googleapis');
            const oauth2Client = new google.auth.OAuth2(
                activeCreds.params_client_id || process.env.GOOGLE_CLIENT_ID,
                activeCreds.params_client_secret || process.env.GOOGLE_CLIENT_SECRET,
                activeCreds.params_redirect_url || process.env.GOOGLE_REDIRECT_URL
            );
            oauth2Client.setCredentials(activeCreds);

            try {
                const { credentials } = await oauth2Client.refreshAccessToken();
                if (connectionId) {
                    const newCreds = { ...activeCreds, ...credentials };
                    await supabaseAdmin.from('user_integrations').update({ credentials: newCreds, updated_at: new Date() }).eq('id', connectionId);
                    activeCreds = newCreds;
                }
                // Retry
                return await axios({
                    method,
                    url,
                    data: body,
                    headers: { Authorization: `Bearer ${activeCreds.access_token}` }
                });
            } catch (refreshErr) {
                console.error('[Calendar Integration] Reactive refresh failed:', refreshErr.message);
                throw new Error('Authorization Expired. Please Re-Connect Account.');
            }
        }
        throw error;
    }
};

// 1. Generate Auth URL
router.post('/auth-url', (req, res) => {
    try {
        const { clientId, redirectUrl } = req.body;
        const effectiveClientId = clientId || process.env.GOOGLE_CLIENT_ID;
        const effectiveRedirectUrl = redirectUrl || process.env.GOOGLE_REDIRECT_URL;

        if (!effectiveClientId || !effectiveRedirectUrl) {
            return res.status(400).json({ error: 'Missing Client ID or Redirect URL configuration' });
        }

        const { google } = require('googleapis');
        const oauth2Client = new google.auth.OAuth2(effectiveClientId, null, effectiveRedirectUrl);

        const scopes = [
            'https://www.googleapis.com/auth/calendar',
            'https://www.googleapis.com/auth/calendar.events',
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile'
        ];

        const url = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: scopes,
            prompt: 'consent'
        });

        res.json({ url });
    } catch (error) {
        console.error('Calendar Auth URL Error:', error);
        res.status(500).json({ error: 'Failed to generate Auth URL' });
    }
});

// 2. Exchange Code
router.post('/exchange', async (req, res) => {
    try {
        const { code, clientId, clientSecret, redirectUrl, connectionName } = req.body;
        const userId = req.user.id;

        const clean = (str) => (str || '').replace(/['"]/g, '').trim();
        const creds = {
            clientId: clean(clientId || process.env.GOOGLE_CLIENT_ID),
            clientSecret: clean(clientSecret || process.env.GOOGLE_CLIENT_SECRET),
            redirectUrl: clean(redirectUrl || process.env.GOOGLE_REDIRECT_URL)
        };

        if (!code) return res.status(400).json({ error: 'Missing auth code' });
        if (!creds.clientId || !creds.clientSecret || !creds.redirectUrl) {
            return res.status(400).json({ error: 'Missing Google Client configuration' });
        }

        const { google } = require('googleapis');
        const oauth2Client = new google.auth.OAuth2(creds.clientId, creds.clientSecret, creds.redirectUrl);

        console.log(`[Calendar Exchange] Exchanging code...`);

        // Proxy Cleanup
        ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'ALL_PROXY', 'all_proxy', 'NO_PROXY', 'no_proxy'].forEach(v => {
            if (process.env[v] !== undefined) delete process.env[v];
        });

        let tokens;
        try {
            const response = await oauth2Client.getToken(code);
            tokens = response.tokens;
        } catch (tokenError) {
            console.error('[Calendar Exchange] oauth2Client failed. Attempting Axios fallback w/ proxy: false...', tokenError.message);
            try {
                const tokenUrl = 'https://oauth2.googleapis.com/token';
                const payload = {
                    code: String(code).trim(),
                    client_id: creds.clientId,
                    client_secret: creds.clientSecret,
                    redirect_uri: creds.redirectUrl,
                    grant_type: 'authorization_code'
                };
                const { data } = await axios.post(tokenUrl, payload, { proxy: false });
                tokens = data;
                console.log('[Calendar Exchange] Axios fallback SUCCESS!');
            } catch (axiosError) {
                console.error('[Calendar Exchange] Axios fallback FAILED:', axiosError.message);
                throw tokenError;
            }
        }

        oauth2Client.setCredentials(tokens);

        // Fetch User Info via Axios (Bypassing gaxios)
        const userInfoResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
            proxy: false
        });

        const userInfoData = userInfoResponse.data;
        const finalConnectionName = connectionName || userInfoData.email;

        const storedCredentials = {
            ...tokens,
            params_client_id: clientId || null,
            params_client_secret: clientSecret || null,
            params_redirect_url: redirectUrl || null
        };

        const { data: existing } = await supabaseAdmin
            .from('user_integrations')
            .select('id')
            .eq('user_id', userId)
            .eq('provider', 'google_calendar')
            .eq('connection_name', finalConnectionName)
            .single();

        let result;
        if (existing) {
            result = await supabaseAdmin.from('user_integrations').update({ credentials: storedCredentials, metadata: userInfoData, updated_at: new Date() }).eq('id', existing.id);
        } else {
            result = await supabaseAdmin.from('user_integrations').insert({ user_id: userId, provider: 'google_calendar', connection_name: finalConnectionName, credentials: storedCredentials, metadata: userInfoData });
        }

        if (result.error) throw result.error;
        res.json({ success: true, name: finalConnectionName });

    } catch (error) {
        console.error('Calendar Exchange Error:', error);
        res.status(500).json({ error: error.message || 'Failed to exchange token' });
    }
});

// 2b. Save Service Account
router.post('/service-account', async (req, res) => {
    try {
        const { connectionName, credentials } = req.body;
        const userId = req.user.id;

        if (!connectionName || !credentials || !credentials.private_key || !credentials.client_email) {
            return res.status(400).json({ error: 'Invalid Service Account Data' });
        }

        const { data: existing } = await supabaseAdmin.from('user_integrations').select('id').eq('user_id', userId).eq('provider', 'google_calendar').eq('connection_name', connectionName).single();
        let result;
        if (existing) {
            result = await supabaseAdmin.from('user_integrations').update({ credentials, metadata: { email: credentials.client_email, type: 'service_account' }, updated_at: new Date() }).eq('id', existing.id);
        } else {
            result = await supabaseAdmin.from('user_integrations').insert({ user_id: userId, provider: 'google_calendar', connection_name: connectionName, credentials, metadata: { email: credentials.client_email, type: 'service_account' } });
        }
        if (result.error) throw result.error;
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save Service Account' });
    }
});

// 3. List
router.get('/connections', async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin.from('user_integrations').select('id, connection_name, created_at').eq('user_id', req.user.id).eq('provider', 'google_calendar');
        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to list connections' });
    }
});

// 4. Delete
router.delete('/connections/:id', async (req, res) => {
    try {
        const { error } = await supabaseAdmin.from('user_integrations').delete().eq('id', req.params.id).eq('user_id', req.user.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete connection' });
    }
});

// 5. Get Available Slots (FreeBusy)
router.post('/slots', async (req, res) => {
    try {
        const { connectionId, startTime, endTime, timeZone } = req.body;

        // 1. Get Credentials
        const creds = await getLastCredentials(req);

        // 2. Prepare Request
        // We use the FreeBusy API: https://developers.google.com/calendar/api/v3/reference/freebusy/query
        const url = 'https://www.googleapis.com/calendar/v3/freeBusy';
        const body = {
            timeMin: startTime, // ISO String
            timeMax: endTime,   // ISO String
            timeZone: timeZone || 'UTC',
            items: [{ id: 'primary' }] // Check primary calendar
        };

        console.log('[Calendar Slots] Fetching freebusy...', { startTime, endTime });

        // 3. Execute with Refresh Logic
        const response = await fetchWithRefresh(url, 'POST', body, creds, connectionId);

        // 4. Transform Response
        // Response format: { calendars: { primary: { busy: [ { start, end } ] } } }
        const busySlots = response.data.calendars?.primary?.busy || [];

        res.json({ busy: busySlots });

    } catch (error) {
        console.error('Calendar Slots Error:', error.message);
        if (error.response) console.error('API Error:', JSON.stringify(error.response.data, null, 2));
        res.status(500).json({ error: error.message || 'Failed to fetch slots' });
    }
});

module.exports = router;
