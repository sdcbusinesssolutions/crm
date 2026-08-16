const axios = require('axios');
const https = require('https');

// --- Global HTTPS Agent with Keep-Alive ---
// maxSockets: 50 — Balance between performance and connection limits.
// 100 caused ECONNRESET storms. 10 was stable but limited throughput.
const httpsAgent = new https.Agent({
    keepAlive: true,
    maxSockets: 50,       // ✅ Scaled up to 50 for high-traffic servers
    maxFreeSockets: 10,
    timeout: 30000,
    scheduling: 'lifo'
});

const { supabase, supabaseAdmin } = require('../lib/supabaseClient');
const FormData = require('form-data'); // Ensure FormData is available for Node.js
const { logInboxMessage } = require('../utils/logger');
const WalletService = require('./WalletService'); // New: Wallet System

class WhatsAppService {
    constructor() {
        this.version = 'v21.0';
        this.baseUrl = `https://graph.facebook.com/${this.version}`;
    }

    /**
     * Get WhatsApp Config for a User
     * Uses the RPC function to bypass RLS.
     */
    async getConfig(userId, phoneNumberId = null) {
        // First try the standard RPC to bypass RLS
        const { data, error } = await supabase.rpc('get_whatsapp_config', {
            p_user_id: userId,
            p_phone_number_id: phoneNumberId
        });

        if (!error && data && (!Array.isArray(data) || data.length > 0)) {
            return Array.isArray(data) ? data[0] : data;
        }

        console.error('Error fetching WhatsApp config:', error);
        throw new Error('WhatsApp configuration not found for this user.');
    }

    /**
     * Get WhatsApp Config globally by phone_number_id.
     * Use this ONLY for system/admin level messages where the specific user doesn't matter.
     */
    async getGlobalConfig(phoneNumberId) {
        try {
            const { data, error } = await supabaseAdmin
                .from('whatsapp_config')
                .select('meta_access_token, phone_number_id, whatsapp_business_account_id, user_id')
                .eq('phone_number_id', phoneNumberId)
                .limit(1)
                .single();
                
            if (data && data.meta_access_token) {
                return {
                    meta_access_token: data.meta_access_token,
                    phone_number_id: data.phone_number_id,
                    waba_id: data.whatsapp_business_account_id,
                    user_id: data.user_id
                };
            }
        } catch (err) {
            console.error('Error fetching global WhatsApp config:', err.message);
        }
        throw new Error(`Global WhatsApp configuration not found for phone_number_id: ${phoneNumberId}`);
    }

