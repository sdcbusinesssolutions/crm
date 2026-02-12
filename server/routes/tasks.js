const express = require('express');
const router = express.Router();
const { getAuthenticatedSupabase } = require('../lib/supabaseClient');
const { logCRMEvent } = require('../utils/logger');
const flowEngine = require('../services/flowEngine');

// GET /api/tasks?lead_id=...
// GET /api/tasks?lead_id=... or /api/tasks (all)
router.get('/', async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { lead_id } = req.query;

        let query = supabase
            .from('tasks')
            .select('*, leads ( name, phone, pipelines ( name ) )')
            .eq('user_id', req.user.id)
            .order('due_date', { ascending: true });

        if (lead_id) {
            query = query.eq('lead_id', lead_id);
        }

        const { data, error } = await query;

        if (error) throw error;
        console.log(`[DEBUG] GET /api/tasks | User: ${req.user?.id} | Tasks Found: ${data?.length}`);
        res.json(data || []);
    } catch (err) {
        console.error('Error fetching tasks:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/tasks
router.post('/', async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const user = req.user;
        const { lead_id, title, description, due_date, is_completed } = req.body;

        const { data, error } = await supabase
            .from('tasks')
            .insert([{
                user_id: user.id,
                lead_id,
                title,
                description,
                due_date,
                is_completed: is_completed || false
            }])
            .select()
            .single();

        if (error) throw error;

        try {
            logCRMEvent('CREATE_TASK', {
                taskId: data.id,
                leadId: lead_id,
                title: title
            });
        } catch (e) { }

        res.json(data);
    } catch (err) {
        console.error('Error creating task:', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/tasks/:id
router.put('/:id', async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { title, description, due_date, is_completed } = req.body;

        const payload = {};
        if (title !== undefined) payload.title = title;
        if (description !== undefined) payload.description = description;
        if (due_date !== undefined) payload.due_date = due_date;
        if (is_completed !== undefined) payload.is_completed = is_completed;

        // Always update the timestamp
        payload.updated_at = new Date().toISOString();

        const { data, error } = await supabase
            .from('tasks')
            .update(payload)
            .eq('id', req.params.id)
            .eq('user_id', req.user.id)
            .select()
            .single();

        if (error) throw error;

        try {
            logCRMEvent('UPDATE_TASK', {
                taskId: req.params.id,
                updates: Object.keys(payload)
            });

            // Check if task was completed
            if (is_completed === true) {
                // Fetch lead details for this task to trigger flow
                const { data: taskDetails } = await supabase
                    .from('tasks')
                    .select('*, leads(phone, name, email)')
                    .eq('id', req.params.id)
                    .single();

                if (taskDetails && taskDetails.leads && taskDetails.leads.phone) {
                    console.log(`[TasksAPI] Triggering 'task_completed' flow for Task ${req.params.id}`);
                    await flowEngine.triggerFlowByEvent(req.user.id, taskDetails.leads.phone, 'task_completed', {
                        taskId: taskDetails.id,
                        leadId: taskDetails.lead_id,
                        title: taskDetails.title,
                        description: taskDetails.description,
                        dueDate: taskDetails.due_date,
                        // Pass contact details explicitly
                        name: taskDetails.leads.name,
                        email: taskDetails.leads.email,
                        'contact.name': taskDetails.leads.name,
                        'contact.email': taskDetails.leads.email
                    });
                }
            }
        } catch (e) {
            console.error('Task Trigger Warning:', e);
        }

        res.json(data);
    } catch (err) {
        console.error('Error updating task:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { error } = await supabase
            .from('tasks')
            .delete()
            .eq('id', req.params.id)
            .eq('user_id', req.user.id);

        if (error) throw error;

        try {
            logCRMEvent('DELETE_TASK', { taskId: req.params.id });
        } catch (e) { }

        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting task:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
