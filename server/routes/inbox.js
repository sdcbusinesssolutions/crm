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
// 1. Fetch Conversations with optional Search/Filters
// ==========================================
router.post('/conversations', requirePermission('Inbox', 'read_write'), async (req, res) => {
    try {
        const userId = getUserId(req);
        const supabase = getAuthenticatedSupabase(req);
        const { contactPhone } = req.body;
        
        const cleanPhone = contactPhone.replace(/\D/g, '');

        const { data: existing } = await supabase
            .from('conversations')
            .select('*')
            .eq('user_id', userId)
            .eq('contact_phone', cleanPhone)
            .single();

        if (existing) {
            return res.json(existing);
        }

        const { data: newConv, error } = await supabase
            .from('conversations')
            .insert({
                user_id: userId,
                contact_phone: cleanPhone,
                status: 'open',
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;
        res.json(newConv);
    } catch (error) {
        console.error('Error creating conversation:', error);
        res.status(500).json({ error: error.message });
    }
});

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
            .select('id, contact_phone, contact_name, last_message, unread_count, updated_at, status, tags, assigned_to, bot_paused_until, assigned_ai_agent_id', { count: 'exact' })
            .eq('user_id', userId);

        // Filter by assigned leads if restricted
        if (req.staff && req.staff.permissions && req.staff.permissions.only_assigned_leads === 'all_access') {
            const { data: assignedLeads } = await supabase
                .from('leads')
                .select('phone')
                .eq('user_id', userId)
                .contains('assigned_staff_ids', [req.staff.staffId]);
            
            const assignedPhones = (assignedLeads || []).map(l => l.phone).filter(Boolean);
            if (assignedPhones.length > 0) {
                query = query.in('contact_phone', assignedPhones);
            } else {
                query = query.in('contact_phone', ['dummy-no-phone']);
            }
        }

        if (search) {
            query = query.or(`contact_name.ilike.%${search}%,contact_phone.ilike.%${search}%`);
        }

        if (quickFilter === 'Unassigned') {
            query = query.is('assigned_to', null);
        } else if (quickFilter === 'Mine') {
            const currentUserId = req.staff ? req.staff.staffId : userId;
            
            // First get all leads assigned to this user
            const { data: myLeads } = await supabase
                .from('leads')
                .select('phone')
                .eq('user_id', userId)
                .contains('assigned_staff_ids', [currentUserId]);
                
            const myPhones = (myLeads || []).map(l => l.phone).filter(Boolean);
            
            if (myPhones.length > 0) {
                // Prevent URI Too Long error and safely double-quote strings to protect '+' signs
                const safeMyPhones = myPhones.slice(0, 300).map(p => `"${p.replace(/"/g, '')}"`).join(',');
                query = query.or(`assigned_to.eq.${currentUserId},contact_phone.in.(${safeMyPhones})`);
            } else {
                // If no leads, just check conversation direct assignment
                query = query.eq('assigned_to', currentUserId);
            }
        } else if (quickFilter && quickFilter.startsWith('staff:')) {
            const staffId = quickFilter.split(':')[1];
            
            // First get all leads assigned to this staff member
            const { data: staffLeads } = await supabase
                .from('leads')
                .select('phone')
                .eq('user_id', userId)
                .contains('assigned_staff_ids', [staffId]);
                
            const staffPhones = (staffLeads || []).map(l => l.phone).filter(Boolean);
            
            if (staffPhones.length > 0) {
                // Prevent URI Too Long error by limiting the array size in the query
                // and correctly double-quote strings to protect '+' signs in PostgREST
                const safePhones = staffPhones.slice(0, 300).map(p => `"${p.replace(/"/g, '')}"`).join(',');
                query = query.or(`assigned_to.eq.${staffId},contact_phone.in.(${safePhones})`);
            } else {
                query = query.eq('assigned_to', staffId);
            }
        }

        if (filterTag && filterTag !== 'All') {
            const lower = filterTag.toLowerCase();
            const upper = filterTag.toUpperCase();
            const title = lower.charAt(0).toUpperCase() + lower.slice(1);
            
            // 1. Fetch contacts from CRM that have this tag (e.g. added via Flow Builder)
            const { data: taggedContacts } = await supabase
                .from('contacts')
                .select('phone')
                .eq('user_id', userId)
                .overlaps('tags', [filterTag, lower, upper, title]);
                
            const taggedPhones = (taggedContacts || []).map(c => c.phone).filter(Boolean);
            
            if (taggedPhones.length > 0) {
                // 2. If CRM contacts have this tag, filter conversations that EITHER have the tag natively OR belong to these contacts
                const safePhones = taggedPhones.slice(0, 300).map(p => `"${p.replace(/"/g, '')}"`).join(',');
                const ovArray = `{"${filterTag}","${lower}","${upper}","${title}"}`;
                query = query.or(`tags.ov.${ovArray},contact_phone.in.(${safePhones})`);
            } else {
                // 3. Otherwise, just filter by conversation-level tags
                query = query.overlaps('tags', [filterTag, lower, upper, title]);
            }
        }

        const { data, count, error } = await query
            .order('updated_at', { ascending: false })
            .range(from, to);

        if (error) {
            console.error('[Inbox Debug] DB Error Details:', JSON.stringify(error, null, 2));
            throw error;
        }

        // 1. Manually fetch the contact tags from CRM for these specific conversations
        // (Since there is no direct foreign key between conversations and contacts)
        const activePhones = (data || []).map(c => c.contact_phone).filter(Boolean);
        let contactTagsMap = {};
        
        if (activePhones.length > 0) {
            const { data: crmContacts } = await supabase
                .from('contacts')
                .select('phone, tags')
                .eq('user_id', userId)
                .in('phone', activePhones);
                
            if (crmContacts) {
                crmContacts.forEach(c => {
                    contactTagsMap[c.phone] = Array.isArray(c.tags) ? c.tags : [];
                });
            }
        }

        // 2. Merge tags from the contact level (CRM/Flow Builder) into the conversation tags
        // so the frontend visibly displays them on the chat snippet.
        const mergedData = (data || []).map(chat => {
            const chatTags = Array.isArray(chat.tags) ? chat.tags : [];
            const cTags = contactTagsMap[chat.contact_phone] || [];
            
            // Merge and deduplicate (case-insensitive deduplication)
            const combined = [...chatTags];
            for (const tag of cTags) {
                if (!combined.some(t => t.toLowerCase() === tag.toLowerCase())) {
                    combined.push(tag);
                }
            }
            
            return {
                ...chat,
                tags: combined
            };
        });

        res.json({
            data: mergedData,
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
            .select('id, contact_phone')
            .eq('id', conversationId)
            .eq('user_id', userId)
            .single();

        if (ownError || !ownedConv) {
            console.warn(`[Inbox] Unauthorized access attempt by ${userId} to conversation ${conversationId}`);
            return res.status(403).json({ error: 'Unauthorized or Conversation not found' });
        }

        // Additional staff only-assigned filter to secure reading individual messages
        if (req.staff && req.staff.permissions && req.staff.permissions.only_assigned_leads === 'all_access') {
            const { data: assignedLead } = await supabaseAdmin
                .from('leads')
                .select('id')
                .eq('user_id', userId)
                .eq('phone', ownedConv.contact_phone)
                .contains('assigned_staff_ids', [req.staff.staffId])
                .limit(1)
                .maybeSingle();

            if (!assignedLead) {
                console.warn(`[Inbox] Restricted staff member ${req.staff.staffId} attempted to fetch messages for unauthorized conversation: ${conversationId}`);
                return res.status(403).json({ error: 'Unauthorized: This conversation lead is not assigned to you' });
            }
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
                
                // --- AUDIO FORMAT CHECK FOR REMOTE URLS ---
                // WhatsApp ONLY supports: audio/aac, audio/mp4, audio/mpeg, audio/amr, audio/ogg
                // WebM from browser MediaRecorder will be rejected. Fallback to document.
                if (type === 'audio') {
                    const cleanUrl = media_url.split('?')[0];
                    const ext = path.extname(cleanUrl).toLowerCase();
                    const supportedExts = ['.aac', '.mp4', '.mpeg', '.amr', '.ogg', '.mp3'];
                    if (!supportedExts.includes(ext)) {
                        console.warn(`Unsupported remote audio extension: ${ext}. Switching to 'document' mode to ensure delivery.`);
                        type = 'document';
                    }
                }
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

        // 5. Update conversation last_message and pause AI
        const previewText = type === 'template' ? `📄 Template: ${content.name}` : (text || `[${type}]`);
        const pauseUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        await supabase
            .from('conversations')
            .update({
                last_message: previewText,
                updated_at: new Date().toISOString(),
                bot_paused_until: pauseUntil
            })
            .eq('id', conversationId);

        res.json(savedMessage);

    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: error.message });
    }
});

