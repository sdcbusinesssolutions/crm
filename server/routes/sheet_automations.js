const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../lib/supabaseClient');

// List Automations
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('sheet_automations')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create Automation
router.post('/', async (req, res) => {
    try {
        const {
            name,
            connection_id,
            spreadsheet_id,
            sheet_name,
            automation_type,
            schedule_config,
            trigger_condition,
            template_config,
            mapping_config
        } = req.body;

        const { data, error } = await supabaseAdmin
            .from('sheet_automations')
            .insert({
                user_id: req.user.id,
                name,
                connection_id,
                spreadsheet_id,
                sheet_name,
                automation_type,
                schedule_config,
                trigger_condition,
                template_config,
                mapping_config,
                status: 'active'
            })
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update Automation
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        delete updates.id;
        delete updates.user_id;

        const { data, error } = await supabaseAdmin
            .from('sheet_automations')
            .update(updates)
            .eq('id', id)
            .eq('user_id', req.user.id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete Automation
router.delete('/:id', async (req, res) => {
    try {
        const { error } = await supabaseAdmin
            .from('sheet_automations')
            .delete()
            .eq('id', req.params.id)
            .eq('user_id', req.user.id);

        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
