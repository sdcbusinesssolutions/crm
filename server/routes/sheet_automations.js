const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../lib/supabaseClient');
const requirePermission = require('../middleware/requirePermission');

// List Automations
router.get('/', requirePermission('G+Automation', 'read'), async (req, res) => {
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
router.get('/:id', requirePermission('G+Automation', 'read'), async (req, res) => {
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
router.post('/', requirePermission('G+Automation', 'read_write'), async (req, res) => {
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
router.put('/:id', requirePermission('G+Automation', 'read_write'), async (req, res) => {
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
router.delete('/:id', requirePermission('G+Automation', 'all_access'), async (req, res) => {
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
// Toggle Status (Active/Paused)
router.patch('/:id/status', requirePermission('G+Automation', 'read_write'), async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['active', 'paused'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status. Must be "active" or "paused".' });
        }

        const { data, error } = await supabaseAdmin
            .from('sheet_automations')
            .update({ status })
            .eq('id', id)
            .eq('user_id', req.user.id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('[SheetAuto] Toggle Status Error:', error);
        res.status(500).json({ error: error.message });
    }
});
const SheetAutomationService = require('../services/SheetAutomationService');

router.post('/:id/trigger', requirePermission('G+Automation', 'read_write'), async (req, res) => {
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

// Download CSV Report
router.get('/:id/report', requirePermission('G+Automation', 'read'), async (req, res) => {
    try {
        const { id } = req.params;

        // Verify ownership
        const { data: auto, error: autoError } = await supabaseAdmin
            .from('sheet_automations')
            .select('id, name')
            .eq('id', id)
            .eq('user_id', req.user.id)
            .single();

        if (autoError || !auto) {
            return res.status(404).json({ error: 'Automation not found' });
        }

        // Fetch history
        const { data: history, error: historyError } = await supabaseAdmin
            .from('sheet_automation_history')
            .select('*')
            .eq('automation_id', id)
            .order('triggered_at', { ascending: false });

        if (historyError) throw historyError;

        // Build CSV
        const headers = ['Triggered At', 'Status', 'Dedupe Mode', 'Reason', 'Row Hash'];
        const csvRows = [headers.join(',')];

        (history || []).forEach(row => {
            csvRows.push([
                `"${row.triggered_at}"`,
                `"${row.status}"`,
                `"${row.dedupe_mode || ''}"`,
                `"${(row.reason || '').replace(/"/g, '""')}"`,
                `"${row.row_data_hash || ''}"`
            ].join(','));
        });

        const csvContent = csvRows.join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="automation_report_${id}.csv"`);
        res.send(csvContent);

    } catch (error) {
        console.error('[SheetAuto] Report Error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
