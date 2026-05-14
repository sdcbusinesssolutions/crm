const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../lib/supabaseClient');

// GET /api/inbox/conversations
router.get('/conversations', async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('conversations')
            .select('*')
            .eq('user_id', req.user.id)
            .order('updated_at', { ascending: false });

        if (error) throw error;
        res.json(data || []);
    } catch (err) {
        console.error('Error fetching conversations:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/inbox/conversations/:id/messages
router.get('/conversations/:id/messages', async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('messages')
            .select('*')
            .eq('conversation_id', req.params.id)
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: true });

        if (error) throw error;
        res.json(data || []);
    } catch (err) {
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

// PUT /api/inbox/conversations/:id/read
router.put('/conversations/:id/read', async (req, res) => {
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
});

module.exports = router;
