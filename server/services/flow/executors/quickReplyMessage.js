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
        const timeoutUtils = require('../timeoutUtils');
        const timeoutAt = timeoutUtils.calculateTimeoutAt(node.data);

        if (timeoutAt) {
            console.log(`[QuickReplyExecutor] Timeout set. Expires at: ${timeoutAt}`);
        }

        return {
            status: 'sent',
            timestamp: new Date().toISOString(),
            timeoutAt: timeoutAt,
            __action: 'PAUSE' // Quick Reply waits for user input (button click)
        };
    }
};
