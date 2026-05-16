const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../lib/supabaseClient');
const requirePermission = require('../middleware/requirePermission');

// GET /api/leads
router.get('/', requirePermission('Leads', 'read'), async (req, res) => {
    try {
        const { page = 1, limit = 50, search, pipelineId, stageId, status } = req.query;
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        let query = supabaseAdmin
            .from('leads')
            .select('*', { count: 'exact' })
            .eq('user_id', req.user.id);

        if (search) {
            query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%,company.ilike.%${search}%`);
        }
        if (pipelineId) query = query.eq('pipeline_id', pipelineId);
        if (stageId) query = query.eq('stage_id', stageId);
        if (status) query = query.eq('status', status);

        const { data, count, error } = await query
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) throw error;

        res.json({
            data: (data || []).map(lead => ({
                ...lead,
                assigned_staff_ids: (lead.assigned_staff_ids && lead.assigned_staff_ids.length > 0) 
                    ? lead.assigned_staff_ids 
                    : (lead.custom_data && lead.custom_data.assigned_staff_ids) || []
            })),
            total: count || 0,
            page: parseInt(page),
            totalPages: Math.ceil((count || 0) / limit)
        });
    } catch (err) {
        console.error('Error fetching leads:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/leads/:id
router.get('/:id', async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('leads')
            .select('*')
            .eq('id', req.params.id)
            .eq('user_id', req.user.id)
            .single();

        if (error) throw error;
        if (data) {
            data.assigned_staff_ids = (data.assigned_staff_ids !== null && data.assigned_staff_ids !== undefined) 
                ? data.assigned_staff_ids 
                : (data.custom_data && data.custom_data.assigned_staff_ids) || [];
        }
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/leads
router.post('/', async (req, res) => {
    try {
        const { name, email, phone, company, pipeline_id, stage_id, source, estimated_value, assigned_staff_ids } = req.body;
        const user = req.user;

        const { data, error } = await supabaseAdmin
            .from('leads')
            .insert([{
                user_id: user.id,
                name,
                email,
                phone,
                company,
                pipeline_id,
                stage_id,
                source: source || 'Manual',
                estimated_value: estimated_value || 0,
                custom_data: { assigned_staff_ids: assigned_staff_ids || [] },
                assigned_staff_ids: assigned_staff_ids || [],
                status: 'active'
            }])
            .select()
            .single();

        if (error) throw error;
        if (data) {
            data.assigned_staff_ids = (data.assigned_staff_ids !== null && data.assigned_staff_ids !== undefined) 
                ? data.assigned_staff_ids 
                : (data.custom_data && data.custom_data.assigned_staff_ids) || [];
        }
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/leads/:id
router.put('/:id', async (req, res) => {
    try {
        const updates = req.body;
        // Don't allow changing user_id
        delete updates.user_id;
        updates.updated_at = new Date().toISOString();

        // 1. Verify lead exists and belongs to this tenant/user
        const { data: leadCheck, error: checkError } = await supabaseAdmin
            .from('leads')
            .select('user_id, custom_data')
            .eq('id', req.params.id)
            .single();

        if (checkError || !leadCheck) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        // Security check: Ensure the lead belongs to the requester's tenant
        // req.user.id is the tenantId for staff and ownerId for owners
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
        }

        const { data, error } = await supabaseAdmin
            .from('leads')
            .update(updates)
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;

        if (data) {
            // Fix: Check if null/undefined. If empty array, keep it empty.
            data.assigned_staff_ids = (data.assigned_staff_ids !== null && data.assigned_staff_ids !== undefined) 
                ? data.assigned_staff_ids 
                : (data.custom_data && data.custom_data.assigned_staff_ids) || [];
        }
        res.json(data);
    } catch (err) {
        console.error('Error updating lead:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/leads/:id
router.delete('/:id', async (req, res) => {
    try {
        const { error } = await supabaseAdmin
            .from('leads')
            .delete()
            .eq('id', req.params.id)
            .eq('user_id', req.user.id);

        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/leads/stats/dashboard
router.get('/dashboard/stats', async (req, res) => {
    try {
        const userId = req.user.id;
        const { data: leads, error } = await supabaseAdmin
            .from('leads')
            .select('status, created_at, estimated_value')
            .eq('user_id', userId);

        if (error) throw error;

        // Simple aggregation
        const stats = {
            total: leads.length,
            active: leads.filter(l => l.status === 'active').length,
            won: leads.filter(l => l.status === 'won').length,
            lost: leads.filter(l => l.status === 'lost').length,
            totalValue: leads.reduce((sum, l) => sum + (l.estimated_value || 0), 0)
        };

        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
