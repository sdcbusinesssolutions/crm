const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../lib/supabaseClient');

// GET /api/quick-replies
router.get('/', async (req, res) => {
    try {
        const supabase = supabaseAdmin;
        const { data, error } = await supabase
            .from('quick_replies')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data || []);
    } catch (err) {
        console.error('Error fetching quick replies:', err);
        if (err.code === '42P01' || (err.message && err.message.includes('does not exist'))) {
            return res.json([]);
        }
        res.status(500).json({ error: err.message });
    }
});

// POST /api/quick-replies
router.post('/', async (req, res) => {
    try {
        const supabase = supabaseAdmin;
        const { title, content, shortcut, type } = req.body;
        const user = req.user;

        if (!user || !user.id) return res.status(401).json({ error: 'User context missing' });

        const { data, error } = await supabase
            .from('quick_replies')
            .insert([{
                user_id: user.id,
                title,
                content,
                shortcut,
                type: type || 'text'
            }])
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Error creating quick reply:', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/quick-replies/:id
router.put('/:id', async (req, res) => {
    try {
        const supabase = supabaseAdmin;
        const { title, content, shortcut, type } = req.body;

        const { data, error } = await supabase
            .from('quick_replies')
            .update({ title, content, shortcut, type, updated_at: new Date().toISOString() })
            .eq('id', req.params.id)
            .eq('user_id', req.user.id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Error updating quick reply:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/quick-replies/:id
router.delete('/:id', async (req, res) => {
    try {
        const supabase = supabaseAdmin;
        const { error } = await supabase
            .from('quick_replies')
            .delete()
            .eq('id', req.params.id)
            .eq('user_id', req.user.id);

        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting quick reply:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
