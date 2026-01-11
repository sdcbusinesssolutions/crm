const express = require('express');
const router = express.Router();
const { getAuthenticatedSupabase } = require('../lib/supabaseClient');

// GET /api/stages (all stages for user)
router.get('/', async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { data, error } = await supabase
            .from('pipeline_stages')
            .select('*')
            .order('display_order', { ascending: true });

        if (error) throw error;
        res.json(data || []);
    } catch (err) {
        console.error('Error fetching stages:', err);
        if (err.code === '42P01' || (err.message && err.message.includes('does not exist'))) {
            return res.json([]);
        }
        res.status(500).json({ error: err.message });
    }
});

// POST /api/stages
router.post('/', async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const user = req.user;

        if (!user || !user.id) {
            return res.status(401).json({ error: 'User context missing' });
        }

        const { pipeline_id, name, description, color, display_order } = req.body;

        if (!pipeline_id) {
            return res.status(400).json({ error: 'pipeline_id is required' });
        }

        const { data, error } = await supabase
            .from('pipeline_stages')
            .insert([{
                user_id: user.id,
                pipeline_id,
                name: name || 'New Stage',
                description: description || '',
                color: color || '#6b7280',
                display_order: display_order !== undefined ? display_order : 0,
                is_active: true
            }])
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Error creating stage:', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/stages/reorder (bulk update display_order)
router.put('/reorder', async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { stages } = req.body; // Array of { id, display_order }

        if (!Array.isArray(stages)) {
            return res.status(400).json({ error: 'stages must be an array' });
        }

        // Update each stage's display_order
        const promises = stages.map(stage =>
            supabase
                .from('pipeline_stages')
                .update({ display_order: stage.display_order })
                .eq('id', stage.id)
        );

        await Promise.all(promises);
        res.json({ success: true });
    } catch (err) {
        console.error('Error reordering stages:', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/stages/:id
router.put('/:id', async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { name, description, color, display_order, is_active } = req.body;

        const payload = {};
        if (name !== undefined) payload.name = name;
        if (description !== undefined) payload.description = description;
        if (color !== undefined) payload.color = color;
        if (display_order !== undefined) payload.display_order = display_order;
        if (is_active !== undefined) payload.is_active = is_active;

        const { data, error } = await supabase
            .from('pipeline_stages')
            .update(payload)
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Error updating stage:', err);
        res.status(500).json({ error: err.message });
    }
});



// DELETE /api/stages/:id
router.delete('/:id', async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { error } = await supabase
            .from('pipeline_stages')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting stage:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