// Toggle AI Pause Status
router.post('/messages/:conversationId/toggle-ai', requirePermission('Inbox', 'read_write'), async (req, res) => {
    try {
        const userId = getUserId(req);
        const { supabaseAdmin } = require('../lib/supabaseClient');
        const { conversationId } = req.params;
        const { paused } = req.body;
        
        const pauseUntil = paused ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null;
        
        const { error } = await supabaseAdmin
            .from('conversations')
            .update({ bot_paused_until: pauseUntil })
            .eq('id', conversationId)
            .eq('user_id', userId);
            
        if (error) throw error;
        res.json({ success: true, bot_paused_until: pauseUntil });
    } catch (error) {
        console.error('Error toggling AI status:', error);
        res.status(500).json({ error: error.message });
    }
});

// Assign AI Agent to Conversation
router.post('/messages/:conversationId/assign-ai', requirePermission('Inbox', 'read_write'), async (req, res) => {
    try {
        const userId = getUserId(req);
        const { supabaseAdmin } = require('../lib/supabaseClient');
        const { conversationId } = req.params;
        const { agentId } = req.body;
        
        const { error } = await supabaseAdmin
            .from('conversations')
            .update({ assigned_ai_agent_id: agentId || null })
            .eq('id', conversationId)
            .eq('user_id', userId);
            
        if (error) throw error;
        res.json({ success: true, assigned_ai_agent_id: agentId || null });
    } catch (error) {
        console.error('Error assigning AI:', error);
        res.status(500).json({ error: error.message });
    }
});

