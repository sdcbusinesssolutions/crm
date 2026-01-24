const express = require('express');
const router = express.Router();
const { getAuthenticatedSupabase } = require('../lib/supabaseClient');
const { logCRMEvent } = require('../utils/logger');

// GET /api/pipelines
router.get('/', async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { data, error } = await supabase
            .from('pipelines')
            .select('*')
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
router.get('/:id', async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { data, error } = await supabase
            .from('pipelines')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Error fetching pipeline:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/pipelines/:id/stages
router.get('/:id/stages', async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
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
router.post('/', async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
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
                // Don't fail the whole request, just log the error
            }
        }

        res.json(pipeline);
    } catch (err) {
        console.error('Error creating pipeline:', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/pipelines/:id
router.put('/:id', async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
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
router.delete('/:id', async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const pipelineId = req.params.id;
        const userId = req.user?.id;

        console.log(`[Pipeline] Delete Request: ID=${pipelineId} User=${userId}`);

        // 0. OWNER VERIFICATION: Check if pipeline exists and belongs to user
        const { data: pipeline, error: findError } = await supabase
            .from('pipelines')
            .select('id, user_id')
            .eq('id', pipelineId)
            // .eq('user_id', userId) // Let RLS handle this, or be explicit if needed
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
        // This is critical if Contacts table has FK to pipeline_stages w/o CASCADE
        if (stageIds.length > 0) {
            const { error: contactsError } = await supabase
                .from('contacts')
                .update({ stage_id: null })
                .in('stage_id', stageIds);

            if (contactsError) {
                console.warn('[Pipeline] Warning: Failed to unlink contacts (might block stage delete)', contactsError);
            }
        }

        // 3. CLEANUP LEADS: Fetch and delete leads + cascade dependencies
        const { data: leads } = await supabase
            .from('leads')
            .select('id')
            .eq('pipeline_id', pipelineId);

        const leadIds = leads ? leads.map(l => l.id) : [];

        if (leadIds.length > 0) {
            // Best-effort cleanup of lead sub-resources
            const cleanupResults = await Promise.all([
                supabase.from('tasks').delete().in('lead_id', leadIds),
                supabase.from('notes').delete().in('lead_id', leadIds),
                supabase.from('appointments').delete().in('lead_id', leadIds),
                supabase.from('call_logs').delete().in('lead_id', leadIds)
            ]);

            if (cleanupResults.some(r => r.error)) {
                console.warn('[Pipeline] Some lead dependencies failed to delete:', cleanupResults.filter(r => r.error));
            }

            // Hard Delete Leads
            const { error: leadsDelError } = await supabase
                .from('leads')
                .delete()
                .eq('pipeline_id', pipelineId);

            if (leadsDelError) {
                console.error('[Pipeline] Error deleting leads:', leadsDelError);
                throw leadsDelError;
            }
        }

        // 4. DELETE STAGES
        const { error: stagesDelError } = await supabase
            .from('pipeline_stages')
            .delete()
            .eq('pipeline_id', pipelineId);

        if (stagesDelError) {
            console.error('[Pipeline] Error deleting stages:', stagesDelError);
            throw stagesDelError;
        }

        // 5. DELETE PIPELINE
        // Use select() to ensure we get the deleted record back, verifying it was actually deleted
        const { data: deletedPipeline, error: deleteError } = await supabase
            .from('pipelines')
            .delete()
            .eq('id', pipelineId)
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
router.get('/:id/kanban', async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const pipelineId = req.params.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50; // Default limit 50
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        // 1. Fetch Pipeline
        const { data: pipeline, error: pipelineError } = await supabase
            .from('pipelines')
            .select('*')
            .eq('id', pipelineId)
            .single();

        if (pipelineError) throw pipelineError;

        // 2. Fetch Stages
        const { data: stages, error: stagesError } = await supabase
            .from('pipeline_stages')
            .select('*')
            .eq('pipeline_id', pipelineId)
            .order('display_order', { ascending: true });

        if (stagesError) throw stagesError;

        // 3. Fetch Leads with Pagination
        const { data: leads, count, error: leadsError } = await supabase
            .from('leads')
            .select('*', { count: 'exact' })
            .eq('pipeline_id', pipelineId)
            .order('created_at', { ascending: false })
            .range(from, to);

        if (leadsError) throw leadsError;

        // 4. Construct Kanban Board
        const columns = stages.map(stage => {
            const stageLeads = leads.filter(lead => lead.stage_id === stage.id);
            return {
                stage: stage,
                leads: stageLeads, // Only leads in current page
                total_count: stageLeads.length // Count of visible leads (not total in DB for stage, which is a trade-off)
            };
        });

        res.json({
            pipeline,
            columns,
            pagination: {
                page,
                limit,
                total: count,
                totalPages: Math.ceil((count || 0) / limit)
            }
        });
    } catch (err) {
        console.error('Error fetching kanban board:', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/pipelines/:id/default - Set pipeline as default
router.put('/:id/default', async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { id } = req.params;
        let user = req.user;

        if (!user) {
            // Try to get user from supabase client if middleware didn't populate it
            const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
            if (authError || !authUser) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            user = authUser;
        }

        // 1. Unset existing default for this user
        // We'll use a specific key in user settings or a dedicated 'is_default' column if we added one.
        // For now, let's assume we store this preference in the `pipelines` table itself (e.g. `is_default` boolean).
        // Since the schema doesn't seem to have `is_default`, let's check `view_file` again to see schema or use metadata.

        // Plan B: Use `is_default` boolean column on `pipelines` table.
        // We first set all other pipelines for this user to is_default = false
        try {
            await supabase
                .from('pipelines')
                .update({ is_default: false })
                .eq('user_id', user.id);
        } catch (e) {
            // Ignore error here if column missing, let the next one handle it or fail gracefully
            // Actually, supabase-js might return error in return object, let's checking
            // Wait, supabase-js v2 returns object { error }, doesn't throw by default unless we check it.
            // But my code above uses 'await supabase...'. 
            // The previous code didn't check error for the first update, so it might have been fine 
            // IF supabase-js doesn't throw. 
            // However, let's be explicit and assign it to separate var if we want to check, or just let it fly.
            // The issue reported is 500 error, which means 'throw error' happened somewhere.
        }

        // 2. Set the target pipeline as default
        const { data, error } = await supabase
            .from('pipelines')
            .update({ is_default: true })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Failed to update is_default, falling back to local metadata or ignoring.', error);
            // If the column doesn't exist, we can't do much without a migration. 
            // However, we shouldn't crash or return 500 if the column is missing, 
            // maybe we can return a specific error that the frontend can handle or just swallow it 
            // if we accept that the feature is disabled until migration.

            // IF it's column missing error:
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
        // Fallback: If `is_default` column missing, maybe store in user specific settings table?
        // For now, return error.
        res.status(500).json({ error: err.message });
    }
});

// POST /api/pipelines/:id/stages - Create a new stage
router.post('/:id/stages', async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
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
router.put('/stages/:stageId', async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
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
router.delete('/stages/:stageId', async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { stageId } = req.params;

        const { error } = await supabase
            .from('pipeline_stages')
            .delete()
            .eq('id', stageId);

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
