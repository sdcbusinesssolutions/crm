const express = require('express');
const router = express.Router();
const { getAuthenticatedSupabase } = require('../lib/supabaseClient');
const { logCRMEvent } = require('../utils/logger');
const flowEngine = require('../services/flowEngine');
const DripTriggerService = require('../services/DripTriggerService');

// GET /api/leads
router.get('/', async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { pipeline_id, stage_id } = req.query;

        let query = supabase
            .from('leads')
            .select('*')
            .eq('user_id', req.user.id)


        if (pipeline_id) {
            query = query.eq('pipeline_id', pipeline_id);
        }

        if (stage_id) {
            query = query.eq('stage_id', stage_id);
        }

        // Search Support
        if (req.query.search) {
            // Sanitize and quote the search string properly for PostgREST syntax if needed, 
            // but for ilike with supa-js, simple string interpolation works unless it contains comma.
            // However, Supabase client handles parameterization, but in .or() raw string, we must be careful.
            // Replacing comma with nothing or handling it is safer.
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

        // Add Pagination (Always Enforced to Prevent Egress Spikes)
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50; // Default 50
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        query = query.range(from, to);

        const { data, error } = await query;

        if (error) throw error;
        res.json(data || []);
    } catch (err) {
        console.error('Error fetching leads:', err);
        if (err.code === '42P01' || (err.message && err.message.includes('does not exist'))) {
            return res.json([]);
        }
        res.status(500).json({ error: err.message });
    }
});

// GET /api/leads/:id
router.get('/:id', async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { data, error } = await supabase
            .from('leads')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Error fetching lead:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/leads
router.post('/', async (req, res) => {
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
            type
        } = req.body;

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
                custom_data: custom_data || {},
                status: status || 'active',
                priority: priority || 'medium',
                estimated_value: estimated_value || null,
                source: source || 'manual',
                type: type || 'Lead'
            }])
            .select()
            .single();

        if (error) throw error;

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
router.put('/:id', async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
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
            type
        } = req.body;

        const payload = {};
        if (pipeline_id !== undefined) payload.pipeline_id = pipeline_id;
        if (stage_id !== undefined) payload.stage_id = stage_id;
        if (name !== undefined) payload.name = name;
        if (email !== undefined) payload.email = email;
        if (phone !== undefined) payload.phone = phone;
        if (company !== undefined) payload.company = company;
        if (tags !== undefined) payload.tags = tags;
        if (custom_data !== undefined) payload.custom_data = custom_data;
        if (status !== undefined) payload.status = status;
        if (priority !== undefined) payload.priority = priority;
        if (estimated_value !== undefined) payload.estimated_value = estimated_value;
        if (type !== undefined) payload.type = type;

        const { data, error } = await supabase
            .from('leads')
            .update(payload)
            .eq('id', req.params.id)
            .eq('user_id', req.user.id)
            .select()
            .single();

        if (error) throw error;

        try {
            logCRMEvent('UPDATE_LEAD', {
                leadId: req.params.id,
                updates: Object.keys(payload)
            });

            if (payload.stage_id) {
                // If stage changed, trigger drips
                DripTriggerService.handleStageChanged(req.user.id, data, payload.stage_id).catch(err => console.error('Lead Update Drip Error:', err));
            }
        } catch (e) { }

        try {
            if ((payload.pipeline_id || payload.stage_id) && data.phone) {
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

// PUT /api/leads/:id/move (move to different stage)
router.put('/:id/move', async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { stage_id } = req.body;

        if (!stage_id) {
            return res.status(400).json({ error: 'stage_id is required' });
        }

        const { data, error } = await supabase
            .from('leads')
            .update({ stage_id })
            .eq('id', req.params.id)
            .eq('user_id', req.user.id)
            .select()
            .single();

        if (error) throw error;

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
router.delete('/:id', async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { error } = await supabase
            .from('leads')
            .delete()
            .eq('id', req.params.id)
            .eq('user_id', req.user.id);

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

module.exports = router;
