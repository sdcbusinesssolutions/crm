const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../lib/supabaseClient');
const { logCRMEvent } = require('../utils/logger');
const requirePermission = require('../middleware/requirePermission');

// GET /api/pipelines
router.get('/', requirePermission('Pipelines', 'read'), async (req, res) => {
    try {
        const supabase = supabaseAdmin;
        const { data, error } = await supabase
            .from('pipelines')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json(data || []);
    } catch (err) {
        console.error('Error fetching pipelines:', err);
        if (err.code === '42P01' || (err.message && err.message.includes('does not exist'))) {
            return res.json([]);
        }
        res.status(500).json({ error: err.message });
    }
});

// GET /api/pipelines/:id
router.get('/:id', requirePermission('Pipelines', 'read'), async (req, res) => {
    try {
        const supabase = supabaseAdmin;
        const { data, error } = await supabase
            .from('pipelines')
            .select('*')
            .eq('id', req.params.id)
            .eq('user_id', req.user.id)
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Error fetching pipeline:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/pipelines/:id/stages
router.get('/:id/stages', requirePermission('Pipelines', 'read'), async (req, res) => {
    try {
        const supabase = supabaseAdmin;
        
        // Ensure pipeline belongs to user first
        const { data: pipeline, error: pErr } = await supabase
            .from('pipelines')
            .select('id')
            .eq('id', req.params.id)
            .eq('user_id', req.user.id)
            .single();
            
        if (pErr || !pipeline) return res.status(404).json({ error: 'Pipeline not found' });

        const { data, error } = await supabase
            .from('pipeline_stages')
            .select('*')
            .eq('pipeline_id', req.params.id)
            .order('display_order', { ascending: true });

        if (error) throw error;
        res.json(data || []);
    } catch (err) {
        console.error('Error fetching stages:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/pipelines
router.post('/', requirePermission('Pipelines', 'read_write'), async (req, res) => {
    try {
        const supabase = supabaseAdmin;
        const user = req.user;

        if (!user || !user.id) {
            return res.status(401).json({ error: 'User context missing' });
        }

        const { name, description, color, stages } = req.body;

        // Create pipeline
        const { data: pipeline, error: pipelineError } = await supabase
            .from('pipelines')
            .insert([{
                user_id: user.id,
                name: name || 'New Pipeline',
                description: description || '',
                color: color || '#3b82f6',
                is_active: true
            }])
            .select()
            .single();

        if (pipelineError) throw pipelineError;

        try {
            logCRMEvent('CREATE_PIPELINE', {
                pipelineId: pipeline.id,
                name: pipeline.name,
                stageCount: stages ? stages.length : 0
            });
        } catch (e) { }

        // Create stages if provided
        if (stages && Array.isArray(stages) && stages.length > 0) {
            const stagePayload = stages.map((stage, index) => ({
                user_id: user.id,
                pipeline_id: pipeline.id,
                name: stage.name || `Stage ${index + 1}`,
                description: stage.description || '',
                color: stage.color || '#6b7280',
                display_order: stage.display_order !== undefined ? stage.display_order : index,
                is_active: true
            }));

            const { error: stagesError } = await supabase
                .from('pipeline_stages')
                .insert(stagePayload);

            if (stagesError) {
                console.error('Error creating stages:', stagesError);
            }
        }

        res.json(pipeline);
    } catch (err) {
        console.error('Error creating pipeline:', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/pipelines/:id
router.put('/:id', requirePermission('Pipelines', 'read_write'), async (req, res) => {
    try {
        const supabase = supabaseAdmin;
        const { name, description, color, is_active } = req.body;

        const payload = {};
        if (name !== undefined) payload.name = name;
        if (description !== undefined) payload.description = description;
        if (color !== undefined) payload.color = color;
        if (is_active !== undefined) payload.is_active = is_active;

        const { data, error } = await supabase
            .from('pipelines')
            .update(payload)
            .eq('id', req.params.id)
            .eq('user_id', req.user.id)
            .select()
            .single();

        if (error) throw error;

        try {
            logCRMEvent('UPDATE_PIPELINE', {
                pipelineId: req.params.id,
                updates: Object.keys(payload)
            });
        } catch (e) { }

        res.json(data);
    } catch (err) {
        console.error('Error updating pipeline:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/pipelines/:id
router.delete('/:id', requirePermission('Pipelines', 'all_access'), async (req, res) => {
    try {
        const supabase = supabaseAdmin;
        const pipelineId = req.params.id;
        const userId = req.user?.id;

        console.log(`[Pipeline] Delete Request: ID=${pipelineId} User=${userId}`);

        // 0. OWNER VERIFICATION: Check if pipeline exists and belongs to user
        const { data: pipeline, error: findError } = await supabase
            .from('pipelines')
            .select('id, user_id')
            .eq('id', pipelineId)
            .eq('user_id', userId)
            .single();

        if (findError || !pipeline) {
            console.log('[Pipeline] Delete aborted: Pipeline not found or access denied.');
            return res.status(404).json({ error: 'Pipeline not found or access denied' });
        }

        // 1. STAGE PREPARATION: Get stages to unlink contacts
        const { data: stages } = await supabase
            .from('pipeline_stages')
            .select('id')
            .eq('pipeline_id', pipelineId);

        const stageIds = stages ? stages.map(s => s.id) : [];

        // 2. UNLINK CONTACTS: Set stage_id to NULL for any contacts in these stages
        if (stageIds.length > 0) {
            const { error: contactsError } = await supabase
                .from('contacts')
                .update({ stage_id: null })
                .in('stage_id', stageIds)
                .eq('user_id', userId);

            if (contactsError) {
                console.warn('[Pipeline] Warning: Failed to unlink contacts (might block stage delete)', contactsError);
            }
        }

        // 3. CLEANUP LEADS: Fetch and delete leads + cascade dependencies
        const { data: leads } = await supabase
            .from('leads')
            .select('id')
            .eq('pipeline_id', pipelineId)
            .eq('user_id', userId);

        const leadIds = leads ? leads.map(l => l.id) : [];

        if (leadIds.length > 0) {
            // Best-effort cleanup of lead sub-resources
            const cleanupResults = await Promise.all([
                supabase.from('tasks').delete().in('lead_id', leadIds).eq('user_id', userId),
                supabase.from('notes').delete().in('lead_id', leadIds).eq('user_id', userId),
                supabase.from('appointments').delete().in('lead_id', leadIds).eq('user_id', userId),
                supabase.from('call_logs').delete().in('lead_id', leadIds).eq('user_id', userId)
            ]);

            if (cleanupResults.some(r => r.error)) {
                console.warn('[Pipeline] Some lead dependencies failed to delete:', cleanupResults.filter(r => r.error));
            }

            // Hard Delete Leads
            const { error: leadsDelError } = await supabase
                .from('leads')
                .delete()
                .eq('pipeline_id', pipelineId)
                .eq('user_id', userId);

            if (leadsDelError) {
                console.error('[Pipeline] Error deleting leads:', leadsDelError);
                throw leadsDelError;
            }
        }

        // 4. DELETE STAGES
        const { error: stagesDelError } = await supabase
            .from('pipeline_stages')
            .delete()
            .eq('pipeline_id', pipelineId)
            .eq('user_id', userId);

        if (stagesDelError) {
            console.error('[Pipeline] Error deleting stages:', stagesDelError);
            throw stagesDelError;
        }

        // 5. DELETE PIPELINE
        const { data: deletedPipeline, error: deleteError } = await supabase
            .from('pipelines')
            .delete()
            .eq('id', pipelineId)
            .eq('user_id', userId)
            .select()
            .single();

        if (deleteError) {
            console.error('[Pipeline] Critical Error deleting pipeline:', deleteError);
            throw deleteError;
        }

        if (!deletedPipeline) {
            console.error('[Pipeline] Delete failed: No rows deleted (RLS or ID mismatch)');
            return res.status(404).json({ error: 'Pipeline not found or access denied (No changes made)' });
        }

        try {
            logCRMEvent('DELETE_PIPELINE', { pipelineId });
        } catch (e) { }

        console.log(`[Pipeline] Successfully deleted pipeline ${pipelineId}`);
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting pipeline:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/pipelines/:id/kanban
router.get('/:id/kanban', requirePermission('Pipelines', 'read'), async (req, res) => {
    try {
        const supabase = supabaseAdmin;
        const pipelineId = req.params.id;
        const userId = req.user.id;

        // 1. Fetch Pipeline
        const { data: pipeline, error: pipelineError } = await supabase
            .from('pipelines')
            .select('*')
            .eq('id', pipelineId)
            .eq('user_id', userId)
            .single();

        if (pipelineError) throw pipelineError;

        // 2. Fetch Stages
        const { data: stages, error: stagesError } = await supabase
            .from('pipeline_stages')
            .select('*')
            .eq('pipeline_id', pipelineId)
            .eq('user_id', userId)
            .order('display_order', { ascending: true });

        if (stagesError) throw stagesError;

        // 3. Fetch Leads Per Stage (Parallel)
        const stageDataPromises = stages.map(async (stage) => {
            let query = supabase
                .from('leads')
                .select('*', { count: 'exact' })
                .eq('pipeline_id', pipelineId)
                .eq('stage_id', stage.id)
                .eq('user_id', userId);

            if (req.staff && req.staff.permissions && req.staff.permissions.only_assigned_leads === 'all_access') {
                query = query.contains('assigned_staff_ids', [req.staff.staffId]);
            }

            // Search Support
            if (req.query.search) {
                const s = req.query.search;
                query = query.or(`name.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%,company.ilike.%${s}%`);
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

            if (req.query.fromDate) {
                query = query.gte('created_at', new Date(req.query.fromDate).toISOString());
            }
            if (req.query.toDate) {
                const toD = new Date(req.query.toDate);
                toD.setHours(23, 59, 59, 999);
                query = query.lte('created_at', toD.toISOString());
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

            // Per-Stage Pagination (Initial Load: 20)
            query = query.range(0, 19);

            const { data, count, error } = await query;
            if (error) throw error;

            return {
                stage,
                leads: (data || []).map(lead => ({
                    ...lead,
                    assigned_staff_ids: lead.assigned_staff_ids || (lead.custom_data && lead.custom_data.assigned_staff_ids) || []
                })),
                total_count: count || 0
            };
        });

        const columnsData = await Promise.all(stageDataPromises);

        // 5. Construct Kanban Board
        const columns = columnsData.map(c => ({
            stage: c.stage,
            leads: c.leads,
            total_count: c.total_count
        }));

        res.json({
            pipeline,
            columns,
            pagination: {
                page: 1,
                limit: 20,
                total: columns.reduce((acc, col) => acc + col.total_count, 0),
                totalPages: 1
            }
        });
    } catch (err) {
        console.error('Error fetching kanban board:', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/pipelines/:id/default - Set pipeline as default
router.put('/:id/default', requirePermission('Pipelines', 'read_write'), async (req, res) => {
    try {
        const supabase = supabaseAdmin;
        const { id } = req.params;
        const user = req.user;

        if (!user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // 1. Unset existing default for this user
        try {
            await supabase
                .from('pipelines')
                .update({ is_default: false })
                .eq('user_id', user.id);
        } catch (e) { }

        // 2. Set the target pipeline as default
        const { data, error } = await supabase
            .from('pipelines')
            .update({ is_default: true })
            .eq('id', id)
            .eq('user_id', user.id)
            .select()
            .single();

        if (error) {
            if (error.code === '42703' || (error.message && error.message.includes('column') && error.message.includes('does not exist'))) {
                return res.status(200).json({
                    warning: 'Default pipeline not saved persistently (schema update required).',
                    id: id
                });
            }
            throw error;
        }

        res.json(data);
    } catch (err) {
        console.error('Error setting default pipeline:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/pipelines/:id/stages - Create a new stage
router.post('/:id/stages', requirePermission('Pipelines', 'read_write'), async (req, res) => {
    try {
        const supabase = supabaseAdmin;
        const { id } = req.params; // pipeline_id
        const user = req.user;
        const { name, color, display_order } = req.body;

        if (!name) return res.status(400).json({ error: 'Stage name is required' });

        const { data, error } = await supabase
            .from('pipeline_stages')
            .insert([{
                pipeline_id: id,
                user_id: user.id,
                name,
                color: color || '#6b7280',
                display_order: display_order || 0,
                is_active: true
            }])
            .select()
            .single();

        if (error) throw error;

        try {
            logCRMEvent('CREATE_PIPELINE_STAGE', {
                stageId: data.id,
                pipelineId: id,
                name: name
            });
        } catch (e) { }

        res.json(data);
    } catch (err) {
        console.error('Error creating stage:', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/pipelines/stages/:stageId - Update a stage
router.put('/stages/:stageId', requirePermission('Pipelines', 'read_write'), async (req, res) => {
    try {
        const supabase = supabaseAdmin;
        const { stageId } = req.params;
        const { name, color, display_order, is_active } = req.body;

        const payload = { updated_at: new Date().toISOString() };
        if (name !== undefined) payload.name = name;
        if (color !== undefined) payload.color = color;
        if (display_order !== undefined) payload.display_order = display_order;
        if (is_active !== undefined) payload.is_active = is_active;

        const { data, error } = await supabase
            .from('pipeline_stages')
            .update(payload)
            .eq('id', stageId)
            .eq('user_id', req.user.id)
            .select()
            .single();

        if (error) throw error;

        try {
            logCRMEvent('UPDATE_PIPELINE_STAGE', {
                stageId: stageId,
                updates: Object.keys(payload)
            });
        } catch (e) { }

        res.json(data);
    } catch (err) {
        console.error('Error updating stage:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/pipelines/stages/:stageId - Delete a stage
router.delete('/stages/:stageId', requirePermission('Pipelines', 'all_access'), async (req, res) => {
    try {
        const supabase = supabaseAdmin;
        const { stageId } = req.params;

        const { error } = await supabase
            .from('pipeline_stages')
            .delete()
            .eq('id', stageId)
            .eq('user_id', req.user.id);

        if (error) throw error;

        try {
            logCRMEvent('DELETE_PIPELINE_STAGE', { stageId });
        } catch (e) { }

        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting stage:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
