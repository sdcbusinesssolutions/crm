const express = require('express');
const router = express.Router();
const { getAuthenticatedSupabase } = require('../lib/supabaseClient');
const requirePermission = require('../middleware/requirePermission');
const { logCRMEvent } = require('../utils/logger');
const flowEngine = require('../services/flowEngine');
const DripTriggerService = require('../services/DripTriggerService');

// GET /api/leads
router.get('/', requirePermission('LeadCRM', 'read'), async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        const supabase = getAuthenticatedSupabase(req);
        
        // Handle both camelCase and snake_case query params gracefully
        const pipelineId = req.query.pipeline_id || req.query.pipelineId;
        const stageId = req.query.stage_id || req.query.stageId;
        const status = req.query.status;

        let query = supabase
            .from('leads')
            .select('*', { count: 'exact' })
            .eq('user_id', req.user.id);

        if (req.staff && req.staff.permissions && req.staff.permissions.only_assigned_leads === 'all_access') {
            query = query.contains('assigned_staff_ids', [req.staff.staffId]);
        }

        if (pipelineId) {
            query = query.eq('pipeline_id', pipelineId);
        }

        if (stageId) {
            query = query.eq('stage_id', stageId);
        }

        if (status) {
            query = query.eq('status', status);
        }

        // Search Support
        if (req.query.search) {
            const s = req.query.search.replace(/,/g, '');
            if (s) {
                query = query.or(`name.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%,company.ilike.%${s}%`);
            }
        }

        // Quick Filters
        if (req.query.quickFilter === 'high_value') {
            query = query.gte('estimated_value', 1000);
        } else if (req.query.quickFilter === 'hot') {
            const d = new Date();
            d.setDate(d.getDate() - 7);
            query = query.gte('created_at', d.toISOString());
        } else if (req.query.quickFilter === 'cold') {
            const d = new Date();
            d.setDate(d.getDate() - 30);
            query = query.lt('created_at', d.toISOString());
        }

        // Sorting
        const sortBy = req.query.sortBy || 'created_at_desc';
        if (sortBy === 'created_at_asc') {
            query = query.order('created_at', { ascending: true });
        } else if (sortBy === 'value_desc') {
            query = query.order('estimated_value', { ascending: false });
        } else if (sortBy === 'value_asc') {
            query = query.order('estimated_value', { ascending: true });
        } else {
            query = query.order('created_at', { ascending: false });
        }

        // Range Pagination
        query = query.range(from, to);

        const { data, error } = await query;

        if (error) throw error;

        // Map and fallback assigned_staff_ids for UI consistency
        const mappedData = (data || []).map(lead => ({
            ...lead,
            assigned_staff_ids: (lead.assigned_staff_ids && lead.assigned_staff_ids.length > 0)
                ? lead.assigned_staff_ids
                : (lead.custom_data && lead.custom_data.assigned_staff_ids) || []
        }));

        res.json(mappedData);
    } catch (err) {
        console.error('Error fetching leads:', err);
        if (err.code === '42P01' || (err.message && err.message.includes('does not exist'))) {
            return res.json([]);
        }
        res.status(500).json({ error: err.message });
    }
});

// GET /api/leads/:id
router.get('/:id', requirePermission('LeadCRM', 'read'), async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        let query = supabase
            .from('leads')
            .select('*')
            .eq('id', req.params.id)
            .eq('user_id', req.user.id);

        if (req.staff && req.staff.permissions && req.staff.permissions.only_assigned_leads === 'all_access') {
            query = query.contains('assigned_staff_ids', [req.staff.staffId]);
        }

        const { data, error } = await query.single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ error: 'Lead not found' });
            }
            throw error;
        }

        if (data) {
            data.assigned_staff_ids = (data.assigned_staff_ids !== null && data.assigned_staff_ids !== undefined)
                ? data.assigned_staff_ids
                : (data.custom_data && data.custom_data.assigned_staff_ids) || [];
        }

        res.json(data);
    } catch (err) {
        // If it's a PGRST116, we don't need to log it as an error to keep console logs clean
        if (err.code !== 'PGRST116') {
            console.error('Error fetching lead:', err);
        }
        res.status(500).json({ error: err.message });
    }
});

