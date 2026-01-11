const whatsappService = require('../../whatsappService');

class TextMessageExecutor {
    async execute(session, node, context) {
        console.log(`[TextMessageExecutor] Executing node ${node.id}`);
        const { user_id, contact_phone } = session;

        // Ensure we handle both "message" (from user's JSON) and potentially other field names if they change
        const message = node.data.message || node.data.text || node.data.body;

        console.log(`[TextMessageExecutor] Content to send: "${message}"`);

        if (!message) {
            console.warn(`[TextMessageExecutor] No message content found in node data:`, node.data);
            return { status: 'skipped', reason: 'empty_message' };
        }

        try {
            console.log(`[TextMessageExecutor] Sending WhatsApp message to ${contact_phone}...`);
            const response = await whatsappService.sendMessage(user_id, contact_phone, 'text', { body: message });
            console.log(`[TextMessageExecutor] Message sent successfully. ID: ${response?.messages?.[0]?.id}`);

            return {
                status: 'sent',
                messageId: response?.messages?.[0]?.id,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error(`[TextMessageExecutor] Failed to send message:`, error.message);
            throw error;
        }
    }
}

module.exports = new TextMessageExecutor();
