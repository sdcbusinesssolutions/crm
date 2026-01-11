const whatsappService = require('../../whatsappService');

class MediaMessageExecutor {
    async execute(session, node, context) {
        console.log(`[MediaMessageExecutor] Executing node ${node.id}`);
        const { user_id, contact_phone } = session;

        // Extract media details from node data
        const { url, mediaType, caption, filename } = node.data;

        console.log(`[MediaMessageExecutor] Sending ${mediaType} to ${contact_phone}. URL: ${url}`);

        if (!url) {
            console.warn(`[MediaMessageExecutor] No media URL found in node data:`, node.data);
            return { status: 'skipped', reason: 'empty_url' };
        }

        try {
            let type = 'image'; // Default
            let payload = { link: url };

            // Map node mediaType to WhatsApp API type
            switch (mediaType?.toLowerCase()) {
                case 'image':
                    type = 'image';
                    if (caption) payload.caption = caption;
                    break;
                case 'video':
                    type = 'video';
                    if (caption) payload.caption = caption;
                    break;
                case 'document':
                    type = 'document';
                    if (caption) payload.caption = caption;
                    if (filename) payload.filename = filename;
                    break;
                case 'audio':
                    type = 'audio';
                    break;
                default:
                    console.warn(`[MediaMessageExecutor] Unknown media type: ${mediaType}. Defaulting to image.`);
                    type = 'image';
                    if (caption) payload.caption = caption;
            }

            console.log(`[MediaMessageExecutor] Sending WhatsApp ${type} message...`);
            const response = await whatsappService.sendMessage(user_id, contact_phone, type, payload);
            console.log(`[MediaMessageExecutor] Message sent successfully. ID: ${response?.messages?.[0]?.id}`);

            return {
                status: 'sent',
                messageId: response?.messages?.[0]?.id,
                timestamp: new Date().toISOString(),
                mediaType: type,
                url: url
            };
        } catch (error) {
            console.error(`[MediaMessageExecutor] Failed to send message:`, error.message);
            throw error;
        }
    }
}

module.exports = new MediaMessageExecutor();
