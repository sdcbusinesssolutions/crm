const whatsappService = require('../../whatsappService');

class AskAnythingExecutor {
    async execute(session, node, context) {
        const { user_id, contact_phone } = session;
        const question = node.data.text;

        // 1. Send the Question
        if (question) {
            await whatsappService.sendMessage(user_id, contact_phone, 'text', { body: question });
        }

        // Calculate Timeout if enabled
        const timeoutUtils = require('../timeoutUtils');
        const timeoutAt = timeoutUtils.calculateTimeoutAt(node.data);

        if (timeoutAt) {
            console.log(`[AskAnythingExecutor] Timeout set. Expires at: ${timeoutAt}`);
        }

        // 2. Return Special Status to Pause Flow
        return {
            __action: 'PAUSE', // Signal to Engine
            status: 'waiting_input',
            question: question,
            timestamp: new Date().toISOString(),
            timeoutAt: timeoutAt
        };
    }
}

module.exports = new AskAnythingExecutor();
