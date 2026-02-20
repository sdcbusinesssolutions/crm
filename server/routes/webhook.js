
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

// --- CONCURRENCY CONTROL ---
const FLOW_CONCURRENCY_LIMIT = 20; // Max concurrent flow executions
const activeFlows = new Set();
const flowQueue = [];

const processFlowConcurrently = async (fn) => {
    if (activeFlows.size >= FLOW_CONCURRENCY_LIMIT) {
        return new Promise((resolve, reject) => {
            flowQueue.push({ fn, resolve, reject });
        });
    }
    return runFlow(fn);
};

const runFlow = async (fn) => {
    const promise = fn();
    activeFlows.add(promise);

    try {
        const result = await promise;
        return result;
    } finally {
        activeFlows.delete(promise);
        if (flowQueue.length > 0) {
            const next = flowQueue.shift();
            runFlow(next.fn).then(next.resolve).catch(next.reject);
        }
    }
};

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

        console.log(`downloadMedia: Fetching URL for mediaId ${mediaId} using v21.0`);

        // 1. Get Media URL from Meta (Upgraded to v21.0 with Retry)
        let urlData;
        let metaAttempts = 0;
        const maxMetaAttempts = 2;
        while (metaAttempts < maxMetaAttempts) {
            metaAttempts++;
            try {
                const urlResponse = await axios.get(`https://graph.facebook.com/v21.0/${mediaId}`, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                    timeout: 15000
                });
                urlData = urlResponse.data;
                if (urlData && urlData.url) break;
            } catch (urlErr) {
                console.error(`downloadMedia: Meta metadata fetch attempt ${metaAttempts} failed: ${urlErr.message}`);
                if (metaAttempts >= maxMetaAttempts) {
                    console.error(`downloadMedia: Failed to fetch media metadata for ${mediaId} after ${maxMetaAttempts} tries.`);
                    return null;
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        console.log(`downloadMedia: Downloading binary from ${urlData.url.substring(0, 50)}...`);

        // 2. Download Media Binary (With Retry for Robustness)
        let buffer;
        let attempts = 0;
        const maxAttempts = 3;
        while (attempts < maxAttempts) {
            attempts++;
            try {
                console.log(`downloadMedia: Downloading binary from Meta (Attempt ${attempts}/${maxAttempts})...`);
                const mediaResponse = await axios.get(urlData.url, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                        'Accept': '*/*',
                        'Accept-Encoding': 'gzip, deflate, br'
                    },
                    responseType: 'arraybuffer',
                    timeout: 60000,
                    maxContentLength: Infinity,
                    maxBodyLength: Infinity
                });
                buffer = Buffer.from(mediaResponse.data);
                console.log(`downloadMedia: Binary downloaded successfully (${buffer.length} bytes)`);
                break; // Success!
            } catch (binErr) {
                console.error(`downloadMedia: Attempt ${attempts} failed: ${binErr.message}`);
                if (attempts >= maxAttempts) {
                    console.error(`downloadMedia: All ${maxAttempts} attempts exhausted for ${mediaId}.`);
                    if (binErr.response) {
                        console.error(`downloadMedia: Meta response error: ${binErr.response.status} ${binErr.response.statusText}`);
                    }
                    return null;
                }
                // Wait 1 second before retrying
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        // 3. Upload to Supabase Storage Directly (No Local Save)
        const mimeType = urlData.mime_type || 'application/octet-stream';
        const ext = mimeType.split('/')[1] || 'bin';
        const filename = `${mediaId}-${Date.now()}.${ext}`;
        let finalPublicUrl = null;

        try {
            const bucketName = 'campaign-media';
            const dateStr = new Date().toISOString().split('T')[0];
            const storagePath = `${userId}/inbound/${dateStr}/${filename}`;

            console.log(`downloadMedia: Uploading to Supabase bucket ${bucketName} path ${storagePath} (${buffer.length} bytes)`);

            // Upload
            const { error: uploadError } = await supabaseAdmin.storage
                .from(bucketName)
                .upload(storagePath, buffer, {
                    contentType: mimeType,
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) {
                console.error(`downloadMedia: Supabase Storage Upload Failed for ${mediaId}:`, uploadError.message);
                return null;
            }

            // Get Public URL
            const { data: publicUrlData } = supabaseAdmin.storage
                .from(bucketName)
                .getPublicUrl(storagePath);

            if (publicUrlData && publicUrlData.publicUrl) {
                finalPublicUrl = publicUrlData.publicUrl;
                console.log(`downloadMedia: Success. Public URL: ${finalPublicUrl}`);
            } else {
                console.error(`downloadMedia: Failed to get public URL for ${storagePath}`);
            }
        } catch (storageErr) {
            console.error(`downloadMedia: Supabase Storage Exception for ${mediaId}:`, storageErr.message);
            return null;
        }

        return {
            url: finalPublicUrl,
            mime_type: mimeType,
            filename: filename,
            type: mimeType.split('/')[0] // 'image', 'video' etc.
        };
    } catch (error) {
        console.error('Media download overall exception:', error.message);
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

        // REPLY IMMEDIATELY to prevent Meta timeouts/retries
        res.sendStatus(200);

        // Process in Background
        processWebhookLogic(req, null, userId, phoneNumberId).catch(err =>
            console.error('[Global Webhook] Background Processing Error:', err)
        );

    } catch (err) {
        console.error('[Global Webhook] Error:', err);
        if (!res.headersSent) res.sendStatus(500);
    }
});