const upload = multer({ storage: multer.memoryStorage() });

router.post('/upload', requirePermission('Inbox', 'read_write'), upload.single('file'), async (req, res) => {
    try {
        let file = req.file;
        if (!file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // --- CONVERT WebM to OGG for Native WhatsApp Voice Notes ---
        if (file.mimetype === 'audio/webm') {
            try {
                const { convertWebmToOgg } = require('../utils/audioConverter');
                console.log(`[Inbox] Converting ${file.originalname} from WebM to OGG...`);
                const oggBuffer = await convertWebmToOgg(file.buffer);
                file.buffer = oggBuffer;
                file.mimetype = 'audio/ogg';
                file.originalname = file.originalname.replace(/\.webm$/i, '.ogg');
            } catch (convErr) {
                console.error('[Inbox] WebM to OGG conversion failed, falling back to original file:', convErr);
                // Keep original file and it will be sent as Document due to fallback
            }
        }

        // Use Admin client for Storage operations to ensure permissions
        const { supabaseAdmin } = require('../lib/supabaseClient');
        const bucketName = 'campaign-media';
        const userId = req.user ? req.user.id : 'anonymous';
        const dateStr = new Date().toISOString().split('T')[0];
        const moduleName = req.body.module || 'outbound';
        const filename = `${moduleName}/${userId}/${dateStr}/${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

        // Spoof mime type for unsupported formats because Supabase Storage bucket might restrict it
        let contentType = file.mimetype;
        if (contentType === 'audio/webm') {
            contentType = 'audio/mpeg'; // Spoof ONLY webm to ensure Supabase accepts the upload (will be sent as Document)
        }

        // Upload to Supabase
        const { error: uploadError } = await supabaseAdmin.storage
            .from(bucketName)
            .upload(filename, file.buffer, {
                contentType: contentType,
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
