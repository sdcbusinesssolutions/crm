const GmailService = require('../../GmailService');

module.exports = {
    async execute(session, node, context) {
        const { connectionId, to, subject, body } = node.data;
        const userId = session.user_id;

        if (!connectionId) {
            console.error('[Gmail Executor] No connection ID provided');
            return { success: false, error: 'No connection ID' };
        }

        try {
            console.log(`[Gmail Executor] Sending email to ${to}`);
            const result = await GmailService.sendEmail(userId, connectionId, to, subject, body);
            // Branch to TRUE
            return { success: true, outcome: 'true', ...result };
        } catch (error) {
            console.error('[Gmail Executor] Failed:', error);
            // Branch to FALSE
            return { success: false, outcome: 'false', error: error.message };
        }
    }
};