// Refactored shared logic wrapper
const processWebhookLogic = async (req, res, userId, phoneNumberId) => {
    return handleWebhookEvent(req, res, userId, phoneNumberId);
};

// Legacy Parameterized POST (Keeping for backward compatibility)
router.post('/:userId/:phoneNumberId/webhook', async (req, res) => {
    const { userId, phoneNumberId } = req.params;

    // REPLY IMMEDIATELY
    res.sendStatus(200);

    // Process in Background
    handleWebhookEvent(req, null, userId, phoneNumberId).catch(err =>
        console.error('[Webhook POST] Background Processing Error:', err)
    );
});

// SHARED Webhook Event Handler
async function handleWebhookEvent(req, res, userId, phoneNumberId) {
    const rawBody = req.body;

    // --- SECURITY FIX: TRUST PAYLOAD METADATA OVER URL PARAMS ---
    const entry = rawBody.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const metadata = value?.metadata;

    const payloadPhoneId = metadata?.phone_number_id;

    if (payloadPhoneId && payloadPhoneId !== phoneNumberId) {
        console.warn(`[Webhook Security] Mismatch detected! URL PhoneID: ${phoneNumberId} vs Payload PhoneID: ${payloadPhoneId}`);
        console.log(`[Webhook Security] Rerouting execution to actual owner of ${payloadPhoneId}...`);

        // Re-resolve User ID based on the Payload's Phone ID
        const { data: config, error } = await supabaseAdmin
            .from('whatsapp_config')
            .select('user_id')
            .eq('phone_number_id', payloadPhoneId)
            .maybeSingle();

        if (config && config.user_id) {
            console.log(`[Webhook Security] Switched context to User: ${config.user_id}`);
            userId = config.user_id;
            phoneNumberId = payloadPhoneId;
        } else {
            console.error(`[Webhook Security] No user found for Payload PhoneID: ${payloadPhoneId}. Dropping event to prevent pollution.`);
            return { status: 'ignored', reason: 'payload_phone_id_not_registered' };
        }
    }

    console.log(`[Webhook POST] Event received for User: ${userId}, Phone: ${phoneNumberId}`);
    // console.log('Payload Snippet:', JSON.stringify(rawBody).substring(0, 500)); // Log less to save bytes

    try {
        // 1. Log the raw event (Now logging against the CORRECT user)
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
            if (res) return res.status(200).json({ status: 'success' });
            return { status: 'success' };
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
            if (res) return res.status(200).json({ status: 'success' });
            return { status: 'success' };
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
            return { status: 'success', type: 'history_sync' };
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
            if (res) return res.status(200).json({ status: 'success' });
            return { status: 'success' };
        }

        if (!messages || !Array.isArray(messages)) {
            // Not a message event (could be status update, etc.)
            if (logId) {
                await supabase.rpc('update_webhook_log', {
                    p_log_id: logId,
                    p_processed_status: 'ignored_no_messages'
                });
            }
            return { status: 'success', type: 'ignored_no_messages' };
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

                // --- INBOX LOG ---
                try {
                    const metadata = value?.metadata;
                    const recipientPhone = metadata?.display_phone_number || metadata?.phone_number_id || userId;
                    const logPhoneNumberId = metadata?.phone_number_id || 'Unknown';
                    const logWhatsappNumber = metadata?.display_phone_number || 'Unknown';

                    logInboxMessage('IN_MESSAGE', {
                        to: recipientPhone,
                        from: extracted.from,
                        type: extracted.type,
                        phoneNumberId: logPhoneNumberId,
                        whatsappNumber: logWhatsappNumber,
                        messageTimestamp: extracted.timestamp,
                        content: extracted.text || extracted.caption || (extracted.type === 'interactive' ? (extracted.interactive ? JSON.stringify(extracted.interactive) : 'Interactive') : extracted.type)
                    });
                } catch (logErr) { console.error('Inbox Log Error:', logErr); }

                // --- EARLY PREPARATION ---
                const contactPhone = extracted.from.replace(/\D/g, '');
                let contactName = value.contacts?.find(c => c.wa_id === extracted.from)?.profile?.name || contactPhone;
                if (contactName && contactName.startsWith('+')) contactName = contactName.replace('+', '');

                // Determine DB Text Content
                let dbMessageText = extracted.text || extracted.caption;
                if (!dbMessageText && extracted.type === 'interactive' && extracted.raw?.interactive) {
                    dbMessageText = JSON.stringify(extracted.raw.interactive);
                } else if (!dbMessageText && extracted.type === 'button' && extracted.button?.text) {
                    dbMessageText = extracted.button.text;
                }

                // Determine Preview Text
                let lastMessagePreview = extracted.text || extracted.caption;
                if (extracted.type === 'interactive') {
                    lastMessagePreview = extracted.interactive?.title ? `↩️ ${extracted.interactive.title}` : 'Interactive Message';
                } else if (!lastMessagePreview) {
                    lastMessagePreview = `[${extracted.type}]`;
                }

                // Prepare Flow Input Payload
                const allowedTriggerTypes = ['text', 'interactive', 'button', 'image', 'video', 'audio', 'document'];
                let inputPayload = null;
                let interactionId = null;

                if (allowedTriggerTypes.includes(extracted.type)) {
                    let textContent = extracted.text || '';
                    if (['image', 'video', 'audio', 'document'].includes(extracted.type)) {
                        textContent = extracted.caption || `[${extracted.type}]`;
                        // Media payload will be finalized after download if needed
                        inputPayload = {
                            type: extracted.type,
                            url: null,
                            mime_type: null,
                            filename: extracted.filename || null,
                            caption: extracted.caption
                        };
                    } else if (extracted.type === 'interactive') {
                        if (extracted.interactive?.subtype === 'button_reply') {
                            textContent = extracted.interactive.title;
                            interactionId = extracted.interactive.id;
                            inputPayload = { title: textContent, id: interactionId, selectedId: interactionId };
                        } else if (extracted.interactive?.subtype === 'list_reply') {
                            textContent = extracted.interactive.title;
                            interactionId = extracted.interactive.id;
                            inputPayload = { title: textContent, id: interactionId, description: extracted.interactive.description };
                        } else if (extracted.interactive?.subtype === 'nfm_reply') {
                            const responseJson = extracted.interactive.response_json;
                            inputPayload = responseJson;
                            interactionId = responseJson.flow_token;
                            textContent = JSON.stringify(responseJson);

                            // Save Flow Submission (Async/Fire-and-forget for speed)
                            (async () => {
                                try {
                                    let rawToken = interactionId || 'unknown_flow';
                                    let flowId = rawToken;
                                    if (rawToken.includes('__')) flowId = rawToken.split('__').pop();
                                    if (flowId === 'unused_token') flowId = 'unknown_flow';

                                    let flowName = (flowId === 'unknown_flow') ? 'Unknown Form' : 'Flow ' + flowId;
                                    if (flowId !== 'unknown_flow') {
                                        const { data: flowData } = await supabaseAdmin.from('whatsapp_flows').select('name').eq('id', flowId).maybeSingle();
                                        if (flowData) flowName = flowData.name;
                                    }

                                    await supabaseAdmin.from('whatsapp_flow_submissions').insert({
                                        user_id: userId,
                                        flow_id: flowId,
                                        flow_name: flowName,
                                        contact_phone: extracted.from,
                                        contact_name: contactName,
                                        submission_data: responseJson,
                                        submitted_at: new Date().toISOString()
                                    });
                                } catch (e) { console.error('Flow Sub Error:', e); }
                            })();
                        }
                    } else if (extracted.type === 'button') {
                        textContent = extracted.button.text;
                        interactionId = extracted.button.payload;
                        inputPayload = { title: textContent, id: interactionId, payload: interactionId };
                    } else {
                        inputPayload = textContent;
                    }
                }

                // --- CONCURRENT FLOW EXECUTION (OPTIMIZATION) ---
                let flowPromise = null;
                const isMedia = ['image', 'video', 'audio', 'document', 'sticker'].includes(extracted.type);

                // If NOT media, we can trigger flow concurrently with DB writes
                if (!isMedia && inputPayload) {
                    // Normalize payload
                    if (typeof inputPayload === 'string') inputPayload = { text: inputPayload };
                    if (typeof inputPayload === 'object' && inputPayload !== null) inputPayload.name = contactName;

                    console.log(`[Webhook] OPTIMIZATION: Triggering Flow Engine Concurrently for ${extracted.type}`);
                    flowPromise = processFlowConcurrently(() => flowEngine.processMessage(userId, extracted.from, inputPayload, extracted.type, interactionId))
                        .catch(err => console.error('[Webhook] Concurrent Flow Error:', err));
                }

                // --- MEDIA DOWNLOAD ---
                let mediaUrl = null;
                let filename = null;
                let mimeType = null;

                if (isMedia && extracted.mediaId) {
                    if (accessToken) {
                        try {
                            console.log(`[Webhook] Processing Media message from ${extracted.from} (ID: ${extracted.mediaId})`);
                            const mediaData = await downloadMedia(extracted.mediaId, accessToken, userId);
                            if (mediaData && mediaData.url) {
                                mediaUrl = mediaData.url;
                                mimeType = mediaData.mime_type;
                                filename = extracted.filename || mediaData.filename;
                                console.log(`[Webhook] Media success for ${extracted.from}: ${mediaUrl}`);
                            } else {
                                console.error(`[Webhook] Media download returned NULL for ${extracted.mediaId} from ${extracted.from}`);
                            }
                        } catch (err) {
                            console.error(`[Webhook] Exception in media processing for ${extracted.from}:`, err.message);
                        }
                    } else {
                        console.warn(`[Webhook] Skipping media download for ${extracted.from} - No access token found.`);
                    }
                }

                // --- MANUAL DB OPERATIONS (Sequential) ---
                // 1. Upsert Contact
                let contactId = null;
                const { data: contactData } = await supabaseAdmin.from('contacts').select('id').eq('user_id', userId).eq('phone', contactPhone).maybeSingle();
                if (contactData) {
                    contactId = contactData.id;
                    await supabaseAdmin.from('contacts').update({ name: contactName !== '~' ? contactName : undefined, last_active: new Date(extracted.timestamp * 1000).toISOString(), status: 'active' }).eq('id', contactId);
                } else {
                    const { data: newContact } = await supabaseAdmin.from('contacts').insert({ user_id: userId, phone: contactPhone, name: contactName, last_active: new Date(extracted.timestamp * 1000).toISOString(), status: 'active' }).select().single();
                    contactId = newContact?.id;
                }

                // 2. Upsert Conversation
                let conversationId = null;
                const { data: convData } = await supabaseAdmin.from('conversations').select('id, unread_count').eq('user_id', userId).eq('contact_phone', contactPhone).maybeSingle();
                if (convData) {
                    conversationId = convData.id;
                    await supabaseAdmin.from('conversations').update({ last_message: lastMessagePreview, unread_count: (convData.unread_count || 0) + 1, updated_at: new Date(extracted.timestamp * 1000).toISOString(), contact_name: contactName !== '~' ? contactName : undefined }).eq('id', conversationId);
                } else {
                    const { data: newConv } = await supabaseAdmin.from('conversations').insert({ user_id: userId, contact_phone: contactPhone, contact_name: contactName, last_message: lastMessagePreview, unread_count: 1, updated_at: new Date(extracted.timestamp * 1000).toISOString() }).select().single();
                    conversationId = newConv?.id;
                }

                // 3. Insert Message
                const insertPayload = {
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
                };

                const { data: result, error: rpcError } = await supabaseAdmin.from('messages').insert(insertPayload).select().single();

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

                // --- FLOW ENGINE EXECUTION (For Media OR Sync Wait) ---
                if (isMedia && inputPayload) {
                    // For media, we skipped concurrent trigger because we needed the URL. Trigger now.
                    inputPayload.url = mediaUrl;
                    inputPayload.mime_type = mimeType;
                    inputPayload.filename = filename;
                    if (typeof inputPayload === 'object') inputPayload.name = contactName;

                    await processFlowConcurrently(() => flowEngine.processMessage(userId, extracted.from, inputPayload, extracted.type, interactionId));
                } else if (flowPromise) {
                    // For non-media, we triggered earlier. Await it now to ensure it finishes before we exit the loop iteration 
                    // (Optional, but good for sequential log consistency)
                    await flowPromise;
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

        return { status: 'success', type: 'messages_processed' };

    } catch (error) {
        console.error('Webhook handler error:', error);
        return { status: 'error', message: error.message };
    }
}

module.exports = router;
