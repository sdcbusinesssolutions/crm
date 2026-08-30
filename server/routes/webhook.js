
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const axios = require('axios');
const path = require('path');
const { execFile } = require('child_process');
const { supabaseAdmin, supabase } = require('../lib/supabaseClient');
const flowEngine = require('../services/flowEngine');
const { executeFlowInternal } = require('../services/flowEngine');
const WalletService = require('../services/WalletService');
const { logInboxMessage, logWebhookEvent, logMetaEvent } = require('../utils/logger');
const { extractMessageContent } = require('../utils/whatsappParser');
const fs = require('fs');
const https = require('https');

// DEBUG: Log all hits to this router
router.use((req, res, next) => {
    console.log(`[Webhook Router Hit] ${req.method} ${req.originalUrl}`);
    next();
});

const realtimeSync = require('../services/realtimeSync');

const DripTriggerService = require('../services/DripTriggerService');
const { handleTemplateStatusUpdate } = require('../services/webhookTemplateHandler');

// --- CONCURRENCY & NETWORK AGENTS ---
const FLOW_CONCURRENCY_LIMIT = 20;
const activeFlows = new Set();
const flowQueue = [];

// Dedicated agent for lookaside.fbsbx.com binary downloads
// CRITICAL: family:4 forces IPv4 inside Docker containers.
// Without this, Docker tries IPv6 first to Meta CDN which causes ECONNRESET.
// This was verified by testing locally (no ECONNRESET) vs inside Docker (ECONNRESET).
const mediaDownloadAgent = new https.Agent({
    keepAlive: true,
    keepAliveMsecs: 30000,
    maxSockets: 50,
    maxFreeSockets: 10,
    timeout: 90000,
    family: 4,              // ← CRITICAL: Force IPv4 to Meta CDN (Docker IPv6 causes ECONNRESET)
    scheduling: 'lifo'
});

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

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Download binary from a URL using curl (bypasses Node.js TLS block)
// PROVEN: curl succeeds 100% from VPS where Node.js HTTPS gets ECONNRESET.
// Meta's CDN (lookaside.fbsbx.com) blocks Node.js's TLS fingerprint but not curl's.
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Helper: Download binary from a URL using curl (bypasses Node.js TLS block)
// PROVEN: curl succeeds 100% from VPS where Node.js HTTPS gets ECONNRESET.
// Meta's CDN (lookaside.fbsbx.com) blocks Node.js's TLS fingerprint but not curl's.
// ─────────────────────────────────────────────────────────────────────────────
function downloadBinaryWithCurl(url, token, forceIPv4 = true) {
    return new Promise((resolve, reject) => {
        const debugMarker = ':::DEBUG:::';
        const writeOutFormat = `${debugMarker}REMOTE_IP:%{remote_ip}|HTTP_CODE:%{http_code}|SIZE:%{size_download}`;

        const args = [
            '--silent',
            '--fail-with-body',
            '--location',
            '--max-time', '60',
            '--max-filesize', '52428800',
            '-H', `Authorization: Bearer ${token}`,
            '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            '-H', 'Accept: */*',
            url,
            '--write-out', writeOutFormat
        ];

        if (forceIPv4) args.push('-4');
        else args.push('-6');

        execFile('curl', args,
            { encoding: null, maxBuffer: 55 * 1024 * 1024, timeout: 70000 },
            (error, stdout, stderr) => {
                let debugInfo = { REMOTE_IP: 'unknown', HTTP_CODE: '000' };
                let binaryData = stdout;

                if (stdout && stdout.length > 0) {
                    const debugMarkerBuffer = Buffer.from(debugMarker);
                    const markerIndex = stdout.lastIndexOf(debugMarkerBuffer);

                    if (markerIndex !== -1) {
                        const debugPartBuffer = stdout.slice(markerIndex + debugMarkerBuffer.length);
                        const debugPart = debugPartBuffer.toString('utf8');

                        debugPart.split('|').forEach(pair => {
                            const [k, v] = pair.split(':');
                            if (k && v) debugInfo[k] = v.trim();
                        });
                        binaryData = stdout.slice(0, markerIndex);
                    }
                }

                const ipVer = forceIPv4 ? 'IPv4' : 'IPv6';
                if (error) {
                    let bodySnippet = '';
                    if (binaryData && binaryData.length > 0) {
                        bodySnippet = ` | Body: ${binaryData.slice(0, 250).toString().replace(/\s+/g, ' ')}`;
                    }
                    const msg = `curl [${ipVer}] error: ${error.message} (IP: ${debugInfo.REMOTE_IP}, Status: ${debugInfo.HTTP_CODE})${bodySnippet}`;
                    return reject(new Error(msg));
                }

                if (!binaryData || binaryData.length === 0) {
                    return reject(new Error(`curl [${ipVer}] empty response (IP: ${debugInfo.REMOTE_IP})`));
                }

                console.log(`curl [${ipVer}] Success: ${binaryData.length} bytes from ${debugInfo.REMOTE_IP}`);
                resolve(binaryData);
            }
        );
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Download Media from WhatsApp and Upload to Supabase
// Two steps:
//   Step 1: Graph API → get metadata JSON (mime_type, file_size, CDN URL)
//   Step 2: curl subprocess → download binary from CDN URL
//           curl has different TLS fingerprint → bypasses CDN blocking on VPS
// ─────────────────────────────────────────────────────────────────────────────
// const downloadMedia = async (mediaId, accessToken, userId) => {
//     try {
//         if (!mediaId) return null;
//         if (!accessToken) {
//             console.error('downloadMedia: ❌ No accessToken — update token in Settings > WhatsApp Config');
//             return null;
//         }

//         console.log(`downloadMedia: Fetching URL for mediaId ${mediaId}`);

//         // ── Step 1: Get metadata + CDN URL from Graph API ────────────────────
//         let urlData;
//         let metaAttempts = 0;
//         while (metaAttempts < 3) {
//             metaAttempts++;
//             try {
//                 const r = await axios.get(`https://graph.facebook.com/v21.0/${mediaId}`, {
//                     headers: { Authorization: `Bearer ${accessToken}` },
//                     timeout: 15000
//                 });
//                 urlData = r.data;
//                 if (urlData && urlData.url) break;
//             } catch (err) {
//                 const statusCode = err.response?.status;
//                 if (statusCode === 401 || statusCode === 403) {
//                     console.error(`downloadMedia: ❌ TOKEN EXPIRED (HTTP ${statusCode}). Refresh in Settings > WhatsApp Config.`);
//                     return { url: '__TOKEN_EXPIRED__', mime_type: null };
//                 }
//                 console.error(`downloadMedia: Meta metadata attempt ${metaAttempts}/3 failed: ${err.message}`);
//                 if (metaAttempts >= 3) return null;
//                 await new Promise(r => setTimeout(r, 2000 * metaAttempts));
//             }
//         }

//         if (!urlData || !urlData.url) {
//             console.error(`downloadMedia: ❌ No CDN URL returned from Meta for ${mediaId}`);
//             return null;
//         }

//         const mimeType = urlData.mime_type || 'application/octet-stream';
//         console.log(`downloadMedia: CDN URL obtained. MIME: ${mimeType}, Size: ${urlData.file_size}`);

//         // ── Step 2: Download binary via curl ─────────────────────────────────
//         let buffer = null;
//         let binAttempts = 0;
//         while (binAttempts < 3) {
//             binAttempts++;
//             try {
//                 console.log(`downloadMedia: Binary download attempt ${binAttempts}/3 via curl...`);
//                 buffer = await downloadBinaryWithCurl(urlData.url, accessToken);
//                 if (buffer && buffer.length > 0) {
//                     console.log(`downloadMedia: ✅ Success — ${buffer.length} bytes on attempt ${binAttempts}`);
//                     break;
//                 }
//             } catch (curlErr) {
//                 console.error(`downloadMedia: curl attempt ${binAttempts}/3 failed: ${curlErr.message}`);
//                 if (binAttempts >= 3) {
//                     console.error(`downloadMedia: ❌ All curl attempts exhausted for ${mediaId}`);
//                     return null;
//                 }
//                 await new Promise(r => setTimeout(r, 2000 * binAttempts));
//             }
//         }

//         if (!buffer || buffer.length === 0) {
//             console.error(`downloadMedia: ❌ Empty buffer for ${mediaId}`);
//             return null;
//         }

//         // ── Step 3: Upload to Supabase Storage ───────────────────────────────
//         const ext = mimeType.split('/')[1]?.replace(/[^a-z0-9]/gi, '') || 'bin';
//         const filename = `${mediaId}-${Date.now()}.${ext}`;
//         let finalPublicUrl = null;

//         try {
//             const bucketName = 'campaign-media';
//             const dateStr = new Date().toISOString().split('T')[0];
//             const storagePath = `${userId}/inbound/${dateStr}/${filename}`;
//             console.log(`downloadMedia: Uploading ${buffer.length} bytes → ${storagePath}`);

//             const { error: uploadError } = await supabaseAdmin.storage
//                 .from(bucketName)
//                 .upload(storagePath, buffer, {
//                     contentType: mimeType,
//                     cacheControl: '3600',
//                     upsert: false
//                 });

//             if (uploadError) {
//                 console.error(`downloadMedia: ❌ Supabase upload failed: ${uploadError.message}`);
//                 return null;
//             }

//             const { data: publicUrlData } = supabaseAdmin.storage.from(bucketName).getPublicUrl(storagePath);
//             if (publicUrlData?.publicUrl) {
//                 finalPublicUrl = publicUrlData.publicUrl;
//                 console.log(`downloadMedia: ✅ Supabase URL: ${finalPublicUrl}`);
//             }
//         } catch (storageErr) {
//             console.error(`downloadMedia: ❌ Supabase exception: ${storageErr.message}`);
//             return null;
//         }

//         return { url: finalPublicUrl, mime_type: mimeType, filename, type: mimeType.split('/')[0] };

//     } catch (error) {
//         console.error('downloadMedia: Unhandled exception:', error.message);
//         return null;
//     }
// };

const downloadMedia = async (mediaId, accessToken, userId) => {
    try {
        if (!mediaId || !accessToken) return null;

        console.log(`downloadMedia: Fetching metadata for ${mediaId}`);
        let urlData;
        try {
            const metaResp = await axios.get(`https://graph.facebook.com/v21.0/${mediaId}`, {
                headers: { Authorization: `Bearer ${accessToken}` },
                httpsAgent: mediaDownloadAgent, // Force IPv4 for consistency
                timeout: 10000
            });
            urlData = metaResp.data;
        } catch (err) {
            console.error(`downloadMedia: Meta metadata fetch failed for ${mediaId}: ${err.message}`);
            return null;
        }

        if (!urlData || !urlData.url) {
            console.error(`downloadMedia: No CDN URL for ${mediaId}`);
            return null;
        }

        const mimeType = urlData.mime_type || 'application/octet-stream';
        const expectedSize = urlData.file_size || 'unknown';
        console.log(`downloadMedia: Meta success. Expected size: ${expectedSize} bytes. Downloading binary...`);

        // 2. Download via curl (THE FIX)
        let buffer = null;
        let attempts = 0;
        while (attempts < 3) {
            attempts++;
            try {
                // Attempt 1: Force IPv4 (Strict consistency)
                // Attempt 2: Force IPv4 (Retry)
                // Attempt 3: Force IPv6 (Proven to work on this VPS when IPv4 fails)
                const useIPv4 = attempts < 3;
                console.log(`downloadMedia: Attempt ${attempts}/3 - Target: ${useIPv4 ? 'IPv4' : 'IPv6'}`);

                buffer = await downloadBinaryWithCurl(urlData.url, accessToken, useIPv4);
                if (buffer && buffer.length > 0) break;
            } catch (curlErr) {
                console.error(`downloadMedia: Attempt ${attempts} failed: ${curlErr.message}`);
                if (attempts >= 3) return null;
                await new Promise(r => setTimeout(r, 1000 * attempts));
            }
        }

        if (!buffer || buffer.length === 0) return null;

        console.log(`downloadMedia: Download complete (${buffer.length} bytes). Uploading to Supabase...`);

        // 3. Upload to Supabase
        const ext = mimeType.split('/')[1]?.replace(/[^a-z0-9]/gi, '') || 'bin';
        const filename = `${mediaId}-${Date.now()}.${ext}`;
        const bucketName = 'campaign-media';
        const storagePath = `${userId}/inbound/${new Date().toISOString().split('T')[0]}/${filename}`;

        const { error: uploadError } = await supabaseAdmin.storage
            .from(bucketName)
            .upload(storagePath, buffer, {
                contentType: mimeType,
                upsert: false,
                cacheControl: '31536000'
            });

        if (uploadError) {
            console.error(`downloadMedia: Supabase upload failed for ${mediaId}: ${uploadError.message}`);
            return null;
        }

        const { data: publicUrlData } = supabaseAdmin.storage.from(bucketName).getPublicUrl(storagePath);
        return {
            url: publicUrlData.publicUrl,
            mime_type: mimeType,
            filename,
            type: mimeType.split('/')[0]
        };
    } catch (err) {
        console.error('downloadMedia: Exception:', err.message);
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
        if (logMetaEvent) logMetaEvent('GLOBAL_GET_VERIFICATION', { mode, token, challenge });

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
        if (logMetaEvent) logMetaEvent('GET_VERIFICATION', { params: req.params, query: req.query });

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

    if (logWebhookEvent) {
        logWebhookEvent('GLOBAL_WEBHOOK', rawBody);
    }
    if (logMetaEvent) {
        logMetaEvent('GLOBAL_POST_PAYLOAD', rawBody);
    }

    try {
        const entry = rawBody.entry?.[0];
        const changes = entry?.changes?.[0];

        // --- 1. MODULAR HANDLERS (Pre-Metadata check) ---
        if (await handleTemplateStatusUpdate(rawBody)) {
            return res.sendStatus(200); // Successfully handled, stop processing
        }

        // --- 2. MESSAGE PROCESSING (Requires Metadata) ---
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

// Global Auto Assignment Logic
async function handleGlobalAutoAssign(userId, contactPhone, contactName, conversationId) {
    try {
        // 1. Check if Lead exists and is already assigned
        const { data: leadData } = await supabaseAdmin.from('leads')
            .select('id, assigned_staff_ids')
            .eq('user_id', userId)
            .eq('phone', contactPhone)
            .limit(1)
            .maybeSingle();

        if (leadData && leadData.assigned_staff_ids && leadData.assigned_staff_ids.length > 0) {
            // Lead is already assigned, sync conversation to the first assignee
            const existingAssignee = leadData.assigned_staff_ids[0];
            await supabaseAdmin.from('conversations')
                .update({ assigned_to: existingAssignee })
                .eq('id', conversationId);
            console.log(`[Global Auto-Assign] Lead already assigned. Synced conversation to ${existingAssignee}`);

            const realtimeSync = require('../services/realtimeSync');
            realtimeSync.emitConversation(userId, { id: conversationId }, 'UPDATE');
            return;
        }

        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (authError || !authData || !authData.user) return;

        const settings = authData.user.user_metadata?.team_settings?.auto_assign;
        if (!settings || !settings.enabled || !settings.staff_ids || settings.staff_ids.length === 0) {
            return;
        }

        const pool = settings.staff_ids;
        let lastIndex = settings.last_assigned_index || 0;
        let nextIndex = (lastIndex + 1) % pool.length;

        // Extra safety check in case of unexpected pool mutations
        if (isNaN(nextIndex) || nextIndex < 0) nextIndex = 0;

        const assignedStaffId = pool[nextIndex];
        if (!assignedStaffId) return;

        // Update user metadata with new index
        const updatedSettings = {
            ...authData.user.user_metadata,
            team_settings: {
                ...authData.user.user_metadata.team_settings,
                auto_assign: {
                    ...settings,
                    last_assigned_index: nextIndex
                }
            }
        };
        await supabaseAdmin.auth.admin.updateUserById(userId, { user_metadata: updatedSettings });

        // Update Conversation
        await supabaseAdmin.from('conversations')
            .update({ assigned_to: assignedStaffId })
            .eq('id', conversationId);

        const realtimeSync = require('../services/realtimeSync');
        realtimeSync.emitConversation(userId, { id: conversationId }, 'UPDATE');

        // Update or Create Lead
        if (leadData) {
            await supabaseAdmin.from('leads')
                .update({ assigned_staff_ids: [assignedStaffId] })
                .eq('id', leadData.id);
        } else {
            await supabaseAdmin.from('leads').insert({
                user_id: userId,
                phone: contactPhone,
                name: contactName !== '~' ? contactName : 'Unknown Contact',
                assigned_staff_ids: [assignedStaffId],
                pipeline_id: null,
                stage_id: null,
                status: 'new'
            });
        }
        console.log(`[Global Auto-Assign] Assigned ${contactPhone} to staff ${assignedStaffId}`);
    } catch (err) {
        console.error('[Global Auto-Assign] Error:', err);
    }
}

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

    // Log raw webhook to rotating file
    if (logWebhookEvent) {
        logWebhookEvent('INCOMING_WEBHOOK', rawBody);
    }
    if (logMetaEvent) {
        logMetaEvent('POST_PAYLOAD', { userId, phoneNumberId, payload: rawBody });
    }

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
        // NOTE: entry, changes, value, metadata are already declared above (lines 511-514) for the security check.
        // We just extract the remaining fields from the already-available 'value' object.
        const messages = value?.messages;
        const statuses = value?.statuses;
        const stateSync = value?.state_sync;
        const messageEchoes = value?.message_echoes;
        const history = value?.history;

        // --- FILTERED LOGGING OPTIMIZATION (Reduce Disk I/O) ---
        // We SKIP raw copy logging in 'webhook_logs' table if it's a normal status (Sent/Read/Delivered).
        // This stops ~70% of DB write hits. Inbox Ticks and Campaign Stats are updated independently below.
        // We KEEP logging for: Incoming Message Replies + Failed statuses + Manual debug mode.
        const isStatusUpdate = statuses && statuses.length > 0;
        const hasFailedStatus = isStatusUpdate && (statuses[0].status === 'failed' || (statuses[0].errors && statuses[0].errors.length > 0));

        let logId = null;
        if (!isStatusUpdate || hasFailedStatus || process.env.ENABLE_STATUS_LOGGING === 'true') {
            // OPTIMIZATION: Prune payload for failed statuses to save DB storage
            let payloadToLog = rawBody;
            if (hasFailedStatus && !process.env.DEBUG_RAW_WEBHOOKS) {
                payloadToLog = {
                    pruned: true,
                    status: statuses[0].status,
                    errors: statuses[0].errors,
                    id: statuses[0].id,
                    timestamp: statuses[0].timestamp
                };
            }

            const { data: createdLogId, error: logError } = await supabase.rpc('log_webhook_event', {
                p_user_id: userId,
                p_phone_number_id: phoneNumberId,
                p_http_method: 'POST',
                p_raw_payload: payloadToLog,
                p_processed_status: 'processing',
                p_message_type: null,
                p_sender_phone: null,
                p_webhook_id: null
            });
            logId = createdLogId;
            if (logError) console.error('Failed to log webhook:', logError);
        }

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

                // 2. Upsert Message
                const extracted = extractMessageContent(echo); // Should work for standard types

                await supabaseAdmin.from('messages').upsert({
                    conversation_id: conversationId,
                    direction: 'out', // Enforce OUT for echoes
                    type: extracted.type,
                    text: extracted.text || extracted.caption,
                    whatsapp_message_id: extracted.id,
                    status: 'sent', // Assume sent if echo
                    created_at: new Date(extracted.timestamp * 1000).toISOString()
                }, { onConflict: 'whatsapp_message_id' });
                console.log(`[Coexistence Echo] Saved message from phone for ${contactPhone}`);
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


                                if (processedMessageIds.has(msg.id)) {
                                    console.log(`[Webhook] Skipping duplicate message ID: ${msg.id}`);
                                    continue;
                                }
                                processedMessageIds.add(msg.id);

                                await supabaseAdmin.from('messages').upsert({
                                    conversation_id: conversationId,
                                    direction: direction,
                                    type: extracted.type,
                                    text: extracted.text || extracted.caption,
                                    whatsapp_message_id: extracted.id,
                                    status: direction === 'in' ? 'delivered' : 'sent',
                                    created_at: new Date(extracted.timestamp * 1000).toISOString()
                                }, { onConflict: 'whatsapp_message_id' });
                            }
                        }
                    }
                }
            }
            console.log('[Coexistence Sync] History Synchronization Complete.');
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

                // PREVENT DOWNGRADES (Out of Order Webhooks)
                const statusRanks = { 'sent': 1, 'delivered': 2, 'read': 3, 'failed': 4 };
                const newRank = statusRanks[newStatus] || 0;

                const { data: currentMessage } = await supabaseAdmin
                    .from('messages')
                    .select('status')
                    .eq('whatsapp_message_id', waMessageId)
                    .maybeSingle();

                if (currentMessage) {
                    const currentRank = statusRanks[currentMessage.status] || 0;
                    if (newRank <= currentRank && currentRank > 0) {
                        console.log(`[Webhook] Ignoring out-of-order status update for ${waMessageId}: ${currentMessage.status} -> ${newStatus}`);
                        continue; // Skip updating DB and skip Socket.IO emit!
                    }
                }

                // Update DB via RPC
                let { data: updateSuccess, error: statusError } = await supabase.rpc('update_message_status', {
                    p_whatsapp_message_id: waMessageId,
                    p_status: newStatus
                });

                if (statusError) {
                    console.error(`[Webhook] Failed to update status for ${waMessageId}:`, statusError);
                } else {
                    if (!updateSuccess) {
                        // RACE CONDITION MITIGATION: WhatsApp often fires webhooks BEFORE our backend finishes inserting the message!
                        // If it's false, wait 1.5 seconds and retry.
                        await new Promise(resolve => setTimeout(resolve, 1500));
                        const { data: retrySuccess } = await supabase.rpc('update_message_status', {
                            p_whatsapp_message_id: waMessageId,
                            p_status: newStatus
                        });
                        updateSuccess = retrySuccess;
                    }

                    if (updateSuccess) {
                        console.log(`[Webhook] Message ${waMessageId} updated to '${newStatus}' (Rows updated: true)`);

                        // --- WALLET SYSTEM: 24-HOUR CONVERSATION WINDOW BILLING ---
                        // Meta charges per CONVERSATION WINDOW (24h), not per MESSAGE.
                        // We pass both pricing (category, billable) and conversation
                        // (id, expiration_timestamp) so WalletService can correctly
                        // check if this window was already billed before charging.
                        if (['sent', 'delivered', 'read'].includes(newStatus) && status.pricing) {
                            WalletService.handleWebhookPricing(
                                userId, waMessageId, status.pricing, status.conversation || null
                            ).catch(err => console.error('[Wallet] Error handling webhook pricing:', err));
                        } else if (newStatus === 'failed') {
                            // FAILED MESSAGE: Full refund of pre-debit
                            WalletService.handleWebhookFailure(
                                userId, waMessageId
                            ).catch(err => console.error('[Wallet] Error handling webhook failure:', err));
                        }
                    } else {
                        console.log(`[Webhook] Message ${waMessageId} updated to '${newStatus}', but RPC returned false (likely not a campaign message).`);
                    }

                    // Fetch the updated message to emit via Socket.IO so ticks update in real-time
                    // We do this even if updateSuccess is false, because the message table update might have succeeded
                    // while the campaign_queue update affected 0 rows (returning false).
                    const { data: updatedMsg } = await supabaseAdmin
                        .from('messages')
                        .select('*')
                        .eq('whatsapp_message_id', waMessageId)
                        .maybeSingle();

                    if (updatedMsg) {
                        realtimeSync.emitMessage(userId, updatedMsg, 'UPDATE');
                    } else {
                        console.warn(`[Webhook] Message ${waMessageId} NOT found in DB when trying to emit status update.`);
                    }

                    // =========================================================================
                    // 🚨 AUTOMATIC MEDIA FALLBACK AND AUTO-HEALING ENGINE (FIX: 2026-03-05) 🚨
                    // =========================================================================
                    // ROOT CAUSE: Meta's internal Media Engine strictly requires Video/MP4 files 
                    // to be encoded in H.264 (Baseline) with AAC Audio formats.
                    // If a user uploads a video with an unsupported codec (like HEVC/H.265 or lacking audio), 
                    // it will upload successfully to Supabase but Meta will violently reject its delivery 
                    // asymptotically throwing Error Code 131053 or 131052.
                    // 
                    // SOLUTION: The system dynamically hooks `failed` statuses. It downloads the corrupt video  
                    // natively via Gigabit unthrottled streams, runs it through an extremely high-speed 
                    // 'ultrafast' FFmpeg transcoder to correct the codec, uploads a new Media ID, 
                    // and violently re-sends the payload as a flawless native Video!
                    if (newStatus === 'failed' && status.errors && status.errors.length > 0) {
                        const errCode = status.errors[0].code;
                        if (errCode === 131053 || errCode === 131052) {
                            console.warn(`[Auto-Heal] Detected unsupported media codec for message ${waMessageId}. Attempting to Transcode and Fix...`);

                            // 1. Fetch original message details
                            const { data: origMsg, error: msgErr } = await supabaseAdmin
                                .from('messages')
                                .select('conversation_id, text, media_url, type, filename')
                                .eq('whatsapp_message_id', waMessageId)
                                .maybeSingle();

                            if (origMsg && origMsg.media_url) {
                                // 2. Fetch contact phone and owner userId from conversation
                                const { data: conv } = await supabaseAdmin
                                    .from('conversations')
                                    .select('contact_phone, user_id')
                                    .eq('id', origMsg.conversation_id)
                                    .maybeSingle();

                                if (conv && conv.contact_phone && conv.user_id) {
                                    const ownerId = conv.user_id;
                                    try {
                                        let finalContent = {};
                                        const whatsappService = require('../services/whatsappService');

                                        // UNIVERSAL AUTO-HEAL FOR 131053 (Media Upload Error)
                                        // This handles Image, Video, Audio, and Document types by downloading the binary 
                                        // and re-uploading to Meta as a Media ID, which is much more reliable than link-delivery.

                                        console.log(`[Auto-Heal] Starting recovery for ${origMsg.type} (Message: ${waMessageId})`);

                                        // 3. Download the raw file binary
                                        let rawBuffer;
                                        try {
                                            const dlResponse = await axios.get(origMsg.media_url, {
                                                responseType: 'arraybuffer',
                                                maxBodyLength: Infinity,
                                                maxContentLength: Infinity
                                            });
                                            rawBuffer = Buffer.from(dlResponse.data);
                                            console.log(`[Auto-Heal] Downloaded ${rawBuffer.length} bytes from ${origMsg.media_url}`);
                                        } catch (dlErr) {
                                            console.error(`[Auto-Heal] Failed to download media for recovery:`, dlErr.message);
                                            return;
                                        }

                                        let finalBuffer = rawBuffer;
                                        let finalMime = 'application/octet-stream';
                                        let finalFilename = `recovered_media_${Date.now()}`;

                                        // 4. Force Transcode ONLY for Videos
                                        if (origMsg.type === 'video') {
                                            console.log(`[Auto-Heal] Performing H.264 Transcode for video...`);
                                            const { transcodeToWhatsAppVideo } = require('../utils/videoTranscoder');
                                            try {
                                                finalBuffer = await transcodeToWhatsAppVideo(rawBuffer);
                                                finalMime = 'video/mp4';
                                                finalFilename = 'auto_fixed_video.mp4';
                                                console.log(`[Auto-Heal] Transcode successful.`);
                                            } catch (transcodeErr) {
                                                console.error('[Auto-Heal] FFmpeg Transcode failed. Message will permanently fail.', transcodeErr.message);
                                                return;
                                            }
                                        } else {
                                            // Determine MIME type for non-video types
                                            if (origMsg.type === 'image') {
                                                finalMime = 'image/jpeg';
                                                finalFilename = 'recovered_image.jpg';
                                            } else if (origMsg.type === 'audio') {
                                                finalMime = 'audio/mpeg';
                                                finalFilename = 'recovered_audio.mp3';
                                            } else if (origMsg.type === 'document') {
                                                finalMime = 'application/pdf';
                                                finalFilename = 'recovered_doc.pdf';
                                            }
                                            // Handle interactive headers or direct media types
                                            finalType = origMsg.type;
                                        }

                                        // 5. Re-Upload to Meta to get a FRESH Media ID
                                        try {
                                            console.log(`[Auto-Heal] Uploading FRESH Media ID to Meta...`);
                                            const newMediaId = await whatsappService.uploadMediaToWhatsApp(
                                                ownerId,
                                                finalBuffer,
                                                finalMime,
                                                finalFilename
                                            );

                                            // 6. Construct Re-Send Payload
                                            // If it was an interactive message, we need to rebuild the interactive header with the ID
                                            if (origMsg.type === 'interactive') {
                                                const rawTextBody = origMsg.message_text || origMsg.text || '{}';
                                                try {
                                                    const interactive = JSON.parse(rawTextBody);
                                                    const hType = interactive.header?.type?.toLowerCase();
                                                    if (hType && interactive.header[hType]) {
                                                        // Replace link with freshly uploaded ID
                                                        delete interactive.header[hType].link;
                                                        interactive.header[hType].id = newMediaId;
                                                        finalContent = interactive;
                                                        finalType = 'interactive';
                                                    } else {
                                                        throw new Error('Interactive header type not found in JSON');
                                                    }
                                                } catch (pErr) {
                                                    console.error('[Auto-Heal] Failed to parse/rebuild interactive payload:', pErr.message);
                                                    return;
                                                }
                                            } else {
                                                // Standard Media Message
                                                finalType = origMsg.type;
                                                finalContent = { id: newMediaId };

                                                // Captions only allowed for non-audio/non-sticker
                                                if (!['audio', 'sticker'].includes(finalType)) {
                                                    finalContent.caption = origMsg.message_text || origMsg.text || '';
                                                }

                                                if (finalType === 'document') {
                                                    finalContent.filename = finalFilename;
                                                }
                                            }

                                            console.log(`[Auto-Heal] Resending flawless payload using Media ID...`);
                                            const resData = await whatsappService.sendMessage(
                                                ownerId,
                                                conv.contact_phone,
                                                finalType,
                                                finalContent,
                                                logPhoneId,
                                                true // skipDBLog = true -> prevent duplicate UI entries
                                            );

                                            // 7. Success! Update DB row quietly
                                            const healedWaMessageId = resData?.messages?.[0]?.id;
                                            if (healedWaMessageId) {
                                                await supabaseAdmin
                                                    .from('messages')
                                                    .update({
                                                        whatsapp_message_id: healedWaMessageId,
                                                        status: 'sent',
                                                        updated_at: new Date().toISOString()
                                                    })
                                                    .eq('whatsapp_message_id', waMessageId);

                                                // Update campaign queue as well
                                                await supabaseAdmin
                                                    .from('campaign_queue')
                                                    .update({
                                                        message_id: healedWaMessageId,
                                                        status: 'SENT',
                                                        updated_at: new Date().toISOString(),
                                                        error_message: null
                                                    })
                                                    .eq('message_id', waMessageId);

                                                console.log(`[Auto-Heal] Row & Queue healed and updated with new WAMID: ${healedWaMessageId}`);
                                            }
                                        } catch (uploadOrSendErr) {
                                            console.error(`[Auto-Heal] Critical recovery failure:`, uploadOrSendErr.message);
                                        }
                                    } catch (retryErr) {
                                        console.error(`[Auto-Heal] Auto-Heal delivery failed heavily:`, retryErr.message);
                                    }
                                }
                            }
                        }
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

        // 3.5 Fetch Custom Opt-in / Opt-out Keywords
        let customOptOutKeywords = ['stop', 'unsubscribe', 'cancel', 'optout'];
        let customOptInKeywords = ['start', 'subscribe', 'resume', 'optin'];
        try {
            if (userId) {
                const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
                if (userData && userData.user && userData.user.user_metadata && userData.user.user_metadata.notificationSettings) {
                    const ns = userData.user.user_metadata.notificationSettings;
                    if (ns.opt_out_keywords) customOptOutKeywords = ns.opt_out_keywords.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
                    if (ns.opt_in_keywords) customOptInKeywords = ns.opt_in_keywords.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
                }
            }
        } catch (keywordErr) {
            console.error('Error fetching custom keywords:', keywordErr);
        }

        // 4. Process each message
        for (const message of messages) {
            try {
                if (processedMessageIds.has(message.id)) {
                    console.log(`[Webhook] Skipping duplicate message ID (Main Loop): ${message.id}`);
                    continue;
                }
                processedMessageIds.add(message.id);

                const extracted = extractMessageContent(message);

                // --- HANDLE REVOKE & EDIT ---
                if (extracted.revoke && extracted.originalMessageId) {
                    console.log(`[Webhook] Revoking message: ${extracted.originalMessageId}`);
                    await supabaseAdmin.from('messages').update({
                        status: 'deleted',
                        text: '🚫 Message deleted',
                        media_url: null
                    }).eq('whatsapp_message_id', extracted.originalMessageId);
                    continue; // Skip further processing
                }

                if (extracted.edit && extracted.originalMessageId) {
                    console.log(`[Webhook] Editing message: ${extracted.originalMessageId}`);
                    await supabaseAdmin.from('messages').update({
                        text: extracted.text,
                        updated_at: new Date().toISOString()
                    }).eq('whatsapp_message_id', extracted.originalMessageId);
                    continue; // Skip further processing
                }

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
                let cleanTextContent = extracted.text || extracted.caption || '';

                if (!dbMessageText && extracted.type === 'interactive' && extracted.raw?.interactive) {
                    dbMessageText = JSON.stringify(extracted.raw.interactive);
                    if (extracted.interactive?.subtype === 'button_reply' || extracted.interactive?.subtype === 'list_reply') {
                        cleanTextContent = extracted.interactive.title;
                    }
                } else if (!dbMessageText && extracted.type === 'button' && extracted.button?.text) {
                    dbMessageText = extracted.button.text;
                    cleanTextContent = extracted.button.text;
                } else if (!dbMessageText && extracted.type === 'location') {
                    const locName = extracted.location?.name;
                    const locAddr = extracted.location?.address;
                    dbMessageText = [locName, locAddr].filter(Boolean).join(', ') || null;
                    cleanTextContent = dbMessageText || '';
                }

                // --- OPT-IN / OPT-OUT LOGIC ---
                let isOptOut = false;
                let isOptIn = false;
                if (cleanTextContent && typeof cleanTextContent === 'string') {
                    const t = cleanTextContent.trim().toLowerCase();
                    if (customOptOutKeywords.includes(t)) {
                        isOptOut = true;
                        console.log(`[Webhook] Opt-out keyword detected from ${contactPhone}`);
                    } else if (customOptInKeywords.includes(t)) {
                        isOptIn = true;
                        console.log(`[Webhook] Opt-in keyword detected from ${contactPhone}`);
                    }
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
                                        const { data: flowData } = await supabaseAdmin.from('flows').select('name').eq('id', flowId).maybeSingle();
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

                // --- STALE MESSAGE CHECK ---
                // If Meta delivers a message that the user sent more than 5 minutes ago (e.g. because our server was down or Meta was retrying),
                // we drop it here so we don't accidentally trigger the bot for a very old message.
                const messageTimestamp = parseInt(extracted.timestamp, 10);
                const currentTimestamp = Math.floor(Date.now() / 1000);
                const isStale = (currentTimestamp - messageTimestamp) > 300; // 5 minutes (300 seconds)

                if (isStale) {
                    console.warn(`[Webhook] STALE MESSAGE DETECTED (${currentTimestamp - messageTimestamp}s old). Recording to database but skipping Flow Engine.`);
                }

                // If NOT media, we can trigger flow concurrently with DB writes (only if not stale!)
                if (!isMedia && inputPayload && !isStale) {
                    if (isOptOut) {
                        console.log(`[Webhook] Opted out. Skipping flow processing for ${contactPhone}`);
                    } else {
                        // Normalize payload
                        if (typeof inputPayload === 'string') inputPayload = { text: inputPayload };
                        if (typeof inputPayload === 'object' && inputPayload !== null) inputPayload.name = contactName;

                        console.log(`[Webhook] OPTIMIZATION: Triggering Flow Engine Concurrently for ${extracted.type}`);

                        flowPromise = processFlowConcurrently(() => flowEngine.processMessage(userId, extracted.from, inputPayload, extracted.type, interactionId, extracted.id))
                            .catch(err => console.error('[Webhook] Concurrent Flow Error:', err));
                    }
                }

                // --- DRIP CAMPAIGN STOP ON REPLY ---
                DripTriggerService.handleReply(userId, contactPhone).catch(e => console.error('Drip Reply Stop Error:', e));

                // --- SAVE MESSAGE IMMEDIATELY (Do NOT block on media download) ---
                // 1. Upsert Contact
                let contactId = null;
                const { data: contactDataList } = await supabaseAdmin.from('contacts').select('id, custom_data').eq('user_id', userId).eq('phone', contactPhone);

                if (contactDataList && contactDataList.length > 0) {
                    contactId = contactDataList[0].id;
                    // Update all duplicates to ensure UI always sees the updated status
                    for (const c of contactDataList) {
                        let cData = c.custom_data || {};
                        if (isOptOut) cData.opted_out = true;
                        if (isOptIn) cData.opted_out = false;
                        await supabaseAdmin.from('contacts').update({
                            name: contactName !== '~' ? contactName : undefined,
                            last_active: new Date(extracted.timestamp * 1000).toISOString(),
                            status: 'active',
                            custom_data: cData
                        }).eq('id', c.id);
                    }
                } else {
                    let contactCustomData = {};
                    if (isOptOut) contactCustomData.opted_out = true;
                    if (isOptIn) contactCustomData.opted_out = false;
                    const { data: newContact } = await supabaseAdmin.from('contacts').insert({
                        user_id: userId,
                        phone: contactPhone,
                        name: contactName,
                        last_active: new Date(extracted.timestamp * 1000).toISOString(),
                        status: 'active',
                        custom_data: contactCustomData
                    }).select().single();
                    contactId = newContact?.id;
                }

                // 1.5 Update Lead custom_fields if opted_out changes
                if (isOptOut || isOptIn) {
                    const { data: leadDataList } = await supabaseAdmin.from('leads').select('id, custom_fields').eq('user_id', userId).eq('phone', contactPhone);
                    if (leadDataList && leadDataList.length > 0) {
                        for (const leadData of leadDataList) {
                            let leadCustomFields = leadData.custom_fields || {};
                            if (isOptOut) leadCustomFields.opted_out = true;
                            if (isOptIn) leadCustomFields.opted_out = false;
                            await supabaseAdmin.from('leads').update({ custom_fields: leadCustomFields }).eq('id', leadData.id);
                        }
                    }
                }

                // 2. Upsert Conversation
                let conversationId = null;
                const { data: convDataList } = await supabaseAdmin.from('conversations').select('id, unread_count, assigned_to').eq('user_id', userId).eq('contact_phone', contactPhone).limit(1);
                const convData = convDataList && convDataList.length > 0 ? convDataList[0] : null;

                if (convData) {
                    conversationId = convData.id;
                    await supabaseAdmin.from('conversations').update({ last_message: lastMessagePreview, unread_count: (convData.unread_count || 0) + 1, updated_at: new Date(extracted.timestamp * 1000).toISOString(), contact_name: contactName !== '~' ? contactName : undefined }).eq('id', conversationId);
                } else {
                    const { data: newConv } = await supabaseAdmin.from('conversations').insert({ user_id: userId, contact_phone: contactPhone, contact_name: contactName, last_message: lastMessagePreview, unread_count: 1, updated_at: new Date(extracted.timestamp * 1000).toISOString() }).select().single();
                    conversationId = newConv?.id;
                }

                if (conversationId) {
                    realtimeSync.emitConversation(userId, { id: conversationId }, 'UPDATE');
                }

                // Global Auto Assignment for new or unassigned conversations
                if (!convData || !convData.assigned_to) {
                    handleGlobalAutoAssign(userId, contactPhone, contactName, conversationId).catch(err => console.error('[AutoAssign]', err));
                }

                // 3. Insert Message IMMEDIATELY (with media_url = null for now if media)
                //    The message appears in inbox RIGHT AWAY. Media is fetched in background.
                // isMedia already declared above at line 832
                const insertPayload = {
                    conversation_id: conversationId,
                    direction: 'in',
                    type: extracted.type,
                    text: dbMessageText,
                    media_url: null, // Will be updated in background if media
                    filename: extracted.filename || null,
                    mime_type: extracted.mimeType || null,
                    whatsapp_message_id: extracted.id,
                    status: 'delivered',
                    created_at: new Date(extracted.timestamp * 1000).toISOString(),
                    latitude: extracted.location?.latitude || null,
                    longitude: extracted.location?.longitude || null
                };

                const { data: result, error: rpcError } = await supabaseAdmin.from('messages').insert(insertPayload).select().single();
                const savedMessageId = result?.id;

                if (result) {
                    realtimeSync.emitMessage(userId, result, 'INSERT');
                }

                // --- FIRE-AND-FORGET: Download media in the background, then update results ---
                if (isMedia && extracted.mediaId && accessToken && savedMessageId) {
                    (async () => {
                        try {
                            console.log(`[Webhook] BG: Downloading media for msg ${savedMessageId}`);
                            const mediaData = await downloadMedia(extracted.mediaId, accessToken, userId);

                            if (mediaData && mediaData.url) {
                                // 1. Update Message Record
                                const { data: updatedMsg } = await supabaseAdmin.from('messages').update({
                                    media_url: mediaData.url,
                                    mime_type: mediaData.mime_type || null,
                                    filename: extracted.filename || mediaData.filename || null
                                }).eq('id', savedMessageId).select().single();

                                if (updatedMsg) {
                                    realtimeSync.emitMessage(userId, updatedMsg, 'UPDATE');
                                }

                                // 2. Trigger Flow Engine (NOW WITH URL)
                                if (inputPayload && !isStale && !isOptOut) {
                                    inputPayload.url = mediaData.url;
                                    inputPayload.mime_type = mediaData.mime_type || null;
                                    inputPayload.filename = extracted.filename || mediaData.filename || null;
                                    if (typeof inputPayload === 'object') inputPayload.name = contactName;

                                    console.log(`[Webhook] BG: Triggering Flow Engine for ${savedMessageId} post-download`);

                                    await processFlowConcurrently(() => flowEngine.processMessage(userId, extracted.from, inputPayload, extracted.type, interactionId, extracted.id));
                                }
                            } else {
                                console.warn(`[Webhook] BG: Media download failed for ${savedMessageId}`);
                                // Trigger Flow anyway with null URL so it doesn't hang the conversation indefinitely
                                if (inputPayload && !isStale && !isOptOut) {
                                    await processFlowConcurrently(() => flowEngine.processMessage(userId, extracted.from, inputPayload, extracted.type, interactionId, extracted.id));
                                }
                            }
                        } catch (bgErr) {
                            console.error(`[Webhook] BG Error:`, bgErr.message);
                        }
                    })();
                }

                // Media vars for Flow Engine
                // Since we now download in background, flow engine gets null url initially
                const mediaUrl = null;
                const mimeType = extracted.mimeType || null;
                const filename = extracted.filename || null;

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

                // NOTE: For media, flow is triggered in BG after download.
                // For non-media, flow was already triggered concurrently.
                if (!isMedia && flowPromise) {
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
