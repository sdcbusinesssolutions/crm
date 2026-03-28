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

        // Resolve variables in numbers (handles both literal comma-separated lists and resolved variables containing commas)
        const resolvedInput = contextManager.resolve(String(mobileNumbers).trim(), context);
        console.log(`[NotifyExecutor] Resolved Mobile Numbers Input: "${resolvedInput}"`);

        // Parse numbers: split by comma, remove whitespace, ensure country code (remove non-digits)
        const numbers = resolvedInput.split(',')
            .map(n => n.trim().replace(/\D/g, ''))
            .filter(n => n.length >= 10)
            .slice(0, 4); // ABSOLUTE LIMIT: MAX 4 NUMBERS

        if (numbers.length === 0) {
            console.warn(`[NotifyExecutor] No valid mobile numbers found after parsing: "${resolvedInput}" (Original: "${mobileNumbers}")`);
            return { status: 'skipped', outcome: 'false', reason: 'invalid_numbers' };
        }

        console.log(`[NotifyExecutor] Sending notification to ${numbers.length} numbers:`, numbers);

        const results = [];
        let anySuccess = false;

        for (const to of numbers) {
            try {
                if (notificationType === 'Template') {
                    const {
                        mediaUrl,
                        carouselMediaUrls,
                        variableMapping,
                        templateName,
                        language,
                        components: nodeComponents
                    } = node.data;

                    const components = [];
                    const templateComponents = nodeComponents || [];

                    // --- HEADER ---
                    const headerComp = templateComponents.find(c => c.type === 'HEADER');
                    if (headerComp) {
                        if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerComp.format)) {
                            const mediaType = headerComp.format.toLowerCase();
                            const param = { type: mediaType };
                            if (mediaUrl) {
                                param[mediaType] = { link: mediaUrl };
                            }
                            components.push({
                                type: 'header',
                                parameters: [param]
                            });
                        } else if (headerComp.format === 'TEXT' && headerComp.text && headerComp.text.match(/{{/)) {
                            // Text Header with Variables
                            const hText = headerComp.text;
                            const hParams = [];
                            const hMatches = hText.match(/{{([a-zA-Z0-9_]+)}}/g);
                            if (hMatches) {
                                hMatches.forEach(match => {
                                    const varName = match.replace(/{{|}}/g, '');
                                    const rawVal = variableMapping ? variableMapping[varName] : '';
                                    const resolvedVal = contextManager.resolve(String(rawVal || ''), context);
                                    hParams.push({ type: 'text', text: resolvedVal });
                                });
                            }
                            if (hParams.length > 0) {
                                components.push({ type: 'header', parameters: hParams });
                            }
                        }
                    }

                    // --- BODY ---
                    const bodyComp = templateComponents.find(c => c.type === 'BODY');
                    if (bodyComp && bodyComp.text) {
                        const bodyText = bodyComp.text;
                        const params = [];
                        const matches = bodyText.match(/{{([0-9]+)}}/g);
                        let maxIndex = 0;
                        if (matches) {
                            matches.forEach(m => {
                                const num = parseInt(m.replace(/{{|}}/g, ''));
                                if (num > maxIndex) maxIndex = num;
                            });
                        }

                        if (maxIndex > 0 && variableMapping) {
                            for (let i = 1; i <= maxIndex; i++) {
                                const rawVal = variableMapping[String(i)];
                                const resolvedVal = contextManager.resolve(String(rawVal !== undefined && rawVal !== null ? rawVal : ''), context);
                                params.push({ type: 'text', text: resolvedVal });
                            }
                        } else {
                            // Fallback for named variables
                            const namedMatches = bodyText.match(/{{([a-zA-Z_]+)}}/g);
                            if (namedMatches) {
                                namedMatches.forEach(match => {
                                    const varName = match.replace(/{{|}}/g, '');
                                    const rawVal = variableMapping ? variableMapping[varName] : '';
                                    const resolvedVal = contextManager.resolve(String(rawVal || ''), context);
                                    params.push({ type: 'text', text: resolvedVal });
                                });
                            }
                        }
                        if (params.length > 0) {
                            components.push({ type: 'body', parameters: params });
                        }
                    }

                    // --- BUTTONS ---
                    const buttonsComp = templateComponents.find(c => c.type === 'BUTTONS');
                    if (buttonsComp && buttonsComp.buttons) {
                        buttonsComp.buttons.forEach((btn, idx) => {
                            if (btn.type === 'URL' && btn.url && btn.url.includes('{{')) {
                                const uMatches = btn.url.match(/{{([a-zA-Z0-9_]+)}}/g);
                                if (uMatches) {
                                    const bParams = [];
                                    uMatches.forEach(m => {
                                        const vName = m.replace(/{{|}}/g, '');
                                        const val = variableMapping ? variableMapping[vName] : '';
                                        const resolvedVal = contextManager.resolve(String(val || ''), context);
                                        bParams.push({ type: 'text', text: resolvedVal });
                                    });
                                    if (bParams.length > 0) {
                                        components.push({ type: 'button', sub_type: 'url', index: idx, parameters: bParams });
                                    }
                                }
                            }
                        });
                    }

                    // --- CAROUSEL ---
                    const carouselComp = templateComponents.find(c => c.type === 'CAROUSEL');
                    if (carouselComp && carouselComp.cards) {
                        const cards = carouselComp.cards.map((card, index) => {
                            const cardComponents = [];
                            const cardHeader = card.components.find(c => c.type === 'HEADER');
                            if (cardHeader && (cardHeader.format === 'IMAGE' || cardHeader.format === 'VIDEO')) {
                                const mediaType = cardHeader.format.toLowerCase();
                                const url = carouselMediaUrls && carouselMediaUrls[index];
                                if (url) {
                                    cardComponents.push({ type: 'header', parameters: [{ type: mediaType, [mediaType]: { link: url } }] });
                                }
                            }
                            return { card_index: index, components: cardComponents };
                        });
                        components.push({ type: 'carousel', cards: cards });
                    }

                    const content = {
                        name: templateName,
                        language: { code: language },
                        components: components
                    };

                    console.log(`[NotifyExecutor] Sending Template Payload to ${to}:`, JSON.stringify(content, null, 2));
                    const response = await whatsappService.sendMessage(user_id, to, 'template', content);
                    results.push({ to, status: 'sent', messageId: response?.messages?.[0]?.id });
                    anySuccess = true;
                } else {
                    // Text Message
                    const resolvedMessage = contextManager.resolve(message || '', context);
                    console.log(`[NotifyExecutor] Sending Text to ${to}: "${resolvedMessage}"`);
                    const response = await whatsappService.sendMessage(user_id, to, 'text', { body: resolvedMessage });
                    results.push({ to, status: 'sent', messageId: response?.messages?.[0]?.id });
                    anySuccess = true;
                }
            } catch (err) {
                console.error(`[NotifyExecutor] Failed to send to ${to}:`, err.message);
                results.push({ to, status: 'failed', error: err.message });
            }
        }

        return {
            status: 'completed',
            outcome: anySuccess ? 'true' : 'false',
            results,
            timestamp: new Date().toISOString()
        };
    }
};
