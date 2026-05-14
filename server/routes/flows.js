const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../lib/supabaseClient');
const requirePermission = require('../middleware/requirePermission');

// Helper to sync Sheet Trigger nodes to sheet_automations table
async function syncSheetTriggers(userId, flowId, nodes) {
    if (!nodes || !Array.isArray(nodes)) return;

    const triggerNodes = nodes.filter(n => n.type === 'sheetTrigger');
    const db = supabaseAdmin;

    if (triggerNodes.length === 0) {
        await db.from('sheet_automations').delete().eq('flow_id', flowId);
        return;
    }

    const node = triggerNodes[0];
    const { connectionId, credentialId, spreadsheetId, sheetName, phoneColumn, statusColumn } = node.data;
    const connId = connectionId || credentialId;

    if (!connId || !spreadsheetId || !sheetName || !phoneColumn) return;

    const { data: existing } = await db.from('sheet_automations').select('id').eq('flow_id', flowId).single();

    const payload = {
        user_id: userId,
        name: `Trigger: ${node.data.label || 'New Row'} (Flow)`,
        automation_type: 'new_row',
        connection_id: connId,
        spreadsheet_id: spreadsheetId,
        sheet_name: sheetName,
        flow_id: flowId,
        status: 'active',
        trigger_condition: node.data.trigger_condition,
        mapping_config: {
            phone_col: phoneColumn,
            status_column: statusColumn,
            params: {}
        },
    };

    if (existing) {
        await db.from('sheet_automations').update(payload).eq('id', existing.id);
    } else {
        await db.from('sheet_automations').insert(payload);
    }
}

// GET / - List all flows
router.get('/', requirePermission('Flows', 'read'), async (req, res) => {
    try {
        const supabase = supabaseAdmin;
        const { data, error } = await supabase
            .from('flows')
            .select('*')
            .eq('user_id', req.user.id)
            .order('updated_at', { ascending: false });

        if (error) throw error;
        res.json(data || []);
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
router.get('/:id', requirePermission('Flows', 'read'), async (req, res) => {
    try {
        const supabase = supabaseAdmin;
        const { id } = req.params;

        if (!isValidUUID(id)) {
            return res.status(400).json({ error: 'Invalid flow ID format' });
        }

        const { data, error } = await supabase
            .from('flows')
            .select('*')
            .eq('id', id)
            .eq('user_id', req.user.id)
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
router.post('/', requirePermission('Flows', 'read_write'), async (req, res) => {
    try {
        const supabase = supabaseAdmin;
        const { name, description, nodes, edges, status } = req.body;
        const userId = req.user.id;

        const { data, error } = await supabase
            .from('flows')
            .insert([{
                user_id: userId,
                name: name || 'Untitled Flow',
                description: description || 'No description',
                status: status || 'Draft',
                nodes: nodes || [],
                edges: edges || []
            }])
            .select()
            .single();

        if (error) throw error;

        if (nodes && nodes.length > 0) {
            await syncSheetTriggers(userId, data.id, nodes);
        }

        res.status(201).json(data);
    } catch (error) {
        console.error('Error creating flow:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /:id - Update a flow
router.put('/:id', requirePermission('Flows', 'read_write'), async (req, res) => {
    try {
        const supabase = supabaseAdmin;
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
            .eq('user_id', req.user.id)
            .select()
            .single();

        if (error) throw error;

        if (nodes !== undefined) {
            await syncSheetTriggers(req.user.id, id, nodes);
        }

        res.json(data);
    } catch (error) {
        console.error('Error updating flow:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /:id - Delete a flow
router.delete('/:id', requirePermission('Flows', 'read_write'), async (req, res) => {
    try {
        const supabase = supabaseAdmin;
        const { id } = req.params;

        if (!isValidUUID(id)) {
            return res.status(400).json({ error: 'Invalid flow ID format' });
        }

        const { error } = await supabase
            .from('flows')
            .delete()
            .eq('id', id)
            .eq('user_id', req.user.id);

        if (error) throw error;

        await supabaseAdmin.from('sheet_automations').delete().eq('flow_id', id).eq('user_id', req.user.id);

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting flow:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

module.exports = router;
