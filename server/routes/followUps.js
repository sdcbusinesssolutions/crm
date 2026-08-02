const express = require('express');
const router = express.Router();
const { getAuthenticatedSupabase } = require('../lib/supabaseClient');
const requirePermission = require('../middleware/requirePermission');

// GET /api/follow-ups
router.get('/', requirePermission('Follow-up', 'read'), async (req, res) => {
    try {
        const supabase = await getAuthenticatedSupabase(req);
        const { contact_id, status, start_date, end_date } = req.query;

        let query = supabase
            .from('follow_ups')
            .select(`
                *,
                contacts (
                    name,
                    phone,
                    pipelines (name),
                        drip_enrollments (
                            id,
                            drip_campaign_id,
                            status,
                            stop_at,
                            started_at,
                            is_looping,
                            notification_rules,
                            drip_campaigns (name)
                        )
                )
            `)
            .eq('user_id', req.user.id);
            
        // Staff can only see their own follow-ups
        if (req.user.isStaff && req.user.staffId) {
            query = query.eq('created_by_staff_id', req.user.staffId);
        }

        query = query.order('scheduled_at', { ascending: true });

        if (contact_id) {
            query = query.eq('contact_id', contact_id);
        }
        if (status) {
            query = query.eq('status', status);
        }
        if (start_date) {
            query = query.gte('scheduled_at', start_date);
        }
        if (end_date) {
            query = query.lte('scheduled_at', end_date);
        }

        const { data, error } = await query;

        if (error) throw error;
        
        // --- RESOLVE CREATOR NAMES ---
        // Collect staff IDs from created_by_staff_id, and owner IDs from user_id if no staff ID is present.
        const staffIds = [...new Set(data.map(f => f.created_by_staff_id).filter(Boolean))];
        const ownerIds = [...new Set(data.map(f => !f.created_by_staff_id ? f.user_id : null).filter(Boolean))];
        
        if (staffIds.length > 0 || ownerIds.length > 0) {
            const { supabaseAdmin } = require('../lib/supabaseClient');
            if (supabaseAdmin) {
                const memberMap = {};
                
                // 1. Fetch Staff Names
                if (staffIds.length > 0) {
                    const { data: teamStaff } = await supabaseAdmin.from('team_staff').select('id, name').in('id', staffIds);
                    if (teamStaff) teamStaff.forEach(ts => memberMap[`staff_${ts.id}`] = ts.name);
                }

                // 2. Fetch Owner/Agent Names (Fallback)
                if (ownerIds.length > 0) {
                    const { data: teamStaffOwners } = await supabaseAdmin.from('team_staff').select('tenant_id, name').in('tenant_id', ownerIds);
                    if (teamStaffOwners) teamStaffOwners.forEach(ts => memberMap[`user_${ts.tenant_id}`] = ts.name);
                    
                    const { data: teamMembers } = await supabaseAdmin.from('team_members').select('user_id, first_name, last_name').in('user_id', ownerIds);
                    if (teamMembers) {
                        teamMembers.forEach(tm => {
                            if (!memberMap[`user_${tm.user_id}`]) memberMap[`user_${tm.user_id}`] = `${tm.first_name || ''} ${tm.last_name || ''}`.trim();
                        });
                    }
                    
                    const { data: profiles } = await supabaseAdmin.from('profiles').select('id, email').in('id', ownerIds);
                    if (profiles) {
                        profiles.forEach(p => {
                            if (!memberMap[`user_${p.id}`]) memberMap[`user_${p.id}`] = p.email;
                        });
                    }
                }

                data.forEach(f => {
                    let name = null;
                    if (f.created_by_staff_id) {
                        name = memberMap[`staff_${f.created_by_staff_id}`];
                        if (name && f.created_by_staff_id === req.user.staffId) {
                             name = name + ' (You)';
                        }
                    } else {
                        name = memberMap[`user_${f.user_id}`];
                        if (!name && f.user_id === req.user.id) {
                            name = req.user.user_metadata?.name || req.user.user_metadata?.full_name || req.user.email || req.user.phone || 'Owner';
                        }
                    }
                    f.created_by_name = name || 'System';
                });
            }
        }
        
        res.json(data);
    } catch (err) {
        console.error('Error fetching follow-ups:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/follow-ups
router.post('/', requirePermission('Follow-up', 'read_write'), async (req, res) => {
    try {
        const supabase = await getAuthenticatedSupabase(req);
        const { contact_id, title, description, scheduled_at, priority, type, timezone, recurrence_rule } = req.body;
        
        let resolved_contact_id = contact_id;
        
        if (!resolved_contact_id) {
            return res.status(400).json({ error: 'Contact ID is required' });
        }

        // AUTO-CORRECT: If the frontend passed a lead_id instead of a contact_id, resolve it
        const { data: contactCheck } = await supabase.from('contacts').select('id').eq('id', resolved_contact_id).maybeSingle();
        if (!contactCheck) {
            // Check if it's a lead
            const { data: lead } = await supabase.from('leads').select('phone').eq('id', resolved_contact_id).maybeSingle();
            if (lead && lead.phone) {
                const { data: realContact } = await supabase.from('contacts').select('id').eq('phone', lead.phone).maybeSingle();
                if (realContact) {
                    resolved_contact_id = realContact.id;
                } else {
                    return res.status(400).json({ error: 'Lead has no associated contact to attach follow-up to.' });
                }
            } else {
                 return res.status(400).json({ error: 'Contact not found.' });
            }
        }

        const insertData = {
            user_id: req.user.id,
            contact_id: resolved_contact_id,
            title,
            description,
            scheduled_at,
            priority: priority || 'MEDIUM',
            type: type || 'TASK',
            timezone: timezone || 'UTC',
            recurrence_rule,
            status: 'PENDING'
        };

        if (req.user.isStaff && req.user.staffId) {
            insertData.created_by_staff_id = req.user.staffId;
        }

        const { data, error } = await supabase
            .from('follow_ups')
            .insert(insertData)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Error creating follow-up:', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/follow-ups/:id
router.put('/:id', requirePermission('Follow-up', 'read_write'), async (req, res) => {
    try {
        const supabase = await getAuthenticatedSupabase(req);
        const { title, description, scheduled_at, status, priority, type, contact_id, recurrence_rule } = req.body;

        let resolved_contact_id = contact_id;
        if (resolved_contact_id) {
            const { data: contactCheck } = await supabase.from('contacts').select('id').eq('id', resolved_contact_id).maybeSingle();
            if (!contactCheck) {
                const { data: lead } = await supabase.from('leads').select('phone').eq('id', resolved_contact_id).maybeSingle();
                if (lead && lead.phone) {
                    const { data: realContact } = await supabase.from('contacts').select('id').eq('phone', lead.phone).maybeSingle();
                    if (realContact) resolved_contact_id = realContact.id;
                }
            }
        }

        const updates = {};
        if (title !== undefined) updates.title = title;
        if (description !== undefined) updates.description = description;
        if (scheduled_at !== undefined) updates.scheduled_at = scheduled_at;
        if (status !== undefined) updates.status = status;
        if (priority !== undefined) updates.priority = priority;
        if (type !== undefined) updates.type = type;
        if (resolved_contact_id !== undefined) updates.contact_id = resolved_contact_id;
        if (recurrence_rule !== undefined) updates.recurrence_rule = recurrence_rule;
        updates.updated_at = new Date();

        let query = supabase
            .from('follow_ups')
            .update(updates)
            .eq('id', req.params.id)
            .eq('user_id', req.user.id);

        if (req.user.isStaff && req.user.staffId) {
            query = query.eq('created_by_staff_id', req.user.staffId);
        }

        const { data, error } = await query.select().single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Error updating follow-up:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/follow-ups/:id
router.delete('/:id', requirePermission('Follow-up', 'all_access'), async (req, res) => {
    try {
        const supabase = await getAuthenticatedSupabase(req);
        let query = supabase
            .from('follow_ups')
            .delete()
            .eq('id', req.params.id)
            .eq('user_id', req.user.id);

        if (req.user.isStaff && req.user.staffId) {
            query = query.eq('created_by_staff_id', req.user.staffId);
        }

        const { error } = await query;

        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting follow-up:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
