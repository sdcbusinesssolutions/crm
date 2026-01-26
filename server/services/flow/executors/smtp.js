const SmtpService = require('../../SmtpService');

module.exports = {
    async execute(session, node, context) {
        const { connectionId, to, subject, body } = node.data;

        // SMTP uses connectionId to look up credentials in the SmtpService (or routes/integrations)
        // Actually, sendEmail in SmtpService (as written in previous steps) expects a CONFIG object, 
        // OR we need to fetch the config from DB using connectionId.

        // Let's check how SmtpService.sendEmail is implemented. 
        // In Step 162: sendEmail(config, fromEmail, to, subject, html)
        // It requires the 'config' object, not connectionId. 

        // So this executor needs to:
        // 1. Fetch the connection credentials from DB.
        // 2. Call SmtpService.sendEmail.

        const { supabaseAdmin } = require('../../../lib/supabaseClient');

        if (!connectionId) {
            console.error('[SMTP Executor] No connection ID provided');
            return { success: false, outcome: 'false', error: 'No connection ID' };
        }

        try {
            // Fetch connection details
            const { data: integration, error } = await supabaseAdmin
                .from('user_integrations')
                .select('*')
                .eq('id', connectionId)
                .single();

            if (error || !integration) {
                console.error('[SMTP Executor] Connection not found');
                return { success: false, outcome: 'false', error: 'Connection not found' };
            }

            const creds = integration.credentials;
            // Config object for SmtpService
            const config = {
                host: creds.host,
                port: creds.port,
                user: creds.user,
                pass: creds.pass,
                encryption: creds.encryption
            };

            console.log(`[SMTP Executor] Sending email to ${to} via ${config.host}`);

            const result = await SmtpService.sendEmail(config, creds.fromEmail, to, subject, body);

            // Branch to TRUE if success
            return { success: true, outcome: 'true', ...result };

        } catch (error) {
            console.error('[SMTP Executor] Failed:', error);
            // Branch to FALSE if failure
            return { success: false, outcome: 'false', error: error.message };
        }
    }
};
