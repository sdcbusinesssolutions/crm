const { supabaseAdmin } = require('../lib/supabaseClient');
const { google } = require('googleapis');

const GmailService = {
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
        const creds = integration.credentials;
        const oauth2Client = new google.auth.OAuth2(
            creds.params_client_id || process.env.GOOGLE_CLIENT_ID,
            creds.params_client_secret || process.env.GOOGLE_CLIENT_SECRET,
            creds.params_redirect_url || process.env.GOOGLE_REDIRECT_URL
        );

        oauth2Client.setCredentials(creds);

        // 3. Send Email
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        // helper to encode
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

        const result = await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: raw,
            },
        });

        return { success: true, messageId: result.data.id };
    }
};

module.exports = GmailService;
