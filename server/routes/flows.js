const express = require('express');
const router = express.Router();
const { getAuthenticatedSupabase } = require('../lib/supabaseClient');

// GET / - List all flows
router.get('/', async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { data, error } = await supabase
            .from('flows')
            .select('*')
            .order('updated_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error fetching flows:', error);
        res.status(500).json({ error: error.message });
    }
});

const isValidUUID = (uuid) => {
    const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return regex.test(uuid);
};

// GET /:id - Get a single flow
router.get('/:id', async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { id } = req.params;

        if (!isValidUUID(id)) {
            return res.status(400).json({ error: 'Invalid flow ID format' });
        }

        const { data, error } = await supabase
            .from('flows')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Flow not found' });

        res.json(data);
    } catch (error) {
        console.error('Error fetching flow:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST / - Create a new flow
router.post('/', async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { name, description, nodes, edges, status } = req.body;

        // Get user_id from the authenticated user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;

        const { data, error } = await supabase
            .from('flows')
            .insert([{
                user_id: user.id,
                name: name || 'Untitled Flow',
                description: description || 'No description',
                status: status || 'Draft',
                nodes: nodes || [],
                edges: edges || []
            }])
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (error) {
        console.error('Error creating flow:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /:id - Update a flow
router.put('/:id', async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { id } = req.params;

        if (!isValidUUID(id)) {
            return res.status(400).json({ error: 'Invalid flow ID format' });
        }

        const { name, description, nodes, edges, status } = req.body;

        const updates = {
            updated_at: new Date().toISOString()
        };
        if (name !== undefined) updates.name = name;
        if (description !== undefined) updates.description = description;
        if (nodes !== undefined) updates.nodes = nodes;
        if (edges !== undefined) updates.edges = edges;
        if (status !== undefined) updates.status = status;

        const { data, error } = await supabase
            .from('flows')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error updating flow:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /:id - Delete a flow
router.delete('/:id', async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { id } = req.params;

        if (!isValidUUID(id)) {
            return res.status(400).json({ error: 'Invalid flow ID format' });
        }


        const { error } = await supabase
            .from('flows')
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting flow:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;