const whatsappService = require('../../whatsappService');
const axios = require('axios');

module.exports = {
    async execute(session, node, context) {
        const { user_id, contact_phone } = session;
        const { body, displayText, url, footer, headerType, headerText, headerUrl } = node.data;

        const interactive = {
            type: 'cta_url',
            body: {
                text: body
            },
            action: {
                name: 'cta_url',
                parameters: {
                    display_text: displayText,
                    url: url
                }
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
                // Image MUST use link for cta_url
                interactive.header.image = {
                    link: headerUrl
                };
            } else if (type === 'document') {
                // Document usually works best with link, but we could try upload if needed. 
                // For now, stick to link as it's safer for cta_url.
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

        return {
            status: 'sent',
            timestamp: new Date().toISOString()
        };
    }
};
