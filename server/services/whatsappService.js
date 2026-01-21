const axios = require('axios');
const { supabase, supabaseAdmin } = require('../lib/supabaseClient');
const FormData = require('form-data'); // Ensure FormData is available for Node.js
const { logInboxMessage } = require('../utils/logger');

class WhatsAppService {
    constructor() {
        this.baseUrl = 'https://graph.facebook.com/v21.0';
    }

    /**
     * Get WhatsApp Config for a User
     * Uses the RPC function to bypass RLS.
     */
    async getConfig(userId, phoneNumberId = null) {
        // Use RPC to bypass RLS and get config
        const { data, error } = await supabase.rpc('get_whatsapp_config', {
            p_user_id: userId,
            p_phone_number_id: phoneNumberId
        });

        if (error || !data || (Array.isArray(data) && data.length === 0)) {
            console.error('Error fetching WhatsApp config:', error);
            throw new Error('WhatsApp configuration not found for this user.');
        }

        // Handle potential array return from RPC
        const config = Array.isArray(data) ? data[0] : data;
        return config;
    }

    /**
     * Send a Message
     * @param {string} userId - The system user ID
     * @param {string} to - Recipient phone number
     * @param {string} type - Message type (text, image, video, document, template, etc.)
     * @param {object} content - Content object (text body, media url/id, template details)
     * @param {string} [phoneNumberId] - Optional specific phone number ID to send from
     */
    async sendMessage(userId, to, type, content, phoneNumberId = null, skipDBLog = false) {
        try {
            const config = await this.getConfig(userId, phoneNumberId);
            const fromPhoneId = config.phone_number_id;
            const accessToken = config.meta_access_token;

            const url = `${this.baseUrl}/${fromPhoneId}/messages`;

            const body = {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: to,
                type: type
            };

            // Construct body based on type
            switch (type) {
                case 'text':
                    body.text = { body: content.body || content };
                    break;
                case 'image':
                case 'video':
                case 'audio':
                case 'document':
                case 'sticker':
                    body[type] = {};
                    if (content.id) {
                        body[type].id = content.id;
                    } else if (content.link) {
                        body[type].link = content.link;
                    } else {
                        throw new Error(`Missing 'id' or 'link' for ${type} message.`);
                    }

                    if (content.caption) body[type].caption = content.caption;
                    if (content.filename) body[type].filename = content.filename;
                    break;
                case 'template':
                    body.template = content; // Expects full template object { name, language, components }
                    break;
                case 'interactive':
                    body.interactive = content;
                    break;
                case 'location':
                    body.location = content;
                    break;
                case 'contacts':
                    body.contacts = content;
                    break;
                default:
                    throw new Error(`Unsupported message type: ${type}`);
            }

            console.log(`Sending ${type} message to ${to}...`);
            console.log('Final WhatsApp Payload:', JSON.stringify(body, null, 2));

            const response = await axios.post(url, body, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('WhatsApp API Response:', JSON.stringify(response.data, null, 2));

            // Fetch actual phone number for logging
            let fromPhone = fromPhoneId; // Default
            let logWhatsappNumber = 'Unknown';

            try {
                const { data: phoneData } = await supabaseAdmin
                    .from('whatsapp_config')
                    .select('phone_number')
                    .eq('phone_number_id', fromPhoneId)
                    .maybeSingle();

                if (phoneData?.phone_number) {
                    fromPhone = phoneData.phone_number;
                    logWhatsappNumber = phoneData.phone_number;
                }
            } catch (e) { }

            // --- LOG TO FILE (INBOX LOGGER) ---
            try {
                const { logInboxMessage } = require('../utils/logger');
                logInboxMessage('OUT_MESSAGE', {
                    from: fromPhone,
                    to: to,
                    type: type,
                    phoneNumberId: fromPhoneId,
                    whatsappNumber: logWhatsappNumber,
                    content: content,
                    waMessageId: response.data.messages?.[0]?.id
                    // timestamp injected by logger
                });
            } catch (logErr) { console.error('Inbox Out Log Error:', logErr); }

            // --- LOGGING ---
            const waMessageId = response.data.messages?.[0]?.id;
            if (waMessageId && !skipDBLog) {
                // Run asynchronously to not block return
                this.logOutboundMessage(userId, to, type, content, 'sent', waMessageId).catch(err => {
                    console.error('Background logging failed:', err);
                });
            }

            return response.data;

        } catch (error) {
            console.error('WhatsAppService Send Error:', JSON.stringify(error.response?.data || error.message, null, 2));
            throw new Error(error.response?.data?.error?.message || error.message);
        }
    }

    /**
     * Log Outbound Message to Database
     * Uses supabaseAdmin to bypass RLS
     */
    async logOutboundMessage(userId, to, type, content, status, whatsappMessageId) {
        try {
            const rpcClient = supabaseAdmin || supabase;

            // Prepare Message Data
            let textBody = null;
            let mediaUrl = null;

            if (type === 'text') textBody = typeof content === 'string' ? content : (content.body || '');
            else if (type === 'interactive') textBody = JSON.stringify(content);
            else if (type === 'template') textBody = JSON.stringify(content);
            else if (['image', 'video', 'document'].includes(type)) {
                mediaUrl = content.link || null;
                textBody = content.caption || null;
            }

            // Call RPC to log message (Bypasses RLS)
            // Ensure phone number format (remove non-digits)
            const cleanPhone = to.replace(/\D/g, '');
            const { data: messageId, error } = await rpcClient.rpc('log_outbound_message', {
                p_user_id: userId,
                p_contact_phone: cleanPhone,
                p_message_type: type,
                p_message_text: textBody,
                p_media_url: mediaUrl,
                p_status: status,
                p_whatsapp_message_id: whatsappMessageId
            });

            if (error) {
                console.error('Error logging outbound message via RPC:', error);
            } else {
                console.log(`Logged outbound ${type} message to DB (ID: ${whatsappMessageId})`);
            }

        } catch (err) {
            console.error('Exception logging outbound message:', err);
        }
    }

    /**
     * Upload Media to WhatsApp (for sending)
     * @param {string} userId 
     * @param {Buffer} fileBuffer 
     * @param {string} mimeType 
     * @param {string} filename 
     */
    async uploadMediaToWhatsApp(userId, fileBuffer, mimeType, filename) {
        try {
            const config = await this.getConfig(userId);
            const fromPhoneId = config.phone_number_id;
            const accessToken = config.meta_access_token;

            const url = `${this.baseUrl}/${fromPhoneId}/media`;

            console.log(`Uploading media: ${filename} (${mimeType})`);

            const formData = new FormData();
            formData.append('file', fileBuffer, { filename: filename, contentType: mimeType });
            formData.append('messaging_product', 'whatsapp');

            const response = await axios.post(url, formData, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    ...formData.getHeaders()
                }
            });

            console.log('Media Upload Success. ID:', response.data.id);
            return response.data.id; // Returns Media ID
        } catch (error) {
            console.error('WhatsAppService Upload Error:', error.response?.data || error.message);
            throw error;
        }
    }
    /**
     * Mark a message as read
     * @param {string} userId 
     * @param {string} messageId - WhatsApp Message ID (wamid)
     */
    async markAsRead(userId, messageId) {
        try {
            const config = await this.getConfig(userId);
            const fromPhoneId = config.phone_number_id;
            const accessToken = config.meta_access_token;

            const url = `${this.baseUrl}/${fromPhoneId}/messages`;

            const body = {
                messaging_product: 'whatsapp',
                status: 'read',
                message_id: messageId
            };

            await axios.post(url, body, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log(`Message ${messageId} marked as read.`);
            return true;
        } catch (error) {
            const errorData = error.response?.data?.error;
            // Suppress "Message does not exist" errors (Code 100) which happen for old messages
            if (errorData && (errorData.code === 100 || (errorData.message && errorData.message.includes('(#100)')))) {
                console.warn(`[WhatsAppService] Skipped marking old message as read: ${messageId} (Code 100)`);
                return false;
            }

            console.error('WhatsAppService MarkRead Error:', error.response?.data || error.message);
            // Don't throw, just log, as this is a background action
            return false;
        }
    }
}

module.exports = new WhatsAppService();
