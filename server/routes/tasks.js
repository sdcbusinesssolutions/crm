const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../lib/supabaseClient');
const { logCRMEvent } = require('../utils/logger');
const flowEngine = require('../services/flowEngine');

// GET /api/tasks?lead_id=...
router.get('/', async (req, res) => {
    try {
        const supabase = supabaseAdmin;
        const { lead_id } = req.query;

        let query = supabase
            .from('tasks')
            .select('*, leads!inner(name, phone, assigned_staff_ids, pipelines(name))')
            .eq('user_id', req.user.id)
            .order('due_date', { ascending: true });

        // Restrict to staff based on lead assignment (if restricted staff)
        if (req.staff && req.staff.permissions && req.staff.permissions.only_assigned_leads === 'all_access') {
            query = query.contains('leads.assigned_staff_ids', [req.staff.staffId]);
        }

        if (lead_id) {
            query = query.eq('lead_id', lead_id);
        }

        const { data, error } = await query;

        if (error) throw error;
        
        if (data && data.length > 0) {
            // --- RESOLVE CREATOR NAMES ---
            const staffIds = [...new Set(data.map(t => t.metadata?.created_by_staff_id).filter(Boolean))];
            const ownerIds = [...new Set(data.map(t => !t.metadata?.created_by_staff_id ? t.user_id : null).filter(Boolean))];
            
            if (staffIds.length > 0 || ownerIds.length > 0) {
                const memberMap = {};
                
                // 1. Fetch Staff Names
                if (staffIds.length > 0) {
                    const { data: teamStaff } = await supabase.from('team_staff').select('id, name').in('id', staffIds);
                    if (teamStaff) teamStaff.forEach(ts => memberMap[`staff_${ts.id}`] = ts.name);
                }

                // 2. Fetch Owner/Agent Names (Fallback)
                if (ownerIds.length > 0) {
                    const { data: teamStaffOwners } = await supabase.from('team_staff').select('tenant_id, name').in('tenant_id', ownerIds);
                    if (teamStaffOwners) teamStaffOwners.forEach(ts => memberMap[`user_${ts.tenant_id}`] = ts.name);
                    
                    const { data: teamMembers } = await supabase.from('team_members').select('user_id, first_name, last_name').in('user_id', ownerIds);
                    if (teamMembers) {
                        teamMembers.forEach(tm => {
                            if (!memberMap[`user_${tm.user_id}`]) memberMap[`user_${tm.user_id}`] = `${tm.first_name || ''} ${tm.last_name || ''}`.trim();
                        });
                    }
                    
                    const { data: profiles } = await supabase.from('profiles').select('id, email').in('id', ownerIds);
                    if (profiles) {
                        profiles.forEach(p => {
                            if (!memberMap[`user_${p.id}`]) memberMap[`user_${p.id}`] = p.email;
                        });
                    }
                }

                data.forEach(t => {
                    let name = null;
                    const staffId = t.metadata?.created_by_staff_id;
                    if (staffId) {
                        name = memberMap[`staff_${staffId}`];
                        if (name && req.staff && staffId === req.staff.staffId) {
                             name = name + ' (You)';
                        }
                    } else {
                        name = memberMap[`user_${t.user_id}`];
                        if (!name && t.user_id === req.user.id) {
                            name = req.user.user_metadata?.name || req.user.user_metadata?.full_name || req.user.email || req.user.phone || 'Owner';
                        }
                    }
                    t.created_by_name = name || 'System';
                });
            }
        }

        res.json(data || []);
    } catch (err) {
        console.error('Error fetching tasks:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/tasks
router.post('/', async (req, res) => {
    try {
        const supabase = supabaseAdmin;
        const user = req.user;
        const { lead_id, title, description, due_date, is_completed, enable_popup } = req.body;

        const metadata = {
            created_by_staff_id: req.staff ? req.staff.staffId : null,
            created_by_role: req.staff ? 'staff' : 'admin'
        };
        
        if (enable_popup !== undefined) {
            metadata.enable_popup = enable_popup;
        }

        const { data, error } = await supabase
            .from('tasks')
            .insert([{
                user_id: user.id,
                lead_id,
                title,
                description,
                due_date,
                is_completed: is_completed || false,
                metadata: metadata
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
        const supabase = supabaseAdmin;
        const { title, description, due_date, is_completed } = req.body;

        const payload = {};
        if (title !== undefined) payload.title = title;
        if (description !== undefined) payload.description = description;
        if (due_date !== undefined) payload.due_date = due_date;
        if (is_completed !== undefined) payload.is_completed = is_completed;

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

            if (is_completed === true) {
                const { data: taskDetails } = await supabase
                    .from('tasks')
                    .select('*, leads(phone, name, email)')
                    .eq('id', req.params.id)
                    .eq('user_id', req.user.id)
                    .single();

                if (taskDetails && taskDetails.leads && taskDetails.leads.phone) {
                    await flowEngine.triggerFlowByEvent(req.user.id, taskDetails.leads.phone, 'task_completed', {
                        taskId: taskDetails.id,
                        leadId: taskDetails.lead_id,
                        title: taskDetails.title,
                        description: taskDetails.description,
                        dueDate: taskDetails.due_date,
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
        const supabase = supabaseAdmin;
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
