const express = require('express');
const router = express.Router();
const { getAuthenticatedSupabase } = require('../lib/supabaseClient');

// GET /api/appointments?lead_id=...
router.get('/', async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { lead_id } = req.query;

        if (!lead_id) {
            return res.status(400).json({ error: 'lead_id is required' });
        }

        const { data, error } = await supabase
            .from('appointments')
            .select('*')
            .eq('lead_id', lead_id)
            .order('start_time', { ascending: true });

        if (error) throw error;
        res.json(data || []);
    } catch (err) {
        console.error('Error fetching appointments:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/appointments
router.post('/', async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const user = req.user;
        const { lead_id, title, start_time, end_time, description, status } = req.body;

        const { data, error } = await supabase
            .from('appointments')
            .insert([{
                user_id: user.id,
                lead_id,
                title,
                start_time,
                end_time,
                description,
                status: status || 'scheduled'
            }])
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Error creating appointment:', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/appointments/:id
router.put('/:id', async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { title, start_time, end_time, description, status } = req.body;

        const payload = {};
        if (title !== undefined) payload.title = title;
        if (start_time !== undefined) payload.start_time = start_time;
        if (end_time !== undefined) payload.end_time = end_time;
        if (description !== undefined) payload.description = description;
        if (status !== undefined) payload.status = status;

        const { data, error } = await supabase
            .from('appointments')
            .update(payload)
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Error updating appointment:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/appointments/:id
router.delete('/:id', async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { error } = await supabase
            .from('appointments')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting appointment:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
