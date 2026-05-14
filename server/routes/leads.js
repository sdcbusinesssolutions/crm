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
            data: data || [],
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
                assigned_staff_ids: assigned_staff_ids || [],
                status: 'active'
            }])
            .select()
            .single();

        if (error) throw error;
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

        const { data, error } = await supabaseAdmin
            .from('leads')
            .update(updates)
            .eq('id', req.params.id)
            .eq('user_id', req.user.id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
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