// POST /api/leads
router.post('/', requirePermission('LeadCRM', 'read_write'), async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const user = req.user;

        if (!user || !user.id) {
            return res.status(401).json({ error: 'User context missing' });
        }

        const {
            pipeline_id,
            stage_id,
            name,
            email,
            phone,
            company,
            tags,
            custom_data,
            status,
            priority,
            estimated_value,
            source,
            type,
            assigned_staff_ids
        } = req.body;

        const staffIds = assigned_staff_ids || [];
        const customDataPayload = {
            ...(custom_data || {}),
            assigned_staff_ids: staffIds
        };

        const { data, error } = await supabase
            .from('leads')
            .insert([{
                user_id: user.id,
                pipeline_id: pipeline_id || null,
                stage_id: stage_id || null,
                name: name || '',
                email: email || '',
                phone: phone || '',
                company: company || '',
                tags: tags || [],
                custom_data: customDataPayload,
                status: status || 'active',
                priority: priority || 'medium',
                estimated_value: estimated_value || 0,
                source: source || 'manual',
                type: type || 'Lead',
                assigned_staff_ids: staffIds
            }])
            .select()
            .single();

        if (error) throw error;

        if (data) {
            data.assigned_staff_ids = (data.assigned_staff_ids !== null && data.assigned_staff_ids !== undefined)
                ? data.assigned_staff_ids
                : (data.custom_data && data.custom_data.assigned_staff_ids) || [];
        }

        if (staffIds.length > 0 && data.phone) {
            try {
                const { supabaseAdmin } = require('../lib/supabaseClient');
                await supabaseAdmin.from('conversations')
                    .update({ assigned_to: staffIds[0] })
                    .eq('user_id', user.id)
                    .eq('contact_phone', data.phone);
            } catch(e) { console.error('Error updating conversation assignment', e); }
        }

        try {
            logCRMEvent('CREATE_LEAD', {
                leadId: data.id,
                name: data.name,
                pipelineId: data.pipeline_id
            });

            if (data.stage_id) {
                DripTriggerService.handleStageChanged(user.id, data, data.stage_id).catch(err => console.error('Lead Create Drip Error:', err));
            }
        } catch (e) { }

        try {
            if (data.pipeline_id && data.phone) {
                flowEngine.triggerFlowByEvent(req.user.id, data.phone, 'pipeline_change', {
                    pipelineId: data.pipeline_id,
                    stageId: data.stage_id,
                    leadId: data.id,
                    contact: {
                        name: data.name,
                        phone: data.phone,
                        email: data.email,
                        company: data.company,
                        custom_data: data.custom_data
                    }
                });
            }
        } catch (ignored) { }

        res.json(data);
    } catch (err) {
        console.error('Error creating lead:', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/leads/:id
router.put('/:id', requirePermission('LeadCRM', 'read_write'), async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const updates = req.body;
        
        // Don't allow changing user_id
        delete updates.user_id;
        updates.updated_at = new Date().toISOString();

        // 1. Verify lead exists and belongs to this tenant/user
        let checkQuery = supabase
            .from('leads')
            .select('user_id, custom_data, phone')
            .eq('id', req.params.id);

        if (req.staff && req.staff.permissions && req.staff.permissions.only_assigned_leads === 'all_access') {
            checkQuery = checkQuery.contains('assigned_staff_ids', [req.staff.staffId]);
        }

        const { data: leadCheck, error: checkError } = await checkQuery.single();

        if (checkError || !leadCheck) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        // Security check: Ensure the lead belongs to the requester's tenant
        if (leadCheck.user_id !== req.user.id) {
            return res.status(403).json({ error: 'You do not have permission to update this lead' });
        }

        // Handle assigned_staff_ids: save to column AND custom_data for backward compatibility
        if (updates.assigned_staff_ids !== undefined) {
            const existingCustomData = leadCheck.custom_data || {};
            updates.custom_data = {
                ...existingCustomData,
                ...(updates.custom_data || {}),
                assigned_staff_ids: updates.assigned_staff_ids
            };
            
            if (leadCheck.phone) {
                try {
                    const firstStaffId = (Array.isArray(updates.assigned_staff_ids) && updates.assigned_staff_ids.length > 0) ? updates.assigned_staff_ids[0] : null;
                    const normalizedPhone = leadCheck.phone.replace('+', '');
                    const { supabaseAdmin } = require('../lib/supabaseClient');
                    const { error } = await supabaseAdmin.from('conversations')
                        .update({ assigned_to: firstStaffId })
                        .eq('user_id', leadCheck.user_id)
                        .eq('contact_phone', normalizedPhone);
                    if (error) {
                        console.error('Supabase update error for conversation assignment:', error.message);
                    }
                } catch(e) { console.error('Error updating conversation assignment', e); }
            }
        }

        const { data, error } = await supabase
            .from('leads')
            .update(updates)
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;

        if (data) {
            data.assigned_staff_ids = (data.assigned_staff_ids !== null && data.assigned_staff_ids !== undefined)
                ? data.assigned_staff_ids
                : (data.custom_data && data.custom_data.assigned_staff_ids) || [];
        }

        try {
            logCRMEvent('UPDATE_LEAD', {
                leadId: req.params.id,
                updates: Object.keys(updates)
            });

            if (updates.stage_id) {
                DripTriggerService.handleStageChanged(req.user.id, data, updates.stage_id).catch(err => console.error('Lead Update Drip Error:', err));
            }
        } catch (e) { }

        try {
            if ((updates.pipeline_id || updates.stage_id) && data.phone) {
                flowEngine.triggerFlowByEvent(req.user.id, data.phone, 'pipeline_change', {
                    pipelineId: data.pipeline_id,
                    stageId: data.stage_id,
                    leadId: data.id,
                    contact: {
                        name: data.name,
                        phone: data.phone,
                        email: data.email,
                        company: data.company,
                        custom_data: data.custom_data
                    }
                });
            }
        } catch (ignored) { }

        res.json(data);
    } catch (err) {
        console.error('Error updating lead:', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/leads/:id/move
router.put('/:id/move', requirePermission('LeadCRM', 'read_write'), async (req, res) => {
    try {
        const { stage_id } = req.body;
        if (!stage_id) {
            return res.status(400).json({ error: 'stage_id is required' });
        }

        const supabase = getAuthenticatedSupabase(req);

        // Verify lead exists and belongs to this tenant/user
        let checkQuery = supabase
            .from('leads')
            .select('user_id')
            .eq('id', req.params.id);

        if (req.staff && req.staff.permissions && req.staff.permissions.only_assigned_leads === 'all_access') {
            checkQuery = checkQuery.contains('assigned_staff_ids', [req.staff.staffId]);
        }

        const { data: leadCheck, error: checkError } = await checkQuery.single();

        if (checkError || !leadCheck) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        // Security check: Ensure the lead belongs to the requester's tenant
        if (leadCheck.user_id !== req.user.id) {
            return res.status(403).json({ error: 'You do not have permission to update this lead' });
        }

        const { data, error } = await supabase
            .from('leads')
            .update({
                stage_id,
                updated_at: new Date().toISOString()
            })
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;

        if (data) {
            data.assigned_staff_ids = (data.assigned_staff_ids !== null && data.assigned_staff_ids !== undefined)
                ? data.assigned_staff_ids
                : (data.custom_data && data.custom_data.assigned_staff_ids) || [];
        }

        try {
            logCRMEvent('MOVE_LEAD_STAGE', {
                leadId: req.params.id,
                newStageId: stage_id
            });

            DripTriggerService.handleStageChanged(req.user.id, data, stage_id).catch(err => console.error('Lead Move Drip Error:', err));
        } catch (e) { }

        try {
            if (data.phone) {
                flowEngine.triggerFlowByEvent(req.user.id, data.phone, 'pipeline_change', {
                    pipelineId: data.pipeline_id,
                    stageId: data.stage_id,
                    leadId: data.id,
                    contact: {
                        name: data.name,
                        phone: data.phone,
                        email: data.email,
                        company: data.company,
                        custom_data: data.custom_data
                    }
                });
            }
        } catch (ignored) { }

        res.json(data);
    } catch (err) {
        console.error('Error moving lead:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/leads/:id
router.delete('/:id', requirePermission('LeadCRM', 'read_write'), async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        let deleteQuery = supabase
            .from('leads')
            .delete()
            .eq('id', req.params.id)
            .eq('user_id', req.user.id);

        if (req.staff && req.staff.permissions && req.staff.permissions.only_assigned_leads === 'all_access') {
            deleteQuery = deleteQuery.contains('assigned_staff_ids', [req.staff.staffId]);
        }

        const { error } = await deleteQuery;

        if (error) throw error;

        try {
            logCRMEvent('DELETE_LEAD', { leadId: req.params.id });
        } catch (e) { }

        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting lead:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/leads/stats/dashboard
router.get('/dashboard/stats', requirePermission('LeadCRM', 'read'), async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const userId = req.user.id;
        const { data: leads, error } = await supabase
            .from('leads')
            .select('status, created_at, estimated_value')
            .eq('user_id', userId);

        if (error) throw error;

        // Aggregate statistics
        const stats = {
            total: leads.length,
            active: leads.filter(l => l.status === 'active').length,
            won: leads.filter(l => l.status === 'won').length,
            lost: leads.filter(l => l.status === 'lost').length,
            totalValue: leads.reduce((sum, l) => sum + (l.estimated_value || 0), 0)
        };

        res.json(stats);
    } catch (err) {
        console.error('Error fetching dashboard stats:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
