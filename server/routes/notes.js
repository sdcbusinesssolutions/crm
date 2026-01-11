const express = require('express');
const router = express.Router();
const { getAuthenticatedSupabase } = require('../lib/supabaseClient');

// GET /api/notes?lead_id=...
router.get('/', async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { lead_id } = req.query;

        if (!lead_id) {
            return res.status(400).json({ error: 'lead_id is required' });
        }

        const { data, error } = await supabase
            .from('notes')
            .select('*')
            .eq('lead_id', lead_id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data || []);
    } catch (err) {
        console.error('Error fetching notes:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/notes
router.post('/', async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const user = req.user;
        const { lead_id, title, content, tags } = req.body;

        const { data, error } = await supabase
            .from('notes')
            .insert([{
                user_id: user.id,
                lead_id,
                title,
                content,
                tags: tags || []
            }])
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Error creating note:', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/notes/:id
router.put('/:id', async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { title, content, tags } = req.body;

        const { data, error } = await supabase
            .from('notes')
            .update({ title, content, tags })
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Error updating note:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/notes/:id
router.delete('/:id', async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { error } = await supabase
            .from('notes')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting note:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
