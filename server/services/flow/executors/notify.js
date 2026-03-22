const whatsappService = require('../../whatsappService');
const contextManager = require('../context');

/**
 * Notify Executor
 * Sends a message (Text or Template) to specified mobile numbers.
 * Supports multiple numbers (comma-separated).
 */
module.exports = {
    async execute(session, node, context) {
        const { user_id } = session;
        const {
            mobileNumbers,
            notificationType,
            message,
            templateName,
            language,
            variableMapping,
            templateId
        } = node.data;

        console.log(`[NotifyExecutor] Executing node ${node.id} for node type ${node.type}`);

        if (!mobileNumbers) {
            console.warn(`[NotifyExecutor] No mobile numbers found in node ${node.id}`);
            return { status: 'skipped', reason: 'no_numbers' };
        }

        // Parse numbers: split by comma, remove whitespace, ensure country code (remove non-digits)
        const rawNumbers = String(mobileNumbers).split(',');
        const numbers = [];

        for (const raw of rawNumbers) {
            // Resolve variables in number (e.g. {{contact.phone}})
            const resolved = contextManager.resolve(raw.trim(), context);
            const clean = resolved.replace(/\D/g, '');
            if (clean.length >= 10) {
                numbers.push(clean);
            }
        }

        if (numbers.length === 0) {
            console.warn(`[NotifyExecutor] No valid mobile numbers after parsing/resolution: ${mobileNumbers}`);
            return { status: 'skipped', reason: 'invalid_numbers' };
        }

        const results = [];

        for (const to of numbers) {
            try {
                if (notificationType === 'Template') {
                    // Logic to build template payload
                    const components = [];
                    const resolvedMapping = {};
                    
                    if (variableMapping) {
                        for (const [key, val] of Object.entries(variableMapping)) {
                            resolvedMapping[key] = contextManager.resolve(String(val || ''), context);
                        }
                    }

                    const params = [];
                    // WhatsApp Template Variables are usually {{1}}, {{2}}, etc.
                    // We check for numeric keys first.
                    const numericKeys = Object.keys(resolvedMapping).filter(k => /^\d+$/.test(k)).map(Number).sort((a, b) => a - b);
                    
                    if (numericKeys.length > 0) {
                        // Fill parameters based on numeric order
                        const maxIndex = Math.max(...numericKeys);
                        for (let i = 1; i <= maxIndex; i++) {
                            params.push({
                                type: 'text',
                                text: resolvedMapping[String(i)] || ''
                            });
                        }
                    } else {
                        // Fallback to named variables if no numbers found
                        for (const [key, val] of Object.entries(resolvedMapping)) {
                            params.push({
                                type: 'text',
                                text: String(val || '')
                            });
                        }
                    }

                    if (params.length > 0) {
                        components.push({
                            type: 'body',
                            parameters: params
                        });
                    }

                    const content = {
                        name: templateName,
                        language: { code: language },
                        components: components
                    };

                    console.log(`[NotifyExecutor] Sending Template '${templateName}' to ${to}`);
                    const response = await whatsappService.sendMessage(user_id, to, 'template', content);
                    results.push({ to, status: 'sent', messageId: response?.messages?.[0]?.id });

                } else {
                    // Text Message
                    const resolvedMessage = contextManager.resolve(message || '', context);
                    console.log(`[NotifyExecutor] Sending Text to ${to}: "${resolvedMessage}"`);
                    const response = await whatsappService.sendMessage(user_id, to, 'text', { body: resolvedMessage });
                    results.push({ to, status: 'sent', messageId: response?.messages?.[0]?.id });
                }
            } catch (err) {
                console.error(`[NotifyExecutor] Failed to send to ${to}:`, err.message);
                results.push({ to, status: 'failed', error: err.message });
            }
        }

        return {
            status: 'completed',
            results,
            timestamp: new Date().toISOString()
        };
    }
};
