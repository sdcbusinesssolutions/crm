const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../../lib/supabaseClient');

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
        const effectiveClientId = clientId || process.env.GOOGLE_CLIENT_ID;
        const effectiveRedirectUrl = redirectUrl || process.env.GOOGLE_REDIRECT_URL;

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

        // Use provided creds or fallback to env
        const creds = {
            clientId: clientId || process.env.GOOGLE_CLIENT_ID,
            clientSecret: clientSecret || process.env.GOOGLE_CLIENT_SECRET,
            redirectUrl: redirectUrl || process.env.GOOGLE_REDIRECT_URL
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
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // B. Get User Info
        const oauth2 = google.oauth2({ auth: oauth2Client, version: 'v2' });
        const userInfo = await oauth2.userinfo.get();
        const email = userInfo.data.email;

        // Use user-provided name or default to email
        const finalConnectionName = connectionName || email;

        // C. Prepare Data to Save
        // We MUST save the clientId/Secret if they were provided by the user, 
        // because we need them later to refresh the token!
        const storedCredentials = {
            ...tokens,
            // Only store these if they differ from Env? No, safer to store them if this connection relies on them.
            params_client_id: clientId || null,
            params_client_secret: clientSecret || null,
            params_redirect_url: redirectUrl || null
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
                    metadata: userInfo.data,
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
                    metadata: userInfo.data
                });
        }

        if (result.error) throw result.error;

        res.json({ success: true, name: finalConnectionName });

    } catch (error) {
        console.error('Google Exchange Error:', error);
        res.status(500).json({ error: error.message || 'Failed to exchange token' });
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
const getAuthForConnection = async (req) => {
    const { connectionId, tokens: rawTokens } = req.body;
    const userId = req.user.id;

    let authTokens = rawTokens;
    let clientId = process.env.GOOGLE_CLIENT_ID;
    let clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    let redirectUrl = process.env.GOOGLE_REDIRECT_URL;

    if (connectionId) {
        const { data, error } = await supabaseAdmin
            .from('user_integrations')
            .select('credentials')
            .eq('id', connectionId)
            .eq('user_id', userId)
            .single();

        if (error || !data) throw new Error('Connection not found');
        authTokens = data.credentials;

        // Check if this connection has custom creds
        if (authTokens.params_client_id) clientId = authTokens.params_client_id;
        if (authTokens.params_client_secret) clientSecret = authTokens.params_client_secret;
        if (authTokens.params_redirect_url) redirectUrl = authTokens.params_redirect_url;
    }

    if (!authTokens) throw new Error('Missing tokens or connectionId');

    const { google } = require('googleapis');
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUrl);
    oauth2Client.setCredentials(authTokens);

    return oauth2Client;
};

router.post('/sheets', async (req, res) => {
    try {
        const { spreadsheetId } = req.body;
        if (!spreadsheetId) return res.status(400).json({ error: 'Missing spreadsheetId' });

        const authClient = await getAuthForConnection(req);
        const { google } = require('googleapis');
        const sheets = google.sheets({ version: 'v4', auth: authClient });

        const response = await sheets.spreadsheets.get({ spreadsheetId });
        const sheetNames = response.data.sheets.map(s => s.properties.title);
        res.json({ sheets: sheetNames });
    } catch (error) {
        console.error('Fetch Sheets Error:', error);
        res.status(500).json({ error: 'Failed to fetch sheets: ' + error.message });
    }
});

router.post('/columns', async (req, res) => {
    try {
        const { spreadsheetId, sheetName } = req.body;
        if (!spreadsheetId || !sheetName) return res.status(400).json({ error: 'Missing requirements' });

        const authClient = await getAuthForConnection(req);
        const { google } = require('googleapis');
        const sheets = google.sheets({ version: 'v4', auth: authClient });

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetName}!1:1`
        });

        const columns = response.data.values ? response.data.values[0] : [];
        res.json({ columns });
    } catch (error) {
        console.error('Fetch Columns Error:', error);
        res.status(500).json({ error: 'Failed to fetch columns: ' + error.message });
    }
});

module.exports = router;
