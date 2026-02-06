const express = require('express');
const router = express.Router();
const { getAuthenticatedSupabase } = require('../lib/supabaseClient');
const whatsappService = require('../services/whatsappService');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

// Helper to get user ID from request
const getUserId = (req) => req.user.id;

// ==========================================
// 1. Get Conversations
// ==========================================
router.get('/conversations', async (req, res) => {
    try {
        const userId = getUserId(req);
        const supabase = getAuthenticatedSupabase(req);

        const { data, error } = await supabase
            .from('conversations')
            .select('*')
            .eq('user_id', userId)
            .order('updated_at', { ascending: false });

        if (error) throw error;

        res.json(data);
    } catch (error) {
        console.error('Error fetching conversations:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// 2. Get Messages for a Conversation
// ==========================================
router.get('/messages/:conversationId', async (req, res) => {
    try {
        const userId = getUserId(req);
        // const supabase = getAuthenticatedSupabase(req);
        // DEBUG: Use Admin client to bypass RLS for now
        const { supabaseAdmin } = require('../lib/supabaseClient');
        const supabase = supabaseAdmin;
        const { conversationId } = req.params;

        // CONFIGURATION
        const DEFAULT_LIMIT = 50; // Default number of messages to fetch
        const limitInfo = req.query.limit ? parseInt(req.query.limit) : DEFAULT_LIMIT;

        // Fetch most recent messages (Newest First)
        // We order by 'created_at' DESC to get the latest messages (e.g., the last 50).
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: false })
            .limit(limitInfo);

        if (error) throw error;

        // Restore Chronological Order (Oldest -> Newest) for the Chat UI
        // Standard chat interfaces render Top (Old) -> Bottom (New).
        if (data && data.length > 0) {
            data.reverse();
            // DEBUG: Log status of newest messages
            console.log(`[Inbox GET] Returning ${data.length} messages. Last 3 statuses:`,
                data.slice(-3).map(m => ({ id: m.id, wa_id: m.whatsapp_message_id, status: m.status }))
            );
        }

        console.log(`[Inbox] Fetched ${data.length} recent messages for ${conversationId} (Limit: ${limitInfo})`);

        if (data.length > 0) {
            const newest = data[data.length - 1]; // Because we reversed, Newest is at the end
            console.log(`[Inbox] Newest Message: ${newest.id} | ${newest.text?.substring(0, 20)} | Type: ${newest.type} | URL: ${newest.media_url}`);
        }

        res.json(data);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// 3. Send Message (Outbound)
// ==========================================
router.post('/messages/:conversationId', async (req, res) => {
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
        if (type === 'text') {
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
                        if (type === 'video' || type === 'audio') {
                            console.warn(`File size (${fileSizeInBytes}) exceeds 16MB limit for ${type}. Switching to 'document' mode with MIME: ${mimeType}`);
                            type = 'document'; // Force message type to document to allow up to 100MB
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
        await supabase
            .from('conversations')
            .update({
                last_message: text || `[${type}]`,
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

router.post('/upload', upload.single('file'), async (req, res) => {
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
        const filename = `${userId}/outbound/${dateStr}/${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

        // Upload to Supabase
        const { error: uploadError } = await supabaseAdmin.storage
            .from(bucketName)
            .upload(filename, file.buffer, {
                contentType: file.mimetype,
                upsert: false
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
router.post('/conversations/:conversationId/read', async (req, res) => {
    try {
        const userId = getUserId(req);
        const supabase = getAuthenticatedSupabase(req);
        const { conversationId } = req.params;

        // 1. Get unread incoming messages with whatsapp_message_id
        const { data: unreadMessages, error: fetchError } = await supabase
            .from('messages')
            .select('id, whatsapp_message_id')
            .eq('conversation_id', conversationId)
            .eq('direction', 'in')
            .neq('status', 'read');

        if (fetchError) throw fetchError;

        // 2. Mark as read on WhatsApp (Async, don't wait for all)
        if (unreadMessages && unreadMessages.length > 0) {
            // We can process these in background
            Promise.all(unreadMessages.map(async (msg) => {
                if (msg.whatsapp_message_id) {
                    await whatsappService.markAsRead(userId, msg.whatsapp_message_id);
                }
            })).catch(err => console.error('Background markAsRead error:', err));
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
router.delete('/messages/:conversationId', async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { supabaseAdmin } = require('../lib/supabaseClient'); // Use Admin execution to bypass RLS

        console.log(`[Inbox] Clearing chat history for ${conversationId}...`);

        // Delete all messages for this conversation
        const { error, count } = await supabaseAdmin
            .from('messages')
            .delete({ count: 'exact' })
            .eq('conversation_id', conversationId);

        if (error) throw error;

        // Reset Last Message string in conversation
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

module.exports = router;
