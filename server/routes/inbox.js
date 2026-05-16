const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../lib/supabaseClient');
const requirePermission = require('../middleware/requirePermission');

// GET /api/inbox/conversations
router.get('/conversations', requirePermission('Inbox', 'read'), async (req, res) => {
    try {
        const { page = 1, limit = 20, search, quickFilter, filterTag } = req.query;
        const from = (parseInt(page) - 1) * parseInt(limit);
        const to = from + parseInt(limit) - 1;

        let query = supabaseAdmin
            .from('conversations')
            .select('*', { count: 'exact' })
            .eq('user_id', req.user.id);

        // Apply filters if needed (simple implementation)
        if (search) {
            query = query.or(`contact_name.ilike.%${search}%,contact_phone.ilike.%${search}%,last_message.ilike.%${search}%`);
        }

        const { data, count, error } = await query
            .order('updated_at', { ascending: false })
            .range(from, to);

        if (error) throw error;

        res.json({
            data: data || [],
            total: count || 0,
            page: parseInt(page),
            totalPages: Math.ceil((count || 0) / limit)
        });
    } catch (err) {
        console.error('Error fetching conversations:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/inbox/conversations/:id/messages (Legacy support)
router.get('/conversations/:id/messages', async (req, res) => {
    try {
        // Verify ownership via conversation first
        const { data: conv, error: convError } = await supabaseAdmin
            .from('conversations')
            .select('id')
            .eq('id', req.params.id)
            .eq('user_id', req.user.id)
            .single();

        if (convError || !conv) {
            return res.status(404).json({ error: 'Conversation not found or access denied' });
        }

        const { data, error } = await supabaseAdmin
            .from('messages')
            .select('*')
            .eq('conversation_id', req.params.id)
            .order('created_at', { ascending: true });

        if (error) throw error;
        res.json(data || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/inbox/messages/:id (New standard used by frontend)
router.get('/messages/:id', async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;
        // Verify ownership via conversation first
        const { data: conv, error: convError } = await supabaseAdmin
            .from('conversations')
            .select('id')
            .eq('id', req.params.id)
            .eq('user_id', req.user.id)
            .single();

        if (convError || !conv) {
            return res.status(404).json({ error: 'Conversation not found or access denied' });
        }

        const { data, error } = await supabaseAdmin
            .from('messages')
            .select('*')
            .eq('conversation_id', req.params.id)
            .order('created_at', { ascending: false }) // Newest first for pagination
            .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

        if (error) throw error;
        
        // Return sorted ascending for the UI
        res.json((data || []).reverse());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/inbox/messages/:id (Sending messages)
router.post('/messages/:id', async (req, res) => {
    try {
        const { text, type, media_url, template } = req.body;
        const conversationId = req.params.id;

        // 1. Save message to DB
        const { data, error } = await supabaseAdmin
            .from('messages')
            .insert([{
                conversation_id: conversationId,
                user_id: req.user.id,
                text,
                type: type || 'text',
                direction: 'out',
                status: 'sent',
                media_url,
                metadata: template ? { template } : null,
                created_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (error) throw error;

        // 2. Update conversation last_message
        await supabaseAdmin
            .from('conversations')
            .update({ 
                last_message: text || `Media: ${type}`,
                updated_at: new Date().toISOString()
            })
            .eq('id', conversationId);

        res.json(data);
    } catch (err) {
        console.error('Error sending message:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/inbox/assign
router.post('/assign', async (req, res) => {
    try {
        const { conversation_id, assigned_staff_ids } = req.body;
        const { data, error } = await supabaseAdmin
            .from('conversations')
            .update({ 
                assigned_staff_ids: assigned_staff_ids || [],
                updated_at: new Date().toISOString()
            })
            .eq('id', conversation_id)
            .eq('user_id', req.user.id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST/PUT /api/inbox/conversations/:id/read
router.post('/conversations/:id/read', async (req, res) => {
    await markAsRead(req, res);
});

router.put('/conversations/:id/read', async (req, res) => {
    await markAsRead(req, res);
});

async function markAsRead(req, res) {
    try {
        const { error } = await supabaseAdmin
            .from('conversations')
            .update({ 
                unread_count: 0,
                updated_at: new Date().toISOString()
            })
            .eq('id', req.params.id)
            .eq('user_id', req.user.id);

        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

module.exports = router;
