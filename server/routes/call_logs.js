const express = require('express');
const router = express.Router();
const { getAuthenticatedSupabase } = require('../lib/supabaseClient');

// GET /api/call-logs?lead_id=...
router.get('/', async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { lead_id } = req.query;

        if (!lead_id) {
            return res.status(400).json({ error: 'lead_id is required' });
        }

        const { data, error } = await supabase
            .from('call_logs')
            .select('*')
            .eq('lead_id', lead_id)
            .order('called_at', { ascending: false });

        if (error) throw error;
        res.json(data || []);
    } catch (err) {
        console.error('Error fetching call logs:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/call-logs
router.post('/', async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const user = req.user;
        const { lead_id, call_type, duration, notes, called_at } = req.body;

        const { data, error } = await supabase
            .from('call_logs')
            .insert([{
                user_id: user.id,
                lead_id,
                call_type: call_type || 'outbound',
                duration: duration || 0,
                notes,
                called_at: called_at || new Date().toISOString()
            }])
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Error creating call log:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/call-logs/:id
router.delete('/:id', async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { error } = await supabase
            .from('call_logs')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting call log:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
