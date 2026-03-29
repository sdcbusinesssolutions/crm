const whatsappService = require('../../whatsappService');

module.exports = {
    async execute(session, node, context) {
        const { user_id, contact_phone } = session;
        const { header, body, footer, buttonText, sections } = node.data;

        const interactive = {
            type: 'list',
            header: {
                type: 'text',
                text: header
            },
            body: {
                text: body
            },
            footer: {
                text: footer
            },
            action: {
                button: buttonText || 'Menu',
                sections: (() => {
                    let remaining = 10;
                    const validSections = [];

                    // 1. Process Dynamic Sections if provided
                    if (node.data.dynamicSections) {
                        let dynamicData = null;

                        // Check if it's already an array (Resolved by engine)
                        if (Array.isArray(node.data.dynamicSections)) {
                            dynamicData = node.data.dynamicSections;
                        }
                        // Check if it's a string that needs resolution
                        else if (typeof node.data.dynamicSections === 'string') {
                            const rawStr = node.data.dynamicSections.trim();
                            if (rawStr.startsWith('{{') && rawStr.endsWith('}}')) {
                                let varName = rawStr.replace(/{{|}}/g, '').trim();
                                const traverse = (obj, path) => {
                                    if (!obj || !path) return undefined;
                                    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
                                };
                                dynamicData = traverse(session.variables, varName);
                            } else {
                                // Try parsing as JSON (e.g. if engine resolved it to a stringified array)
                                try {
                                    const parsed = JSON.parse(rawStr);
                                    if (Array.isArray(parsed)) dynamicData = parsed;
                                } catch (e) { /* Must be just a string, ignore */ }
                            }
                        }

                        if (Array.isArray(dynamicData)) {
                            for (const section of dynamicData) {
                                if (remaining <= 0) break;

                                const rows = (section.rows || []).slice(0, remaining).map(item => ({
                                    id: item.id,
                                    title: item.title,
                                    description: item.description
                                }));

                                if (rows.length > 0) {
                                    validSections.push({
                                        title: section.title || 'Dynamic Section',
                                        rows: rows
                                    });
                                    remaining -= rows.length;
                                }
                            }
                        }
                    }

                    // 2. Process Manual Sections
                    for (const section of (sections || [])) {
                        if (remaining <= 0) break;

                        const rows = (section.items || []).slice(0, remaining).map(item => ({
                            id: item.id,
                            title: item.title,
                            description: item.description
                        }));

                        if (rows.length > 0) {
                            validSections.push({
                                title: section.title,
                                rows: rows
                            });
                            remaining -= rows.length;
                        }
                    }
                    return validSections;
                })()
            }
        };

        // Remove header if empty
        if (!header) {
            delete interactive.header;
        }

        // Remove footer if empty
        if (!footer) {
            delete interactive.footer;
        }

        await whatsappService.sendMessage(user_id, contact_phone, 'interactive', interactive);

        // Calculate Timeout if enabled
        const timeoutUtils = require('../timeoutUtils');
        const timeoutAt = timeoutUtils.calculateTimeoutAt(node.data);

        if (timeoutAt) {
            console.log(`[ListMessageExecutor] Timeout set. Expires at: ${timeoutAt}`);
        }

        return {
            status: 'sent',
            timestamp: new Date().toISOString(),
            timeoutAt: timeoutAt,
            __action: 'PAUSE' // List Message waits for user input (selection)
        };
    }
};
