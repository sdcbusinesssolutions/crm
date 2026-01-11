const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../../lib/supabaseClient');

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
        const oauth2Client = new google.auth.OAuth2(
            effectiveClientId,
            null,
            effectiveRedirectUrl
        );

        // Contacts Scopes
        const scopes = [
            'https://www.googleapis.com/auth/contacts',
            'https://www.googleapis.com/auth/contacts.readonly',
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
        console.error('Contacts Auth URL Error:', error);
        res.status(500).json({ error: 'Failed to generate Auth URL' });
    }
});

// 2. Exchange Code
router.post('/exchange', async (req, res) => {
    try {
        const { code, clientId, clientSecret, redirectUrl, connectionName } = req.body;
        const userId = req.user.id;

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
        const storedCredentials = {
            ...tokens,
            params_client_id: clientId || null,
            params_client_secret: clientSecret || null,
            params_redirect_url: redirectUrl || null
        };

        // D. Upsert to DB with provider='google_contacts'
        const { data: existing } = await supabaseAdmin
            .from('user_integrations')
            .select('id')
            .eq('user_id', userId)
            .eq('provider', 'google_contacts')
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
                    provider: 'google_contacts',
                    connection_name: finalConnectionName,
                    credentials: storedCredentials,
                    metadata: userInfo.data
                });
        }

        if (result.error) throw result.error;

        res.json({ success: true, name: finalConnectionName });

    } catch (error) {
        console.error('Contacts Exchange Error:', error);
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
            .eq('provider', 'google_contacts');

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('List Contacts Connections Error:', error);
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
        console.error('Delete Contacts Connection Error:', error);
        res.status(500).json({ error: 'Failed to delete connection' });
    }
});

module.exports = router;
