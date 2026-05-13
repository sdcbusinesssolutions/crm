const express = require('express');
const router = express.Router();
const { getAuthenticatedSupabase } = require('../lib/supabaseClient');
const requirePermission = require('../middleware/requirePermission');
const whatsappService = require('../services/whatsappService');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

// Helper to get user ID from request
const getUserId = (req) => req.user.id;

// ==========================================
// 1. Get Conversations (Paginated)
// ==========================================
router.get('/conversations', requirePermission('Inbox', 'read'), async (req, res) => {
    try {
        const userId = getUserId(req);
        const { supabaseAdmin } = require('../lib/supabaseClient');
        const supabase = supabaseAdmin;
        
        const { search, quickFilter, filterTag } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        console.log(`[Inbox Debug] Fetching conversations (Page: ${page}, Search: ${search || 'None'}, Filter: ${quickFilter || 'All'}, Tag: ${filterTag || 'None'})`);

        let query = supabase
            .from('conversations')
            .select('id, contact_phone, contact_name, last_message, unread_count, updated_at, status, tags, assigned_to', { count: 'exact' })
            .eq('user_id', userId);

        if (search) {
            query = query.or(`contact_name.ilike.%${search}%,contact_phone.ilike.%${search}%`);
        }

        if (quickFilter === 'Unassigned') {
            query = query.is('assigned_to', null);
        } else if (quickFilter === 'Mine') {
            // Note: In your DB 'me' might be the literal string 'me' or the actual userId.
            // Based on frontend logic (chat.assigned_to !== 'me'), it looks like 'me' is a literal.
            query = query.eq('assigned_to', 'me');
        }

        if (filterTag) {
            query = query.contains('tags', [filterTag]);
        }

        const { data, count, error } = await query
            .order('updated_at', { ascending: false })
            .range(from, to);

        if (error) {
            console.error('[Inbox Debug] DB Error Details:', JSON.stringify(error, null, 2));
            throw error;
        }

        res.json({
            data,
            total: count || 0,
            page,
            limit
        });
    } catch (error) {
        console.error('[Inbox Debug] Final Catch Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// 2. Get Messages for a Conversation
// ==========================================
router.get('/messages/:conversationId', requirePermission('Inbox', 'read'), async (req, res) => {
    try {
        const userId = getUserId(req);
        // const supabase = getAuthenticatedSupabase(req);
        // DEBUG: Use Admin client to bypass RLS for now
        const { supabaseAdmin } = require('../lib/supabaseClient');
        const supabase = supabaseAdmin;
        const { conversationId } = req.params;

        // VERIFY OWNERSHIP: Ensure this conversation belongs to the requesting user
        // Since we use supabaseAdmin later, we must manually check this authorization.
        const { data: ownedConv, error: ownError } = await supabaseAdmin
            .from('conversations')
            .select('id')
            .eq('id', conversationId)
            .eq('user_id', userId)
            .single();

        if (ownError || !ownedConv) {
            console.warn(`[Inbox] Unauthorized access attempt by ${userId} to conversation ${conversationId}`);
            return res.status(403).json({ error: 'Unauthorized or Conversation not found' });
        }

        // CONFIGURATION - Increased limit for better UX
        const DEFAULT_LIMIT = 100; // Fetch more messages by default
        const limitInfo = req.query.limit ? parseInt(req.query.limit) : DEFAULT_LIMIT;
        const offset = req.query.offset ? parseInt(req.query.offset) : 0;

        // Fetch most recent messages (Newest First) with pagination support
        // We order by 'created_at' DESC to get the latest messages.
        let query = supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', ownedConv.id) // Use the verified ID
            .order('created_at', { ascending: false })
            .limit(limitInfo);

        // Add offset for pagination if provided
        if (offset > 0) {
            query = query.range(offset, offset + limitInfo - 1);
        }

        const { data, error } = await query;

        if (error) throw error;

        // Restore Chronological Order (Oldest -> Newest) for the Chat UI
        // Standard chat interfaces render Top (Old) -> Bottom (New).
        if (data && data.length > 0) {
            data.reverse();
            // DEBUG: Log status of newest messages (only if verbose logging needed)
            if (process.env.VERBOSE_LOGGING === 'true') {
                console.log(`[Inbox GET] Returning ${data.length} messages. Last 3 statuses:`,
                    data.slice(-3).map(m => ({ id: m.id, wa_id: m.whatsapp_message_id, status: m.status }))
                );
            }
        }

        console.log(`[Inbox] Fetched ${data.length} messages for ${conversationId} (Limit: ${limitInfo}, Offset: ${offset})`);

        res.json(data);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// 3. Send Message (Outbound)
// ==========================================
router.post('/messages/:conversationId', requirePermission('Inbox', 'read_write'), async (req, res) => {
    try {
        const userId = getUserId(req);
        const supabase = getAuthenticatedSupabase(req);
        const { conversationId } = req.params;
        let { text, type = 'text', media_url } = req.body;

        // 1. Get conversation to find contact phone
        const { data: conversation, error: convError } = await supabase
            .from('conversations')
            .select('contact_phone')
            .eq('id', conversationId)
            .single();

        if (convError || !conversation) throw new Error('Conversation not found');

        // 2. Prepare Content for WhatsApp Service
        let content = {};
        if (type === 'template') {
            content = req.body.template;
        } else if (type === 'text') {
            content = { body: text };
        } else if (['image', 'video', 'audio', 'document', 'sticker'].includes(type)) {
            // Check if media_url is local
            if (media_url && media_url.startsWith('/uploads')) {
                // It's a local file, we need to upload it to WhatsApp first
                const localPath = path.join(__dirname, '..', media_url);
                if (fs.existsSync(localPath)) {
                    console.log(`Uploading local file to WhatsApp: ${localPath}`);
                    const fileBuffer = fs.readFileSync(localPath);
                    const stats = fs.statSync(localPath);
                    const fileSizeInBytes = stats.size;

                    // Enhanced MIME type detection
                    const ext = path.extname(localPath).toLowerCase();
                    const mimeTypes = {
                        '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
                        '.mp4': 'video/mp4', '.3gp': 'video/3gpp', '.mov': 'video/mp4', '.avi': 'video/x-msvideo', '.mkv': 'video/x-matroska', '.webm': 'audio/webm', '.mpeg': 'video/mpeg',
                        '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.opus': 'audio/ogg', '.aac': 'audio/aac', '.wav': 'audio/wav', '.mpeg-audio': 'audio/mpeg',
                        '.pdf': 'application/pdf',
                        '.doc': 'application/msword',
                        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                        '.ppt': 'application/vnd.ms-powerpoint',
                        '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                        '.xls': 'application/vnd.ms-excel',
                        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                        '.csv': 'text/csv',
                        '.txt': 'text/plain',
                        '.json': 'application/json'
                    };

                    let mimeType = mimeTypes[ext] || 'application/octet-stream';

                    // Fallback for unknown text types
                    if (!mimeTypes[ext] && (ext === '.log' || ext === '.md' || ext === '.xml')) {
                        mimeType = 'text/plain';
                    }

                    // --- LARGE FILE HANDLING ---
                    // WhatsApp Cloud API limits: Video/Audio 16MB. Document 100MB.
                    // If file is > 16MB and is Video/Audio, we MUST send as Document.
                    // To bypass the Upload API's strict type check, we force MIME type to 'text/plain' 
                    // (or another 100MB-allowed type) during upload if it exceeds the limit.

                    if (fileSizeInBytes > 15 * 1024 * 1024) { // 15MB (safety buffer)
                        if (type === 'audio') {
                            console.warn(`File size (${fileSizeInBytes}) exceeds 16MB limit for ${type}. Switching to 'document' mode with MIME: ${mimeType}`);
                            type = 'document'; // Force message type to document to allow up to 100MB (audio only fallback)
                        } else if (type === 'video') {
                            console.warn(`File size (${fileSizeInBytes}) > 16MB limit. User requested NO DOCUMENT FALLBACK for videos. Attempting to send as video anyway. It may fail.`);
                        }
                    }

                    // --- AUDIO FORMAT CHECK ---
                    // WhatsApp ONLY supports: audio/aac, audio/mp4, audio/mpeg, audio/amr, audio/ogg
                    // If we have audio/webm (common from browsers), we MUST send as 'document' or it will fail.
                    if (type === 'audio') {
                        const supportedAudio = ['audio/aac', 'audio/mp4', 'audio/mpeg', 'audio/amr', 'audio/ogg'];
                        if (!supportedAudio.includes(mimeType)) {
                            console.warn(`Unsupported audio MIME type: ${mimeType}. Switching to 'document' mode to ensure delivery.`);
                            type = 'document';
                        }
                    }

                    const filename = path.basename(localPath);

                    const mediaId = await whatsappService.uploadMediaToWhatsApp(userId, fileBuffer, mimeType, filename);
                    content = { id: mediaId };
                } else {
                    throw new Error('Local media file not found');
                }
            } else {
                // It's a remote URL (or already an ID? assuming URL for now)
                content = { link: media_url };
            }

            if (text && type !== 'audio' && type !== 'sticker') {
                content.caption = text;
            }
            if (type === 'document') {
                content.filename = path.basename(media_url);
            }
        }

        // 3. Send via WhatsApp Service
        // Pass skipDBLog=true to prevent duplicate insertion by the service logger
        const waResponse = await whatsappService.sendMessage(userId, conversation.contact_phone, type, content, null, true);

        // 4. Save to DB
        const whatsappMessageId = waResponse.messages?.[0]?.id;
        const newMessage = {
            conversation_id: conversationId,
            type,
            text,
            media_url,
            direction: 'out',
            status: 'sent',
            whatsapp_message_id: whatsappMessageId,
            created_at: new Date().toISOString()
        };

        const { data: savedMessage, error: msgError } = await supabase
            .from('messages')
            .insert(newMessage)
            .select()
            .single();

        if (msgError) throw msgError;

        // 5. Update conversation last_message
        const previewText = type === 'template' ? `📄 Template: ${content.name}` : (text || `[${type}]`);
        await supabase
            .from('conversations')
            .update({
                last_message: previewText,
                updated_at: new Date().toISOString()
            })
            .eq('id', conversationId);

        res.json(savedMessage);

    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: error.message });
    }
});

const upload = multer({ storage: multer.memoryStorage() });

router.post('/upload', requirePermission('Inbox', 'read_write'), upload.single('file'), async (req, res) => {
    try {
        const file = req.file;
        if (!file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Use Admin client for Storage operations to ensure permissions
        const { supabaseAdmin } = require('../lib/supabaseClient');
        const bucketName = 'campaign-media';
        const userId = req.user ? req.user.id : 'anonymous';
        const dateStr = new Date().toISOString().split('T')[0];
        const moduleName = req.body.module || 'outbound';
        const filename = `${moduleName}/${userId}/${dateStr}/${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

        // Upload to Supabase
        const { error: uploadError } = await supabaseAdmin.storage
            .from(bucketName)
            .upload(filename, file.buffer, {
                contentType: file.mimetype,
                upsert: false,
                cacheControl: '31536000'
            });

        if (uploadError) throw uploadError;

        // Get Public URL
        const { data: publicUrlData } = supabaseAdmin.storage
            .from(bucketName)
            .getPublicUrl(filename);

        if (!publicUrlData || !publicUrlData.publicUrl) {
            throw new Error('Failed to retrieve public URL');
        }

        res.json({ url: publicUrlData.publicUrl });

    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// 5. Mark Conversation as Read
// ==========================================
router.post('/conversations/:conversationId/read', requirePermission('Inbox', 'read_write'), async (req, res) => {
    try {
        const userId = getUserId(req);
        const supabase = getAuthenticatedSupabase(req);
        const { conversationId } = req.params;

        // 1. Get unread incoming messages with whatsapp_message_id
        const { data: unreadMessages, error: fetchError } = await supabase
            .from('messages')
            .select('id, whatsapp_message_id, created_at')
            .eq('conversation_id', conversationId)
            .eq('direction', 'in')
            .neq('status', 'read')
            .order('created_at', { ascending: true }); // ✅ Sorting added for reliable "latest" detection

        if (fetchError) throw fetchError;

        // 2. Mark as read on WhatsApp
        // ─────────────────────────────────────────────────────────────────
        // Sorting by created_at is CRITICAL. Meta auto-marks all messages 
        // older than the specified ID as read. If we pick a random ID,
        // newer messages will stay unread.
        // ─────────────────────────────────────────────────────────────────
        if (unreadMessages && unreadMessages.length > 0) {
            // Sort to ensure we truly have the latest WhatsApp message
            const sorted = [...unreadMessages]
                .filter(msg => msg.whatsapp_message_id)
                .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

            const latestWithId = sorted.pop();

            if (latestWithId) {
                // Fire-and-forget: mark the newest message as read
                whatsappService.markAsRead(userId, latestWithId.whatsapp_message_id)
                    .catch(err => console.error('Background markAsRead error:', err));
            }
        }

        // 3. Update DB: Mark messages as read
        await supabase
            .from('messages')
            .update({ status: 'read' })
            .eq('conversation_id', conversationId)
            .eq('direction', 'in');

        // 4. Update DB: Reset conversation unread_count
        await supabase
            .from('conversations')
            .update({ unread_count: 0 })
            .eq('id', conversationId);

        res.json({ success: true });

    } catch (error) {
        console.error('Error marking conversation as read:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// 6. Clear Chat History
// ==========================================
router.delete('/messages/:conversationId', requirePermission('Inbox', 'read_write'), async (req, res) => {
    try {
        const userId = getUserId(req);
        const { conversationId } = req.params;
        const { supabaseAdmin } = require('../lib/supabaseClient'); // Use Admin execution to bypass RLS

        // 1. VERIFY OWNERSHIP
        const { data: conversation, error: convErr } = await supabaseAdmin
            .from('conversations')
            .select('user_id')
            .eq('id', conversationId)
            .single();

        if (convErr || !conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        if (conversation.user_id !== userId) {
            console.warn(`[Inbox] Unauthorized clear attempt by ${userId} for conversation ${conversationId}`);
            return res.status(403).json({ error: 'Unauthorized: You do not own this conversation' });
        }

        console.log(`[Inbox] User ${userId} clearing chat history for ${conversationId}...`);

        // 2. Delete all messages for this conversation
        const { error, count } = await supabaseAdmin
            .from('messages')
            .delete({ count: 'exact' })
            .eq('conversation_id', conversationId);

        if (error) throw error;

        // 3. Reset Last Message string in conversation
        await supabaseAdmin
            .from('conversations')
            .update({ last_message: null, updated_at: new Date().toISOString() })
            .eq('id', conversationId);

        console.log(`[Inbox] Cleared chat history for ${conversationId}. Deleted ${count} messages.`);
        res.json({ success: true, count });
    } catch (error) {
        console.error('Error clearing chat history:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// 7. Block Contact (User-Specific)
// ==========================================
router.post('/conversations/:conversationId/block', requirePermission('Inbox', 'read_write'), async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user.id; // Get the authenticated user's ID
        const { supabaseAdmin } = require('../lib/supabaseClient'); // Use Admin execution to bypass RLS

        console.log(`[Inbox] Block request from user ${userId} for conversation ${conversationId}`);

        // 1. Get Conversation to find phone number AND verify ownership
        const { data: conversation, error: convErr } = await supabaseAdmin
            .from('conversations')
            .select('contact_phone, user_id')
            .eq('id', conversationId)
            .single();

        if (convErr || !conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        // 2. Verify the conversation belongs to the requesting user
        if (conversation.user_id !== userId) {
            console.warn(`[Inbox] Unauthorized block attempt. Conversation owner: ${conversation.user_id}, Requestor: ${userId}`);
            return res.status(403).json({ error: 'Unauthorized: You do not own this conversation' });
        }

        const phone = conversation.contact_phone;

        console.log(`[Inbox] Blocking contact with phone ${phone} for user ${userId}...`);

        // 3. Update Contact Status to 'Blocked' ONLY for this specific user
        const { data: updatedContact, error: updateErr } = await supabaseAdmin
            .from('contacts')
            .update({ status: 'Blocked' })
            .eq('phone', phone)
            .eq('user_id', userId) // ✅ CRITICAL: Only update for THIS user
            .select() // Return updated record
            .maybeSingle(); // Use maybeSingle in case contact doesn't exist (only raw conversation)

        if (updateErr) throw updateErr;

        if (!updatedContact) {
            // If contact doesn't exist in 'contacts' table, create it as blocked for THIS user
            console.warn(`[Inbox] Contact not found for phone ${phone} and user ${userId}. Creating blocked contact record.`);

            await supabaseAdmin.from('contacts').insert({
                user_id: userId, // ✅ Use the authenticated user's ID
                phone: phone,
                name: 'Unknown',
                status: 'Blocked',
                source: 'Inbox Block'
            });
        }

        console.log(`[Inbox] Contact ${phone} blocked successfully for user ${userId}.`);
        res.json({ success: true });

    } catch (error) {
        console.error('Error blocking contact:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// 8. Unblock Contact (User-Specific)
// ==========================================
router.post('/conversations/:conversationId/unblock', requirePermission('Inbox', 'read_write'), async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user.id; // Get the authenticated user's ID
        const { supabaseAdmin } = require('../lib/supabaseClient'); // Use Admin execution to bypass RLS

        console.log(`[Inbox] Unblock request from user ${userId} for conversation ${conversationId}`);

        // 1. Get Conversation to find phone number AND verify ownership
        const { data: conversation, error: convErr } = await supabaseAdmin
            .from('conversations')
            .select('contact_phone, user_id')
            .eq('id', conversationId)
            .single();

        if (convErr || !conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        // 2. Verify the conversation belongs to the requesting user
        if (conversation.user_id !== userId) {
            console.warn(`[Inbox] Unauthorized unblock attempt. Conversation owner: ${conversation.user_id}, Requestor: ${userId}`);
            return res.status(403).json({ error: 'Unauthorized: You do not own this conversation' });
        }

        const phone = conversation.contact_phone;

        console.log(`[Inbox] Unblocking contact with phone ${phone} for user ${userId}...`);

        // 3. Update Contact Status to 'Active' ONLY for this specific user
        const { data: updatedContact, error: updateErr } = await supabaseAdmin
            .from('contacts')
            .update({ status: 'Active' })
            .eq('phone', phone)
            .eq('user_id', userId) // ✅ CRITICAL: Only update for THIS user
            .select() // Return updated record
            .maybeSingle(); // Use maybeSingle in case contact doesn't exist

        if (updateErr) throw updateErr;

        if (!updatedContact) {
            // If contact doesn't exist, create it as Active for THIS user
            console.warn(`[Inbox] Contact not found for phone ${phone} and user ${userId}. Creating active contact record.`);

            await supabaseAdmin.from('contacts').insert({
                user_id: userId, // ✅ Use the authenticated user's ID
                phone: phone,
                name: 'Unknown',
                status: 'Active',
                source: 'Inbox Unblock'
            });
        }

        console.log(`[Inbox] Contact ${phone} unblocked successfully for user ${userId}.`);
        res.json({ success: true });

    } catch (error) {
        console.error('Error unblocking contact:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