    /**
     * Send a Message
     * @param {string|null} userId - The system user ID (pass null for system-wide messages using global config)
     * @param {string} to - Recipient phone number
     * @param {string} type - Message type (text, image, video, document, template, etc.)
     * @param {object} content - Content object (text body, media url/id, template details)
     * @param {string} [phoneNumberId] - Optional specific phone number ID to send from
     */
    async sendMessage(userId, to, type, content, phoneNumberId = null, skipDBLog = false, options = {}) {
        try {
            if (!userId) {
                throw new Error('Security Exception: userId is strictly required to send messages. Unauthenticated sending is prohibited.');
            }

            // Explicitly fetch config for the provided user to prevent cross-tenant abuse
            const config = await this.getConfig(userId, phoneNumberId);
            
            const fromPhoneId = config.phone_number_id;
            const accessToken = config.meta_access_token;

            // --- OPT-OUT CHECK ---
            try {
                const { data: contactData } = await supabaseAdmin
                    .from('contacts')
                    .select('custom_data')
                    .eq('user_id', userId)
                    .eq('phone', to)
                    .maybeSingle();

                if (contactData && contactData.custom_data && contactData.custom_data.opted_out) {
                    console.warn(`[WhatsAppService] Blocked sending message to ${to}. Contact has opted out.`);
                    return { status: 'skipped', reason: 'opted_out' };
                }
            } catch (optCheckErr) {
                console.error('[WhatsAppService] Error checking opt-out status:', optCheckErr);
            }

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
            }            // 🚀 MARKETING MESSAGES API (MM LITE) OPTIMIZATION
            // Determine if we should use the specialized high-performance endpoint.
            // We prioritize the MM Lite endpoint for templates if they are categorized as MARKETING.
            const templateCategory = content?.category || (type === 'template' && content?.name?.toLowerCase().includes('mkt') ? 'MARKETING' : null);
            const isMarketingTemplate = type === 'template' && templateCategory === 'MARKETING';
            const endpoint = isMarketingTemplate ? 'marketing_messages' : 'messages';
            const url = `${this.baseUrl}/${fromPhoneId}/${endpoint}`;

            // --- PARTNER ATTRIBUTION (MM LITE ONLY) ---
            if (isMarketingTemplate && config.meta_app_id) {
                body.solution_id = config.meta_app_id;
            }

            console.log(`[WhatsAppService] Attempting send via ${endpoint.toUpperCase()} (Type: ${type}, Category: ${templateCategory || 'N/A'}${body.solution_id ? ', Solution: ' + body.solution_id : ''})`);

            // Fetch actual phone number for logging and wallet account ID
            let fromPhone = fromPhoneId; // Default
            let logWhatsappNumber = 'Unknown';
            let waConfigId = null;
            let accountOwnerId = userId;

            try {
                const { data: phoneData } = await supabaseAdmin
                    .from('whatsapp_config')
                    .select('id, phone_number, user_id')
                    .eq('phone_number_id', fromPhoneId)
                    .maybeSingle();

                if (phoneData) {
                    waConfigId = phoneData.id;
                    if (phoneData.phone_number) {
                        fromPhone = phoneData.phone_number;
                        logWhatsappNumber = phoneData.phone_number;
                    }
                    if (phoneData.user_id) {
                        accountOwnerId = phoneData.user_id;
                    }
                }
            } catch (e) { }

            // --- V2 ATOMIC WALLET PRE-DEBIT ---
            // We lock funds BEFORE calling Meta API to prevent double-spend race conditions.
            const walletSource = options.walletSource || 'INBOX_SEND';
            const expectedCategory = (type === 'template') ? (templateCategory || 'MARKETING') : 'SERVICE';
            const tempWaMessageId = `pending_api_${Date.now()}_${Math.random().toString(36).substring(2,9)}`;
            
            let preDebitTxId = null;
            try {
                const preDebitResult = await WalletService.preDebit({
                    userId: accountOwnerId,
                    waMessageId: tempWaMessageId,
                    category: expectedCategory,
                    source: walletSource,
                    contactPhone: to,
                    flowId: options.flowId || null,
                    dripCampaignId: options.dripCampaignId || null,
                    whatsappAccountId: waConfigId || null,
                    createdBy: options.createdBy,
                    ipAddress: options.ipAddress
                });
                preDebitTxId = preDebitResult?.transactionId;
            } catch (err) {
                console.warn(`[WhatsAppService] 🚫 Blocked send to ${to} — PRE-DEBIT FAILED: ${err.message}`);
                // Pass the specific error message (e.g., country blocking) up to the user
                throw new Error(err.message || 'Insufficient Wallet Balance. Top-up required.');
            }

            let response;
            try {
                response = await axios.post(url, body, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    httpsAgent: httpsAgent
                });
            } catch (postErr) {
                const errData = postErr.response?.data?.error;
                console.warn(`[WhatsAppService] ${endpoint.toUpperCase()} call failed: ${errData?.message || postErr.message}`);

                // FALLBACK: If using marketing_messages endpoint and it fails for ANY reason (not ready, permissions, etc.), 
                // we fall back to the standard /messages endpoint to ensure the user receives the message.
                if (endpoint === 'marketing_messages') {
                    console.log(`[WhatsAppService] Fallback: Retrying with standard MESSAGES endpoint...`);
                    // Note: We remove solution_id for regular /messages endpoint if it causes issues, 
                    // though usually it's ignored. Meta docs say it's for MM Lite.
                    const fallbackBody = { ...body };
                    delete fallbackBody.solution_id;

                    response = await axios.post(`${this.baseUrl}/${fromPhoneId}/messages`, fallbackBody, {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json'
                        },
                        httpsAgent: httpsAgent
                    });
                } else {
                    // If it was already the standard endpoint, we throw the error.
                    if (preDebitTxId) await WalletService.refundFailedApiCall(preDebitTxId);
                    throw postErr;
                }
            }

            const waMessageId = response.data.messages?.[0]?.id;
            
            // --- V2 ATOMIC: LINK SUCCESSFUL ID ---
            if (waMessageId && preDebitTxId) {
                await WalletService.updateTransactionMessageId(preDebitTxId, waMessageId);
            }

            console.log('WhatsApp API Response:', JSON.stringify(response.data, null, 2));

            // --- LOG TO FILE (INBOX LOGGER) ---

            try {
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
            // Background logging
            if (waMessageId && !skipDBLog) {
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
            else if (type === 'interactive') {
                textBody = JSON.stringify(content);
                // Extract mediaUrl from interactive header if present
                const header = content.header;
                if (header) {
                    const hType = header.type?.toLowerCase();
                    if (['image', 'video', 'document'].includes(hType) && header[hType]) {
                        mediaUrl = header[hType].link || null;
                    }
                }
            }
            else if (type === 'template') {
                try {
                    const hydrated = await this._hydrateTemplate(content, userId);
                    if (hydrated) content = hydrated;
                } catch (e) { console.warn('Template hydration failed:', e); }
                textBody = JSON.stringify(content);

                // Extract mediaUrl from template components if present
                if (content.components) {
                    const headerComp = content.components.find(c => c.type === 'header');
                    if (headerComp && headerComp.parameters) {
                        const mediaParam = headerComp.parameters.find(p => ['image', 'video', 'document'].includes(p.type));
                        if (mediaParam && mediaParam[mediaParam.type]) {
                            mediaUrl = mediaParam[mediaParam.type].link || null;
                        }
                    }
                }
                
                if (!mediaUrl && content._media_url) {
                    mediaUrl = content._media_url;
                }
            }
            else if (['image', 'video', 'audio', 'document', 'sticker'].includes(type)) {
                mediaUrl = content.link || content._media_url || null;
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

                // Emit new message event via local Socket emitter
                try {
                    const { data: savedMessage } = await rpcClient
                        .from('messages')
                        .select('*')
                        .eq('id', messageId)
                        .single();
                    
                    if (savedMessage) {
                        const realtimeSync = require('./realtimeSync');
                        realtimeSync.emitMessage(userId, savedMessage, 'INSERT');
                    }
                } catch (emitErr) {
                    console.error('Failed to emit message to socket:', emitErr);
                }

                // --- FIX: Update Conversation Last Message with Readable Preview ---
                try {
                    const previewText = this._generatePreviewText(type, content);
                    const { error: updateError } = await rpcClient
                        .from('conversations')
                        .update({ last_message: previewText })
                        .eq('user_id', userId)
                        .eq('contact_phone', cleanPhone);

                    if (updateError) console.error('Failed to update conversation preview:', updateError);
                } catch (previewErr) {
                    console.error('Error generating/updating preview:', previewErr);
                }
            }

        } catch (err) {
            console.error('Exception logging outbound message:', err);
        }
    }

    /**
     * Helper to generate human-readable preview for Templates/Interactive messages
     */
    _generatePreviewText(type, content) {
        try {
            if (type === 'text') {
                return typeof content === 'string' ? content : (content.body || 'Text Message');
            }
            if (type === 'image') return '📷 Image';
            if (type === 'video') return '🎥 Video';
            if (type === 'document') return '📄 Document';
            if (type === 'audio') return '🎵 Audio';
            if (type === 'sticker') return '💟 Sticker';

            if (type === 'template') {
                if (content._rendered_body) return content._rendered_body;
                let preview = `📄 Template: ${content.name || 'Unknown'}`;
                // Try to extract body params for context
                try {
                    const params = [];
                    if (content.components) {
                        content.components.forEach(c => {
                            if (c.type === 'body' && c.parameters) {
                                c.parameters.forEach(p => {
                                    if (p.type === 'text') params.push(p.text);
                                });
                            }
                        });
                    }
                    if (params.length > 0) {
                        preview += ` (${params.join(', ')})`;
                    }
                } catch (e) { }
                return preview;
            }

            if (type === 'interactive') {
                try {
                    if (content.type === 'button') return `🔘 ${content.body?.text || 'Interactive Button'}`;
                    if (content.type === 'list') return `📋 ${content.body?.text || 'Interactive List'}`;
                    if (content.type === 'cta_url') return `🔗 ${content.body?.text || 'Interactive CTA'}`;
                } catch (e) { }
                return 'Interactive Message';
            }

            return `Sent ${type}`;
        } catch (e) {
            return `Sent ${type}`;
        }
    }

    /**
     * Helper to hydrate template text from DB
     */
    async _hydrateTemplate(content, userId) {
        if (!content || !content.name) return null;
        try {
            const { data: template } = await supabaseAdmin
                .from('whatsapp_templates')
                .select('body_text, header_text, footer_text, buttons')
                .eq('user_id', userId)
                .eq('name', content.name)
                //.eq('language', content.language?.code || 'en') 
                .maybeSingle();

            if (!template || !template.body_text) return null;

            let bodyText = template.body_text;

            // Simple Parameter Replacement
            if (content.components) {
                const bodyComp = content.components.find(c => c.type === 'body');
                if (bodyComp && bodyComp.parameters) {
                    bodyComp.parameters.forEach((param, index) => {
                        const placeholder = `{{${index + 1}}}`;
                        let value = '';
                        if (param.type === 'text') value = param.text;
                        else if (param.type === 'currency') value = `${param.currency.currency_code} ${param.currency.amount_1000 / 1000}`;
                        else if (param.type === 'date_time') value = param.date_time.fallback_value;

                        // Replace all occurrences
                        bodyText = bodyText.split(placeholder).join(value);
                    });
                }
            }

            // Extract buttons structure
            let renderedButtons = [];
            if (template.buttons && template.buttons.type !== 'NONE') {
                renderedButtons = template.buttons.buttons || template.buttons || [];
            }

            return {
                ...content,
                _rendered_body: bodyText,
                _footer_text: template.footer_text || null,
                _rendered_header_text: template.header_text || null,
                _rendered_buttons: renderedButtons,
                _rendered_cards: template.buttons?.cards || [] // If carousel
            };
        } catch (e) {
            return null;
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
                },
                // [FIX: 2026-03-05] UN-THROTTLE AXIOS BUFFER LIMITS FOR LARGE VIDEOS
                // By default, Axios strictly limits uploads/downloads to ~10MB (throws MaxBodyLength errors).
                // Setting these explicitly to Infinity forces Node to bypass arbitrary buffer constraints
                // so heavy 16MB native H.264 video payloads can rapidly push to Meta's API at full Gigabit line speeds.
                maxBodyLength: Infinity,
                maxContentLength: Infinity,
                httpsAgent: httpsAgent
            });

            console.log('Media Upload Success. ID:', response.data.id);
            return response.data.id; // Returns Media ID
        } catch (error) {
            console.error('WhatsAppService Upload Error:', error.response?.data || error.message);
            throw error;
        }
    }
    /**
     * Mark a message as read (and optionally show typing indicator)
     * @param {string} userId 
     * @param {string} messageId - WhatsApp Message ID (wamid)
     * @param {boolean} showTyping - Whether to show a typing indicator
     */
    async markAsRead(userId, messageId, showTyping = false) {
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

            // --- TYPING INDICATOR START ---
            if (showTyping) {
                body.typing_indicator = {
                    type: "text"
                };
            }
            // --- TYPING INDICATOR END ---

            await axios.post(url, body, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                httpsAgent: httpsAgent
            });

            // --- TYPING INDICATOR START ---
            console.log(`Message ${messageId} marked as read.${showTyping ? ' Typing indicator sent.' : ''}`);
            // --- TYPING INDICATOR END ---

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

    /**
        * Send typing indicator
        * NOTE: In Cloud API, typing indicators are extensions of the 'read' status 
        * and REQUIRE a message_id to respond to.
        * @param {string} userId 
        * @param {string} to - Recipient phone number (kept for signature compatibility, though not used by Meta for this endpoint)
        * @param {string} messageId - The ID of the message you are "typing" in response to
        */
    async sendTypingIndicator(userId, to, messageId) {
        if (!messageId) return false;
        console.log(`[WhatsAppService DEBUG] Typing Indicator/Read Status requested for message: ${messageId} (Recipient: ${to})`);
        try {
            const config = await this.getConfig(userId);
            const fromPhoneId = config.phone_number_id;
            const accessToken = config.meta_access_token;

            const url = `${this.baseUrl}/${fromPhoneId}/messages`;

            const body = {
                messaging_product: 'whatsapp',
                status: 'read',
                message_id: messageId,
                typing_indicator: {
                    type: "text"
                }
            };

            await axios.post(url, body, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                httpsAgent: httpsAgent
            });

            console.log(`Typing indicator sent for message ${messageId}.`);
            return true;
        } catch (error) {
            // Suppress code 100 which happens for old messages
            const errorData = error.response?.data?.error;
            if (errorData?.code === 100) return false;

            console.error('WhatsAppService sendTypingIndicator Error:', error.response?.data || error.message);
            return false;
        }
    }
    // --- TYPING INDICATOR END ---
}

module.exports = new WhatsAppService();