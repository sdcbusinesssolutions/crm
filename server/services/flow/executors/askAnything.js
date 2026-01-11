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
        let timeoutAt = undefined;
        const { ifUnresponsive, unresponsiveTimeout } = node.data;

        if (ifUnresponsive && unresponsiveTimeout) {
            const [valStr, unit] = unresponsiveTimeout.split(' ');
            const val = parseFloat(valStr);
            let ms = 0;
            if (!isNaN(val)) {
                if (unit.toLowerCase().includes('min')) ms = val * 60 * 1000;
                else if (unit.toLowerCase().includes('hr')) ms = val * 60 * 60 * 1000;
                else if (unit.toLowerCase().includes('day')) ms = val * 24 * 60 * 60 * 1000;
                else ms = val * 60 * 1000; // Default to min
            }

            if (ms > 0) {
                timeoutAt = new Date(Date.now() + ms).toISOString();
                console.log(`[AskAnythingExecutor] Timeout set for ${ms}ms. Expires at: ${timeoutAt}`);
            }
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
