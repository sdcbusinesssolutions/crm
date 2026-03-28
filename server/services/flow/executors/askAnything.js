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

        if (ifUnresponsive) {
            if (unresponsiveTimeout) {
                const str = unresponsiveTimeout.toLowerCase().trim();
                const match = str.match(/^([\d.]+)\s*([a-z]*)$/);
                
                if (match) {
                    const val = parseFloat(match[1]);
                    let unit = match[2] || 'min';
                    let ms = 0;

                    if (!isNaN(val)) {
                        if (unit.startsWith('sec')) ms = val * 1000;
                        else if (unit.startsWith('min')) ms = val * 60 * 1000;
                        else if (unit.startsWith('hour') || unit.startsWith('hr')) ms = val * 60 * 60 * 1000;
                        else if (unit.startsWith('day')) ms = val * 24 * 60 * 60 * 1000;
                        else ms = val * 60 * 1000; // Default to min
                    }

                    if (ms > 0) {
                        timeoutAt = new Date(Date.now() + ms).toISOString();
                        console.log(`[AskAnythingExecutor] Timeout set for ${ms}ms. Expires at: ${timeoutAt}`);
                    }
                }
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
