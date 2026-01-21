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

// Get Single Automation
router.get('/:id', async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('sheet_automations')
            .select('*')
            .eq('id', req.params.id)
            .eq('user_id', req.user.id)
            .single();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Not found' });

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

        console.log('[SheetAuto] Create Request:', JSON.stringify(req.body, null, 2));

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

        if (error) {
            console.error('[SheetAuto] Supabase Insert Error:', error);
            throw error;
        }
        res.json(data);
    } catch (error) {
        console.error('[SheetAuto] Server Error:', error);
        res.status(500).json({ error: error.message, details: error });
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

// Manual Trigger
const SheetAutomationService = require('../services/SheetAutomationService');

router.post('/:id/trigger', async (req, res) => {
    try {
        const { id } = req.params;
        // Verify ownership and trigger via Service
        const result = await SheetAutomationService.triggerById(id, req.user.id);
        res.json(result);
    } catch (error) {
        console.error('[SheetAuto] Manual Trigger Error:', { message: error.message, stack: error.stack });
        res.status(500).json({ error: error.message });
    }
});


module.exports = router;
