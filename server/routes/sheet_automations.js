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
            .order('sent_at', { ascending: false });

        if (historyError) throw historyError;

        // Build CSV
        const headers = ['Sent At', 'Phone Number', 'Status', 'Row Hash', 'Row Data'];
        const csvRows = [headers.join(',')];

        (history || []).forEach(row => {
            let rowDataStr = '';
            if (row.meta && row.meta.row_data) {
                rowDataStr = JSON.stringify(row.meta.row_data).replace(/"/g, '""');
            }

            let istTime = '';
            if (row.sent_at) {
                try {
                    const dt = new Date(row.sent_at);
                    // Format output like '05/08/2026, 11:45:00 pm'
                    istTime = dt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
                } catch (e) {
                    istTime = row.sent_at;
                }
            }

            csvRows.push([
                `"${istTime}"`,
                `"+${row.phone_number || ''}"`,
                `"${row.status || ''}"`,
                `"${row.row_hash || ''}"`,
                `"${rowDataStr}"`
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
// GET /api/sheet-automations/:id/report-json
// Download/View CSV Data as JSON for Data Table
router.get('/:id/report-json', requirePermission('G+Automation', 'read'), async (req, res) => {
    try {
        const { id } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

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

        // Fetch history with pagination
        const { data: history, error: historyError, count } = await supabaseAdmin
            .from('sheet_automation_history')
            .select('*', { count: 'exact' })
            .eq('automation_id', id)
            .order('sent_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (historyError) throw historyError;

        res.json({
            data: history || [],
            total: count || 0,
            page,
            totalPages: Math.ceil((count || 0) / limit)
        });

    } catch (error) {
        console.error('[SheetAuto] JSON Report Error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
