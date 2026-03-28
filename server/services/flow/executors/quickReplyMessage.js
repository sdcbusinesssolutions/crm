const whatsappService = require('../../whatsappService');

module.exports = {
    async execute(session, node, context) {
        const { user_id, contact_phone } = session;
        const { body, buttons, footer, headerType, headerText, headerUrl } = node.data;

        const interactive = {
            type: 'button',
            body: {
                text: body
            },
            action: {
                buttons: (buttons || []).map(btn => ({
                    type: 'reply',
                    reply: {
                        id: btn.id,
                        title: btn.title
                    }
                }))
            }
        };

        if (footer) {
            interactive.footer = {
                text: footer
            };
        }

        if (headerType && headerType !== 'None') {
            const type = headerType.toLowerCase();
            interactive.header = {
                type: type
            };

            if (type === 'text') {
                interactive.header.text = headerText;
            } else if (type === 'image') {
                interactive.header.image = {
                    link: headerUrl
                };
            } else if (type === 'document') {
                interactive.header.document = {
                    link: headerUrl
                };
            } else if (type === 'video') {
                interactive.header.video = {
                    link: headerUrl
                };
            }
        }

        await whatsappService.sendMessage(user_id, contact_phone, 'interactive', interactive);

        // Calculate Timeout if enabled
        let timeoutAt = undefined;
        const { ifUnresponsive, unresponsiveTimeout } = node.data;

        if (ifUnresponsive && unresponsiveTimeout) {
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
                    console.log(`[QuickReplyExecutor] Timeout set for ${ms}ms. Expires at: ${timeoutAt}`);
                }
            }
        }

        return {
            status: 'sent',
            timestamp: new Date().toISOString(),
            timeoutAt: timeoutAt,
            __action: 'PAUSE' // Quick Reply waits for user input (button click)
        };
    }
};
