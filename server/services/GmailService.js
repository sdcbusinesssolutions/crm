const { supabaseAdmin } = require('../lib/supabaseClient');
const { google } = require('googleapis');
const axios = require('axios');

const GmailService = {
    async _getAuthClient(creds, connectionId) {
        // AGGRESSIVE PROXY CLEANUP (Critical for googleapis/gaxios)
        // Ensure no proxy environment variables are set that could confuse Gaxios
        ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'ALL_PROXY', 'all_proxy', 'NO_PROXY', 'no_proxy', 'npm_config_proxy', 'npm_config_https_proxy'].forEach(v => {
            if (process.env[v] !== undefined) delete process.env[v];
        });

        // Explicitly tell Node/Gaxios to NOT use proxy for Google APIs by setting NO_PROXY to wildcard
        process.env.NO_PROXY = '*';

        if (creds.private_key && creds.client_email) {
            console.log('[GmailService] Using Service Account for Auth');
            return new google.auth.JWT(
                creds.client_email,
                null,
                creds.private_key,
                ['https://www.googleapis.com/auth/gmail.send']
            );
        }

        const oauth2Client = new google.auth.OAuth2(
            creds.params_client_id || process.env.GOOGLE_CLIENT_ID,
            creds.params_client_secret || process.env.GOOGLE_CLIENT_SECRET,
            creds.params_redirect_url || process.env.GOOGLE_REDIRECT_URL
        );

        oauth2Client.setCredentials(creds);

        // PERSIST REFRESHED TOKENS
        if (connectionId) {
            oauth2Client.on('tokens', async (tokens) => {
                console.log('[GmailService] Received new tokens (Refresh). Persisting to DB...');
                try {
                    // Merge new tokens with existing creds (keeps refresh_token if not provided)
                    const newCreds = { ...creds, ...tokens };
                    const { error } = await supabaseAdmin
                        .from('user_integrations')
                        .update({ credentials: newCreds, updated_at: new Date() })
                        .eq('id', connectionId);

                    if (error) console.error('[GmailService] DB Update Failed:', error.message);
                    else console.log('[GmailService] Tokens updated successfully.');
                } catch (e) {
                    console.error('[GmailService] Token persist error:', e);
                }
            });
        }

        // PROACTIVE REFRESH LOGIC
        const now = Date.now();
        const refreshBuffer = 5 * 60 * 1000; // 5 minutes
        const isExpiring = creds.expiry_date && (creds.expiry_date <= now + refreshBuffer);

        if (isExpiring) {
            console.log('[GmailService] Token is expiring. Attempting Proactive Refresh (Manual Axios)...');
            if (creds.refresh_token) {
                try {
                    const tokenUrl = 'https://oauth2.googleapis.com/token';
                    const payload = {
                        client_id: creds.params_client_id || process.env.GOOGLE_CLIENT_ID,
                        client_secret: creds.params_client_secret || process.env.GOOGLE_CLIENT_SECRET,
                        refresh_token: creds.refresh_token,
                        grant_type: 'refresh_token'
                    };

                    // Manual exchange bypassing gaxios proxy issues
                    const { data: tokens } = await axios.post(tokenUrl, payload, { proxy: false });
                    console.log('[GmailService] Proactive Refresh Successful (Manual).');

                    // Merge new tokens
                    const newCreds = { ...creds, ...tokens };
                    // Recalculate expiry if provided
                    if (tokens.expires_in) {
                        newCreds.expiry_date = Date.now() + (tokens.expires_in * 1000);
                    }

                    // Persist to DB
                    await supabaseAdmin
                        .from('user_integrations')
                        .update({ credentials: newCreds, updated_at: new Date() })
                        .eq('id', connectionId);

                    // Update client instance
                    oauth2Client.setCredentials(newCreds);

                } catch (e) {
                    console.error('[GmailService] Proactive Refresh Failed (Manual):', e.message);
                    if (e.response) console.error('Data:', e.response.data);
                    // Proceeding anyway, hoping old token is still valid
                }
            } else {
                console.warn('[GmailService] Token is expiring but NO refresh_token found. Authentication will likely fail.');
            }
        }

        return oauth2Client;
    },

    async sendEmail(userId, connectionId, to, subject, body) {
        if (!connectionId || !to || !subject || !body) {
            throw new Error('Missing required fields: connectionId, to, subject, body');
        }

        // 1. Get Integration
        const { data: integration, error } = await supabaseAdmin
            .from('user_integrations')
            .select('*')
            .eq('id', connectionId)
            .eq('user_id', userId)
            .single();

        if (error || !integration) {
            throw new Error('Gmail connection not found');
        }

        // 2. Setup Auth
        const authClient = await this._getAuthClient(integration.credentials, connectionId);

        // 3. Send Email (Manual Axios to bypass gaxios/proxy issues)
        // Helper to encode
        const makeBody = (to, subject, message) => {
            const str = [
                `To: ${to}`,
                `Subject: ${subject}`,
                `Content-Type: text/html; charset=utf-8`,
                `MIME-Version: 1.0`,
                ``,
                message
            ].join('\n');
            return Buffer.from(str).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        };

        const raw = makeBody(to, subject, body);
        const accessToken = authClient.credentials.access_token;

        if (!accessToken) throw new Error('No access_token available for Gmail Send');

        const sendUrl = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

        console.log('[GmailService] Sending email via Axios (proxy: false)...');

        const { data: result } = await axios.post(sendUrl, { raw }, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            proxy: false
        });

        return { success: true, messageId: result.id };
    }
};

module.exports = GmailService;
