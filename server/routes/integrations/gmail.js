const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../../lib/supabaseClient');

// 1. Generate Auth URL
router.post('/auth-url', (req, res) => {
    try {
        const { clientId, redirectUrl } = req.body;

        // Use provided overrides or fallback to env. 
        // Note: For Gmail, we might share keys with Google Sheets or have separate ones.
        // Usually, a "Google Project" has one ClientID/Secret for all APIs enabled on it.
        const effectiveClientId = clientId || process.env.GOOGLE_CLIENT_ID;
        const effectiveRedirectUrl = redirectUrl || process.env.GOOGLE_REDIRECT_URL;

        if (!effectiveClientId || !effectiveRedirectUrl) {
            return res.status(400).json({ error: 'Missing Client ID or Redirect URL configuration' });
        }

        const { google } = require('googleapis');
        const oauth2Client = new google.auth.OAuth2(
            effectiveClientId,
            null,
            effectiveRedirectUrl
        );

        // Gmail Scopes
        const scopes = [
            'https://www.googleapis.com/auth/gmail.send',
            'https://www.googleapis.com/auth/gmail.readonly',
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
        console.error('Gmail Auth URL Error:', error);
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
        // Assuming same env vars as Google unless specific ones provided
        const creds = {
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
        console.log(`[Gmail Exchange] Exchanging code with Redirect URL: ${creds.redirectUrl}`);

        // AGGRESSIVE PROXY CLEANUP (Critical for googleapis/gaxios)
        ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'ALL_PROXY', 'all_proxy', 'NO_PROXY', 'no_proxy', 'npm_config_proxy', 'npm_config_https_proxy'].forEach(v => {
            if (process.env[v] !== undefined) delete process.env[v];
        });
        process.env.NO_PROXY = '*';

        // Ensure code is a clean string
        const cleanCode = String(code).trim();
        let tokens;

        try {
            const response = await oauth2Client.getToken(cleanCode);
            tokens = response.tokens;
        } catch (tokenError) {
            console.error('[Gmail Exchange] oauth2Client.getToken failed. Attempting Axios fallback...', tokenError.message);
            // FALLBACK: Manual Token Exchange via Axios
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

                const { data } = await axios.post(tokenUrl, payload);
                tokens = data;
                console.log('[Gmail Exchange] Axios fallback SUCCESS!');
            } catch (axiosError) {
                console.error('[Gmail Exchange] Axios fallback FAILED:', axiosError.message);
                throw tokenError;
            }
        }

        oauth2Client.setCredentials(tokens);

        // B. Get User Info (Manual Axios Call - bypassing googleapis/gaxios completely)
        const axios = require('axios');
        console.log('[Gmail Exchange] Fetching User Info via Axios...');

        const userInfoResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${tokens.access_token}` }
        });

        const userInfoData = userInfoResponse.data;
        const email = userInfoData.email;
        console.log('[Gmail Exchange] User Info fetched successfully:', email);

        // Use user-provided name or default to email
        const finalConnectionName = connectionName || email;

        // C. Prepare Data to Save
        const storedCredentials = {
            ...tokens,
            params_client_id: clientId || null,
            params_client_secret: clientSecret || null,
            params_redirect_url: redirectUrl || null
        };

        // D. Upsert to DB with provider='gmail'
        const { data: existing } = await supabaseAdmin
            .from('user_integrations')
            .select('id')
            .eq('user_id', userId)
            .eq('provider', 'gmail')
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
                    provider: 'gmail', // Important: Different provider string
                    connection_name: finalConnectionName,
                    credentials: storedCredentials,
                    metadata: userInfoData
                });
        }

        if (result.error) throw result.error;

        res.json({ success: true, name: finalConnectionName });

    } catch (error) {
        console.error('Gmail Exchange Error:', error);
        res.status(500).json({ error: error.message || 'Failed to exchange token' });
    }
});

// 3. List
router.get('/connections', async (req, res) => {
    try {
        const userId = req.user.id;
        const { data, error } = await supabaseAdmin
            .from('user_integrations')
            .select('id, connection_name, created_at, updated_at, metadata')
            .eq('user_id', userId)
            .eq('provider', 'gmail');

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('List Gmail Connections Error:', error);
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
        console.error('Delete Gmail Connection Error:', error);
        res.status(500).json({ error: 'Failed to delete connection' });
    }
});

const GmailService = require('../../services/GmailService');

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
            .eq('provider', 'gmail')
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
                    provider: 'gmail',
                    connection_name: connectionName,
                    credentials,
                    metadata: { email: credentials.client_email, type: 'service_account' }
                });
        }

        if (result.error) throw result.error;

        res.json({ success: true });

    } catch (error) {
        console.error('Save Gmail Service Account Error:', error);
        res.status(500).json({ error: 'Failed to save Service Account' });
    }
});

// 5. Send Email
router.post('/send', async (req, res) => {
    try {
        const { connectionId, to, subject, body } = req.body;
        const userId = req.user.id;

        console.log('[Gmail Send] Request received:', { userId, connectionId, to, subject: subject?.substring(0, 20) });

        if (!connectionId) {
            console.error('[Gmail Send] Missing connectionId');
            return res.status(400).json({ error: 'Missing connectionId' });
        }
        if (!to) {
            console.error('[Gmail Send] Missing recipient');
            return res.status(400).json({ error: 'Missing recipient email' });
        }

        const result = await GmailService.sendEmail(userId, connectionId, to, subject, body);
        console.log('[Gmail Send] Success:', result);
        res.json(result);

    } catch (error) {
        console.error('[Gmail Send] Error:', error.message);
        console.error('[Gmail Send] Stack:', error.stack);
        if (error.response) {
            console.error('[Gmail Send] API Response:', JSON.stringify(error.response.data, null, 2));
        }
        res.status(500).json({ error: error.message || 'Failed to send email' });
    }
});

module.exports = router;
