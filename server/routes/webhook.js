
const express = require('express');
const router = express.Router();

// DEBUG: Log all hits to this router
router.use((req, res, next) => {
    console.log(`[Webhook Router Hit] ${req.method} ${req.originalUrl}`);
    next();
});
const { supabase, supabaseAdmin } = require('../lib/supabaseClient');
const { extractMessageContent } = require('../utils/whatsappParser');
const { logInboxMessage } = require('../utils/logger');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const flowEngine = require('../services/flowEngine');

// Deduplication Cache (Simple In-Memory)
const processedMessageIds = new Set();
// Clear cache every 10 minutes
setInterval(() => {
    processedMessageIds.clear();
}, 10 * 60 * 1000);

// Helper: Download Media from WhatsApp to Local Disk AND Upload to Supabase
const downloadMedia = async (mediaId, accessToken, userId) => {
    try {
        if (!mediaId) {
            console.error('downloadMedia: No mediaId provided');
            return null;
        }
        if (!accessToken) {
            console.error('downloadMedia: No accessToken provided');
            return null;
        }

        console.log(`downloadMedia: Fetching URL for mediaId ${mediaId}`);

        // 1. Get Media URL from Meta
        const urlResponse = await axios.get(`https://graph.facebook.com/v18.0/${mediaId}`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        const urlData = urlResponse.data;
        if (!urlData || !urlData.url) {
            console.error('downloadMedia: No URL in response', urlData);
            return null;
        }

        console.log(`downloadMedia: Downloading binary from ${urlData.url}`);

        // 2. Download Media Binary
        const mediaResponse = await axios.get(urlData.url, {
            headers: { Authorization: `Bearer ${accessToken}` },
            responseType: 'arraybuffer'
        });

        const buffer = Buffer.from(mediaResponse.data);

        // 3. Upload to Supabase Storage Directly (No Local Save)
        const mimeType = urlData.mime_type || 'application/octet-stream';
        const ext = mimeType.split('/')[1] || 'bin';
        const filename = `${mediaId}-${Date.now()}.${ext}`;
        let finalPublicUrl = null;

        try {
            const bucketName = 'campaign-media'; // Use the EXISTING bucket
            const dateStr = new Date().toISOString().split('T')[0];
            const storagePath = `${userId}/inbound/${dateStr}/${filename}`;

            // Upload
            const { error: uploadError } = await supabaseAdmin.storage
                .from(bucketName)
                .upload(storagePath, buffer, {
                    contentType: mimeType,
                    upsert: false
                });

            if (uploadError) {
                console.error('Supabase Storage Upload Failed:', uploadError.message);
                return null;
            }

            // Get Public URL
            const { data: publicUrlData } = supabaseAdmin.storage
                .from(bucketName)
                .getPublicUrl(storagePath);

            if (publicUrlData && publicUrlData.publicUrl) {
                finalPublicUrl = publicUrlData.publicUrl;
                console.log(`Media uploaded to Supabase: ${finalPublicUrl}`);
            }
        } catch (storageErr) {
            console.error('Supabase Storage Exception:', storageErr);
            return null;
        }

        return {
            url: finalPublicUrl,
            mime_type: mimeType,
            filename: filename,
            type: mimeType.split('/')[0] // 'image', 'video' etc.
        };
    } catch (error) {
        console.error('Media download exception:', error.message);
        if (error.response) {
            console.error('Error Response:', error.response.status, error.response.data);
        }
        return null;
    }
};

// ==========================================
// 1. GET Verification
// ==========================================
// ==========================================
// 1. GET Verification
// ==========================================

// GLOBAL Webhook Verification (for Embedded Signup Override)
// Matches /api/webhook (since this router is mounted at /api/ or /)
// Note: server.js mounts this router at '/', but app.use('/api', router).
// So this handles /api/webhook effectively.
router.get('/webhook', async (req, res) => {
    try {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        console.log(`[Global Webhook GET] Verification request:`, { mode, token });

        if (mode && token) {
            if (mode === 'subscribe') {
                // In embedded signup override, we send the userId as the verify token.
                // We should accept it if it looks valid.
                // For now, let's allow it if it's not empty, or check against specific logic.
                // The service sends `verify_token: userId`. 
                // Since this is a specialized override, we simply echo back the challenge.
                console.log('[Global Webhook GET] WEBHOOK_VERIFIED');
                res.status(200).send(challenge);
            } else {
                res.status(403).send('Forbidden');
            }
        } else {
            res.status(403).send('Forbidden');
        }
    } catch (error) {
        console.error('Global Webhook Verification Error:', error);
        res.status(500).send('Server Error');
    }
});

router.get('/:userId/:phoneNumberId/webhook', async (req, res) => {
    try {
        const { userId, phoneNumberId } = req.params;

        // Extract query params (Meta sends these)
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        console.log(`[Webhook GET] Verification request for User: ${userId}, Phone: ${phoneNumberId}`);

        // Check if mode and token exist
        if (!mode || !token) {
            return res.status(403).send('Missing mode or token');
        }

        // Check mode
        if (mode !== 'subscribe') {
            return res.status(403).send('Invalid mode');
        }

        // Verify token against DB
        // We use RPC to bypass RLS since this request is unauthenticated
        const { data: savedToken, error } = await supabase.rpc('get_verify_token', {
            p_user_id: userId,
            p_phone_number_id: phoneNumberId
        });

        if (error) {
            console.error('[Webhook GET] Database error verifying token:', error);
            return res.status(500).send('Server Error');
        }

        if (!savedToken) {
            console.warn(`[Webhook GET] No verify token found for user ${userId} and phone ${phoneNumberId}`);
            return res.status(403).send('User/Phone not configured');
        }

        if (token === savedToken) {
            console.log('[Webhook GET] Webhook verified successfully!');
            // Respond with challenge token to confirm
            return res.status(200).send(challenge);
        } else {
            console.warn(`[Webhook GET] Verify token mismatch. Received: '${token}', Expected: '${savedToken}'`);
            return res.status(403).send('Verification failed');
        }

    } catch (error) {
        console.error('[Webhook GET] Webhook verification error:', error);
        res.status(500).send('Internal Server Error');
    }
});

// GLOBAL Webhook POST (for Embedded Signup)
router.post('/webhook', async (req, res) => {
    const rawBody = req.body;
    console.log('[Global Webhook POST] Event received');
    // console.log(JSON.stringify(rawBody, null, 2));

    try {
        const entry = rawBody.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;
        const metadata = value?.metadata;

        if (!metadata || !metadata.phone_number_id) {
            // Not a message event or invalid payload
            console.log('[Global Webhook] No metadata/phone_number_id found. Ignoring.');
            return res.sendStatus(200);
        }

        const phoneNumberId = metadata.phone_number_id;

        // 1. Lookup User ID from DB
        const { data: config, error } = await supabaseAdmin
            .from('whatsapp_config')
            .select('user_id')
            .eq('phone_number_id', phoneNumberId)
            .maybeSingle();

        if (error || !config) {
            console.error(`[Global Webhook] No user found for Phone ID: ${phoneNumberId}`);
            return res.sendStatus(200); // Ack to stop retries
        }

        const userId = config.user_id;
        console.log(`[Global Webhook] Routed to User: ${userId} for Phone: ${phoneNumberId}`);

        // 2. Reuse existing logic by calling the handler manually or redirecting
        // Since we can't easily internal-redirect with express params, we'll invoke the processing logic.
        // Refactoring the logic into a shared function `processWebhookEvent(userId, phoneId, body)` would be best.
        // For now, let's just duplicate the essential call or modify the architecture slightly.

        // BETTER: Attach params and call the processing function? 
        // Let's call the logic directly.
        await processWebhookLogic(req, res, userId, phoneNumberId);

    } catch (err) {
        console.error('[Global Webhook] Error:', err);
        res.sendStatus(500);
    }
});

// Refactored shared logic wrapper
const processWebhookLogic = async (req, res, userId, phoneNumberId) => {
    return handleWebhookEvent(req, res, userId, phoneNumberId);
};

// Legacy Parameterized POST (Keeping for backward compatibility)
router.post('/:userId/:phoneNumberId/webhook', async (req, res) => {
    const { userId, phoneNumberId } = req.params;
    await handleWebhookEvent(req, res, userId, phoneNumberId);
});

// SHARED Webhook Event Handler
async function handleWebhookEvent(req, res, userId, phoneNumberId) {
    // const { userId, phoneNumberId } = req.params; // Handling via args
    const rawBody = req.body;

    console.log(`[Webhook POST] Event received for User: ${userId}, Phone: ${phoneNumberId}`);
    console.log('Payload:', JSON.stringify(rawBody, null, 2));

    try {
        // 1. Log the raw event
        // 1. Log the raw event
        const { data: logId, error: logError } = await supabase.rpc('log_webhook_event', {
            p_user_id: userId,
            p_phone_number_id: phoneNumberId,
            p_http_method: 'POST',
            p_raw_payload: rawBody,
            p_processed_status: 'processing',
            p_message_type: null,
            p_sender_phone: null,
            p_webhook_id: null
        });

        if (logError) {
            console.error('Failed to log webhook:', logError);
        }

        // 2. Parse WhatsApp Structure
        const entry = rawBody.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;
        const messages = value?.messages;
        const statuses = value?.statuses;
        const stateSync = value?.state_sync;
        const messageEchoes = value?.message_echoes;
        const history = value?.history;

        // --- HANDLE COEXISTENCE STATE SYNC (SMB_APP_STATE_SYNC) ---
        if (stateSync && Array.isArray(stateSync)) {
            console.log(`[Webhook] Processing ${stateSync.length} State Sync (Contact) items...`);
            for (const item of stateSync) {
                if (item.type === 'contact' && item.contact) {
                    const phone = item.contact.phone_number;
                    const name = item.contact.full_name || item.contact.first_name || phone;
                    const action = item.action; // 'add', 'remove'

                    if (!phone) continue;

                    if (action === 'remove') {
                        // Optional: Mark as inactive or delete? Let's just log for now to avoid accidental deletions of meaningful data
                        console.log(`[Webhook] Contact removed on SMB App: ${phone}`);
                    } else {
                        // Upsert Contact
                        const { error: upsertError } = await supabaseAdmin
                            .from('contacts')
                            .upsert({
                                user_id: userId,
                                phone: phone,
                                name: name,
                                status: 'active',
                                updated_at: new Date().toISOString()
                            }, { onConflict: 'user_id, phone' });

                        if (upsertError) console.error(`[Webhook] Failed to sync contact ${phone}:`, upsertError);
                    }
                }
            }
            return res.status(200).json({ status: 'success' });
        }

        // --- HANDLE COEXISTENCE ECHOES (SMB_MESSAGE_ECHOES) ---
        if (messageEchoes && Array.isArray(messageEchoes)) {
            console.log(`[Webhook] Processing ${messageEchoes.length} Message Echoes...`);
            // Echoes are OUTGOING messages from business app. Treat them as direction='out'.
            // Structure is similar to messages but wrapped in message_echoes
            // We can reuse the message processing logic if we adapt the object, 
            // BUT we need to force direction='out' and `to` is the user.

            // Reuse config fetching logic
            const { data: config } = await supabase.rpc('get_whatsapp_config', { p_user_id: userId, p_phone_number_id: phoneNumberId });
            const accessToken = config?.meta_access_token; // For media if needed (echoes might have media)

            for (const echo of messageEchoes) {
                // echo has { from: business_phone, to: user_phone, id, timestamp, type, ... }
                // We need to upsert Conversation with 'to' (the user)
                const contactPhone = echo.to;
                // Note: Echoes don't give contact name, just phone.

                // 1. Upsert Conversation (if needed)
                let conversationId = null;
                const { data: convData } = await supabaseAdmin
                    .from('conversations')
                    .select('id, unread_count')
                    .eq('user_id', userId)
                    .eq('contact_phone', contactPhone)
                    .maybeSingle();

                if (convData) {
                    conversationId = convData.id;
                    // Don't increment unread for outgoing
                } else {
                    const { data: newConv } = await supabaseAdmin
                        .from('conversations')
                        .insert({
                            user_id: userId,
                            contact_phone: contactPhone,
                            last_message: `[${echo.type} - Business App]`,
                            unread_count: 0,
                            updated_at: new Date(echo.timestamp * 1000).toISOString()
                        }).select().single();
                    conversationId = newConv?.id;
                }

                // 2. Insert Message
                const extracted = extractMessageContent(echo); // Should work for standard types

                await supabaseAdmin.from('messages').insert({
                    conversation_id: conversationId,
                    direction: 'out', // Enforce OUT for echoes
                    type: extracted.type,
                    text: extracted.text || extracted.caption,
                    whatsapp_message_id: extracted.id,
                    status: 'sent', // Assume sent if echo
                    created_at: new Date(extracted.timestamp * 1000).toISOString()
                });
                console.log(`[Webhook] Saved Echo Message for ${contactPhone}`);
            }
            return res.status(200).json({ status: 'success' });
        }

        // --- HANDLE HISTORY SYNC ---
        if (history && Array.isArray(history)) {
            console.log(`[Webhook] Processing History Sync...`);
            // Structure: history[].threads[].messages[]
            // We need access token for media downloads potentially, but history might not have fresh media URLs (media_placeholder).
            // Logic: Just ingest them.

            for (const hItem of history) {
                if (hItem.threads) {
                    for (const thread of hItem.threads) {
                        const contactPhoneRaw = thread.id; // User phone
                        // Upsert Conversation
                        let conversationId = null;
                        const { data: convData } = await supabaseAdmin.from('conversations').select('id').eq('user_id', userId).eq('contact_phone', contactPhoneRaw).maybeSingle();

                        if (convData) {
                            conversationId = convData.id;
                        } else {
                            const { data: newConv } = await supabaseAdmin.from('conversations').insert({
                                user_id: userId,
                                contact_phone: contactPhoneRaw,
                                last_message: 'History Sync',
                                unread_count: 0
                            }).select().single();
                            conversationId = newConv?.id;
                        }

                        if (thread.messages) {
                            for (const msg of thread.messages) {
                                // Determine direction
                                // msg.from could be business or user.
                                // Check if msg.from matches our phoneNumberId or Business Phone?
                                // The webhook metadata has display_phone_number (business).
                                const bizPhone = value.metadata.display_phone_number.replace(/\D/g, '');
                                const msgFrom = msg.from.replace(/\D/g, '');
                                const direction = (msgFrom === bizPhone) ? 'out' : 'in';

                                const extracted = extractMessageContent(msg);


                                // Check if message already exists or processed (idempotency)
                                if (processedMessageIds.has(msg.id)) {
                                    console.log(`[Webhook] Skipping duplicate message ID: ${msg.id}`);
                                    continue;
                                }
                                processedMessageIds.add(msg.id);

                                const { data: existing } = await supabaseAdmin.from('messages').select('id').eq('whatsapp_message_id', msg.id).maybeSingle();
                                if (!existing) {
                                    await supabaseAdmin.from('messages').insert({
                                        conversation_id: conversationId,
                                        direction: direction,
                                        type: extracted.type,
                                        text: extracted.text || extracted.caption,
                                        whatsapp_message_id: extracted.id,
                                        status: direction === 'in' ? 'delivered' : 'sent',
                                        created_at: new Date(extracted.timestamp * 1000).toISOString()
                                    });
                                }
                            }
                        }
                    }
                }
            }
            console.log('[Webhook] History Sync Processed.');
            return res.status(200).json({ status: 'success' });
        }

        // --- HANDLE STATUS UPDATES (Sent, Delivered, Read) ---
        if (statuses && Array.isArray(statuses)) {
            const metadata = value?.metadata;
            const logPhoneId = metadata?.phone_number_id || phoneNumberId;
            const logDisplayPhone = metadata?.display_phone_number || 'Unknown';

            console.log(`[Webhook] Received ${statuses.length} Status Update(s) (Sent/Delivered/Read). No Flow Triggered.`);
            for (const status of statuses) {
                const waMessageId = status.id;
                const newStatus = status.status; // 'sent', 'delivered', 'read', 'failed'

                // Update DB via RPC
                const { data: updateSuccess, error: statusError } = await supabase.rpc('update_message_status', {
                    p_whatsapp_message_id: waMessageId,
                    p_status: newStatus
                });

                if (statusError) {
                    console.error(`[Webhook] Failed to update status for ${waMessageId}:`, statusError);
                } else {
                    if (updateSuccess) {
                        console.log(`[Webhook] Message ${waMessageId} updated to '${newStatus}' (Rows updated: true)`);
                    } else {
                        console.warn(`[Webhook] Message ${waMessageId} NOT updated to '${newStatus}' (Rows updated: false) - Message ID not found in DB`);
                    }


                    // --- UPDATE CAMPAIGN QUEUE STATUS ---
                    try {
                        let updatePayload = {
                            status: newStatus.toUpperCase(),
                            updated_at: new Date().toISOString()
                        };

                        // Capture Error Details if Failed
                        if (newStatus === 'failed' && status.errors && status.errors.length > 0) {
                            const err = status.errors[0];
                            const errString = `${err.title || 'Error'} (${err.code}): ${err.message}`;
                            updatePayload.error_message = errString;

                            console.log(`[Webhook] Captured Failure for ${waMessageId}: ${errString}`);
                        }

                        // Select campaign_id and campaign details
                        const { data: queueData, error: campError } = await supabaseAdmin
                            .from('campaign_queue')
                            .update(updatePayload)
                            .eq('message_id', waMessageId)
                            .select('campaign_id, campaigns (title, template_name)')
                            .maybeSingle();

                        const campaignId = queueData?.campaign_id || 'unknown';
                        const campaignName = queueData?.campaigns?.title || 'Unknown';
                        const templateName = queueData?.campaigns?.template_name || 'Unknown';

                        if (campError) {
                            console.error(`[Webhook] Failed to update campaign status for ${waMessageId}:`, campError);
                        } else {
                            // console.log(`[Webhook] Campaign status updated for ${waMessageId}`);
                        }

                        // Log to file for debugging
                        try {
                            const { logCampaignRequest } = require('../utils/logger');

                            logCampaignRequest('WEBHOOK_STATUS_UPDATE', {
                                campaignName: campaignName,
                                campaignId: campaignId,
                                from: logDisplayPhone,
                                to: status.recipient_id,
                                phoneNumberId: logPhoneId,
                                whatsappNumber: logDisplayPhone,
                                templateName: templateName,
                                messageId: waMessageId,
                                status: newStatus,
                                recipient: status.recipient_id
                            });
                        } catch (e) { }
                    } catch (cErr) {
                        console.error('[Webhook] Campaign Queue Update Error:', cErr);
                    }
                }
            }
            return res.status(200).json({ status: 'success' });
        }

        if (!messages || !Array.isArray(messages)) {
            // Not a message event (could be status update, etc.)
            if (logId) {
                await supabase.rpc('update_webhook_log', {
                    p_log_id: logId,
                    p_processed_status: 'ignored_no_messages'
                });
            }
            return res.status(200).json({ status: 'success' });
        }

        // 3. Get Access Token for Media Download
        console.log(`Fetching config for User: ${userId}, PhoneId: ${phoneNumberId}`);

        // Use RPC to bypass RLS
        const { data: config, error: configError } = await supabase.rpc('get_whatsapp_config', {
            p_user_id: userId,
            p_phone_number_id: phoneNumberId
        });

        if (configError) {
            console.error('Error fetching whatsapp_config:', configError);
        }

        const accessToken = config?.meta_access_token;
        console.log(`Access Token found: ${!!accessToken}`);

        // 4. Process each message
        for (const message of messages) {
            try {
                if (processedMessageIds.has(message.id)) {
                    console.log(`[Webhook] Skipping duplicate message ID (Main Loop): ${message.id}`);
                    continue;
                }
                processedMessageIds.add(message.id);

                const extracted = extractMessageContent(message);

                // --- LOG TO FILE (INBOX LOGGER) ---
                // --- LOG TO FILE (INBOX LOGGER) ---
                try {
                    const metadata = value?.metadata;
                    // Use display_phone_number if available, otherwise phone_number_id, fallback to userId
                    const recipientPhone = metadata?.display_phone_number || metadata?.phone_number_id || userId;
                    const logPhoneNumberId = metadata?.phone_number_id || 'Unknown';
                    const logWhatsappNumber = metadata?.display_phone_number || 'Unknown';

                    logInboxMessage('IN_MESSAGE', {
                        to: recipientPhone,
                        from: extracted.from,
                        type: extracted.type,
                        phoneNumberId: logPhoneNumberId,
                        whatsappNumber: logWhatsappNumber,
                        // Timestamp injected by logger, but we can keep original too
                        messageTimestamp: extracted.timestamp,
                        content: extracted.text || extracted.caption || (extracted.type === 'interactive' ? extracted.interactive : extracted.type)
                    });
                } catch (logErr) { console.error('Inbox Log Error:', logErr); }

                // Handle Media Download
                let mediaUrl = null;
                let filename = null;
                let mimeType = null;

                if (['image', 'video', 'audio', 'document', 'sticker'].includes(extracted.type) && extracted.mediaId) {
                    if (accessToken) {
                        console.log(`Downloading media for message ${extracted.id}...`);
                        const mediaData = await downloadMedia(extracted.mediaId, accessToken, userId);
                        if (mediaData) {
                            mediaUrl = mediaData.url;
                            mimeType = mediaData.mime_type;
                            filename = extracted.filename || mediaData.filename;
                            console.log(`Media downloaded: ${mediaUrl}`);
                        } else {
                            console.warn(`Failed to download media for message ${extracted.id}`);
                        }
                    } else {
                        console.error(`Cannot download media: No access token for user ${userId}`);
                    }
                }

                // Find or Create Conversation AND Insert Message using RPC (Bypasses RLS)
                // Sanitise Phone Numbers: Remove non-digits
                const contactPhone = extracted.from.replace(/\D/g, '');
                let contactName = value.contacts?.find(c => c.wa_id === extracted.from)?.profile?.name || contactPhone;
                if (contactName && contactName.startsWith('+')) contactName = contactName.replace('+', '');

                // Determine DB Text Content - specific handling for Interactive messages to save full JSON
                let dbMessageText = extracted.text || extracted.caption;
                if (!dbMessageText && extracted.type === 'interactive' && extracted.raw?.interactive) {
                    dbMessageText = JSON.stringify(extracted.raw.interactive);
                } else if (!dbMessageText && extracted.type === 'button' && extracted.button?.text) {
                    // Legacy buttons - store text directly as it's the primary content
                    dbMessageText = extracted.button.text;
                }

                // --- MANUAL DB OPERATIONS (Bypass RPC to ensure Media Fields are saved) ---

                // 1. Upsert Contact
                let contactId = null;
                const { data: contactData } = await supabaseAdmin
                    .from('contacts')
                    .select('id')
                    .eq('user_id', userId)
                    .eq('phone', contactPhone)
                    .maybeSingle();

                if (contactData) {
                    contactId = contactData.id;
                    await supabaseAdmin
                        .from('contacts')
                        .update({
                            name: contactName !== '~' ? contactName : undefined,
                            last_active: new Date(extracted.timestamp * 1000).toISOString(),
                            status: 'active'
                        })
                        .eq('id', contactId);
                } else {
                    const { data: newContact, error: createContactError } = await supabaseAdmin
                        .from('contacts')
                        .insert({
                            user_id: userId,
                            phone: contactPhone,
                            name: contactName,
                            last_active: new Date(extracted.timestamp * 1000).toISOString(),
                            status: 'active'
                        })
                        .select()
                        .single();
                    if (createContactError) console.error('Error creating contact:', createContactError);
                    contactId = newContact?.id;
                }

                // 2. Upsert Conversation
                let conversationId = null;
                const { data: convData } = await supabaseAdmin
                    .from('conversations')
                    .select('id, unread_count')
                    .eq('user_id', userId)
                    .eq('contact_phone', contactPhone)
                    .maybeSingle();

                if (convData) {
                    conversationId = convData.id;
                    await supabaseAdmin
                        .from('conversations')
                        .update({
                            last_message: dbMessageText || `[${extracted.type}]`,
                            unread_count: (convData.unread_count || 0) + 1,
                            updated_at: new Date(extracted.timestamp * 1000).toISOString(),
                            contact_name: contactName !== '~' ? contactName : undefined
                        })
                        .eq('id', conversationId);
                } else {
                    const { data: newConv, error: createConvError } = await supabaseAdmin
                        .from('conversations')
                        .insert({
                            user_id: userId,
                            contact_phone: contactPhone,
                            contact_name: contactName,
                            last_message: dbMessageText || `[${extracted.type}]`,
                            unread_count: 1,
                            updated_at: new Date(extracted.timestamp * 1000).toISOString(),
                        })
                        .select()
                        .single();
                    if (createConvError) console.error('Error creating conversation:', createConvError);
                    conversationId = newConv?.id;
                }

                // 3. Insert Message
                // Explicitly including media fields
                const { data: result, error: rpcError } = await supabaseAdmin
                    .from('messages')
                    .insert({
                        conversation_id: conversationId,
                        direction: 'in',
                        type: extracted.type,
                        text: dbMessageText,
                        media_url: mediaUrl || null,
                        filename: filename || null,
                        mime_type: mimeType || null,
                        whatsapp_message_id: extracted.id,
                        status: 'delivered',
                        created_at: new Date(extracted.timestamp * 1000).toISOString(),
                        latitude: extracted.location?.latitude || null,
                        longitude: extracted.location?.longitude || null
                    })
                    .select()
                    .single();

                if (rpcError) throw rpcError;

                // Update log with details
                if (logId) {
                    await supabase.rpc('update_webhook_log', {
                        p_log_id: logId,
                        p_processed_status: 'processed',
                        p_message_type: extracted.type,
                        p_sender_phone: extracted.from,
                        p_extracted_content: extracted
                    });
                }

                console.log(`Processed ${extracted.type} message from ${extracted.from}`);

                // --- FLOW ENGINE INTEGRATION ---
                // Trigger flow logic after saving the message
                // --- FLOW ENGINE INTEGRATION ---
                // Trigger flow logic after saving the message
                const allowedTriggerTypes = ['text', 'interactive', 'button', 'image', 'video', 'audio', 'document'];

                if (allowedTriggerTypes.includes(extracted.type)) {
                    let textContent = extracted.text || '';
                    let interactionId = null;
                    let inputPayload = null; // New: Structure to pass to Flow Engine

                    if (['image', 'video', 'audio', 'document'].includes(extracted.type)) {
                        // Handle Media Messages
                        textContent = extracted.caption || `[${extracted.type}]`;
                        inputPayload = {
                            type: extracted.type,
                            url: mediaUrl,
                            mime_type: mimeType,
                            filename: filename,
                            caption: extracted.caption
                        };
                    }
                    else if (extracted.type === 'interactive') {
                        if (extracted.interactive?.subtype === 'button_reply') {
                            textContent = extracted.interactive.title;
                            interactionId = extracted.interactive.id;
                            // WE WANT BOTH TITLE AND ID available
                            inputPayload = {
                                title: textContent,
                                id: interactionId,
                                selectedId: interactionId // alias for easier access
                            };
                        } else if (extracted.interactive?.subtype === 'list_reply') {
                            textContent = extracted.interactive.title;
                            interactionId = extracted.interactive.id;
                            inputPayload = {
                                title: textContent,
                                id: interactionId,
                                description: extracted.interactive.description
                            };
                        } else if (extracted.interactive?.subtype === 'nfm_reply') {
                            // Flow response
                            const responseJson = extracted.interactive.response_json;
                            inputPayload = responseJson; // Already an object

                            interactionId = responseJson.flow_token;

                            if (typeof responseJson === 'object') {
                                textContent = JSON.stringify(responseJson);

                                // Save Submission to DB
                                try {
                                    // Determining Flow ID and Name
                                    // 1. Try to get Flow ID from token (Format: flow_sessionId_nodeId__flowId)
                                    let rawToken = interactionId || 'unknown_flow';
                                    let flowId = rawToken;

                                    if (rawToken.includes('__')) {
                                        const parts = rawToken.split('__');
                                        flowId = parts[parts.length - 1]; // Last part is the Flow ID
                                    }

                                    if (flowId === 'unused_token') flowId = 'unknown_flow';

                                    // 2. Default Name
                                    let flowName = (flowId === 'unknown_flow') ? 'Unknown Form' : 'Flow ' + flowId;

                                    // 3. Improve Name Lookup: Check if flow_token matches a known flow in DB
                                    if (flowId !== 'unknown_flow') {
                                        const { data: flowData } = await supabaseAdmin
                                            .from('whatsapp_flows')
                                            .select('name')
                                            .eq('id', flowId)
                                            .maybeSingle();

                                        if (flowData) {
                                            flowName = flowData.name;
                                        }
                                    }

                                    const { error: subError } = await supabaseAdmin
                                        .from('whatsapp_flow_submissions')
                                        .insert({
                                            user_id: userId,
                                            flow_id: flowId,
                                            flow_name: flowName,
                                            contact_phone: extracted.from,
                                            contact_name: contactName,
                                            submission_data: responseJson,
                                            submitted_at: new Date().toISOString()
                                        });

                                    if (subError) {
                                        console.error('Failed to save flow submission:', subError);
                                    } else {
                                        console.log(`[Webhook] Saved Flow Submission for ${extracted.from} (Flow: ${flowName})`);
                                    }
                                } catch (err) {
                                    console.error('Exception saving flow submission:', err);
                                }

                            } else {
                                textContent = String(responseJson);
                            }
                        }
                    } else if (extracted.type === 'button') {
                        // Template Quick Reply Button
                        textContent = extracted.button.text;
                        interactionId = extracted.button.payload;
                        inputPayload = {
                            title: textContent,
                            id: interactionId,
                            payload: interactionId
                        };
                    } else {
                        // Regular text
                        inputPayload = textContent;
                    }

                    if (textContent || inputPayload) {
                        console.log(`[Webhook] Triggering Flow Engine: Type='${extracted.type}', Content='${textContent}'`);

                        // Normalize inputPayload to object to inject metadata
                        if (typeof inputPayload === 'string') {
                            inputPayload = { text: inputPayload };
                        }

                        // Inject Sender Name if available
                        if (inputPayload && typeof inputPayload === 'object') {
                            inputPayload.name = contactName;
                        }

                        // Run in background so we don't block the webhook response too long? 
                        // Actually, better to await to ensure sequence, but catch errors so we don't fail the webhook.
                        try {
                            // PASS inputPayload as the 3rd argument (messageText/Input)
                            // The FlowEngine needs to be smart enough to handle objects vs strings
                            await flowEngine.processMessage(userId, extracted.from, inputPayload, extracted.type, interactionId);
                        } catch (flowErr) {
                            console.error('[Webhook] Flow Engine Error:', flowErr);
                        }
                    } else {
                        console.log('[Webhook] No content extracted, skipping Flow Engine.');
                    }
                }

            } catch (err) {
                console.error('Error processing message:', err);
                if (logId) {
                    await supabase.rpc('update_webhook_log', {
                        p_log_id: logId,
                        p_processed_status: 'failed',
                        p_error_message: err.message
                    });
                }
            }
        }

        res.status(200).json({ status: 'success' });

    } catch (error) {
        console.error('Webhook handler error:', error);
        res.status(200).json({ status: 'error', message: error.message });
    }
}

module.exports = router;
