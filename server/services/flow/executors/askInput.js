
const whatsappService = require('../../whatsappService');
const validators = require('../validators');

class AskInputExecutor {
    async execute(session, node, context) {
        const { user_id, contact_phone } = session;

        // Check if we are in a retry/error state
        // The validator/engine might have set a temporary flag in variables or checking the last response status
        const nodeState = context[node.id] || {};

        // If this is the FIRST execution, initialize retry count
        if (nodeState.retriesRemaining === undefined && node.data.retryCount !== undefined) {
            // We can't easily mutate context here without returning it, 
            // but FlowEngine merges the return value if we return keys? 
            // Actually FlowEngine logic for merging return values is usually for Pause/Delay meta-actions.
            // We'll rely on the Engine to init this or we infer it.
        }

        let messageToSend = node.data.text;

        if (nodeState.validationError && nodeState.status !== 'failed') {
            messageToSend = node.data.errorMessage || "Invalid input, please try again.";
        }

        if (messageToSend) {
            await whatsappService.sendMessage(user_id, contact_phone, 'text', { body: messageToSend });
        }

        // Calculate Timeout
        let timeoutAt = undefined;
        let ms = 0;
        const { ifUnresponsive, timeout, timeoutUnit } = node.data;

        if (ifUnresponsive && timeout) {
            // Default 15 minutes if something is wrong
            let duration = parseInt(timeout) || 15;
            let multiplier = 60 * 1000; // Minutes

            const unit = (timeoutUnit || 'Minutes').toLowerCase().trim();
            if (unit.startsWith('second')) multiplier = 1000;
            if (unit.startsWith('minute')) multiplier = 60 * 1000;
            if (unit.startsWith('hour')) multiplier = 60 * 60 * 1000;
            if (unit.startsWith('day')) multiplier = 24 * 60 * 60 * 1000;

            ms = duration * multiplier;
            if (ms > 0) {
                timeoutAt = new Date(Date.now() + ms).toISOString();
            }
        }

        return {
            __action: 'PAUSE',
            status: 'waiting_input',
            question: messageToSend,
            timestamp: new Date().toISOString(),
            timeoutAt: timeoutAt,
            timeoutMessage: node.data.timeoutMessage || ''
        };
    }

    async validate(session, node, input) {
        const validation = validators.validate(input, node.data);
        if (validation.valid) {
            return { valid: true };
        }

        // Handle Invalid
        // session.variables contains the merged context (current turn data)
        const context = session.variables || {};
        const nodeState = context[node.id] || {};

        console.log(`[AskInput] Validation failed for node ${node.id}. Current State:`, JSON.stringify(nodeState));

        // Use 'retryAttempts' (count up) instead of 'retriesRemaining' (count down) for better stability
        // If state was not persisted, this will reset to 0, causing the infinite loop issue.
        let attempts = parseInt(nodeState.retryAttempts) || 0;
        const maxRetries = parseInt(node.data.retryCount) || 0;

        console.log(`[AskInput] Retry Check: Attempts ${attempts} / Max ${maxRetries}`);

        if (attempts < maxRetries) {
            attempts++;
            return {
                valid: false,
                action: 'RETRY',
                updates: {
                    [node.id]: { ...nodeState, retryAttempts: attempts, validationError: true }
                }
            };
        } else {
            // Failed
            console.log(`[AskInput] Max retries reached.`);
            return {
                valid: false,
                action: 'INVALID', // New action to signal exhaustion of retries but flow can continue via 'invalid' edge
                updates: {
                    [node.id]: { ...nodeState, retryAttempts: attempts, validationError: false, status: 'failed' }
                }
            };
        }
    }
}

module.exports = new AskInputExecutor();
