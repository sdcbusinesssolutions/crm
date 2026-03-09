const express = require('express');
const router = express.Router();
const { getAuthenticatedSupabase } = require('../lib/supabaseClient');

// GET /api/follow-ups
router.get('/', async (req, res) => {
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
            .eq('user_id', req.user.id)
            .order('scheduled_at', { ascending: true });

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
        res.json(data);
    } catch (err) {
        console.error('Error fetching follow-ups:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/follow-ups
router.post('/', async (req, res) => {
    try {
        const supabase = await getAuthenticatedSupabase(req);
        const { contact_id, title, description, scheduled_at, priority, type, timezone, recurrence_rule } = req.body;
        
        if (!contact_id) {
            return res.status(400).json({ error: 'Contact ID is required' });
        }

        const { data, error } = await supabase
            .from('follow_ups')
            .insert({
                user_id: req.user.id,
                contact_id,
                title,
                description,
                scheduled_at,
                priority: priority || 'MEDIUM',
                type: type || 'TASK',
                timezone: timezone || 'UTC',
                recurrence_rule,
                status: 'PENDING'
            })
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
router.put('/:id', async (req, res) => {
    try {
        const supabase = await getAuthenticatedSupabase(req);
        const { title, description, scheduled_at, status, priority, type, contact_id, recurrence_rule } = req.body;

        const updates = {};
        if (title !== undefined) updates.title = title;
        if (description !== undefined) updates.description = description;
        if (scheduled_at !== undefined) updates.scheduled_at = scheduled_at;
        if (status !== undefined) updates.status = status;
        if (priority !== undefined) updates.priority = priority;
        if (type !== undefined) updates.type = type;
        if (contact_id !== undefined) updates.contact_id = contact_id;
        if (recurrence_rule !== undefined) updates.recurrence_rule = recurrence_rule;
        updates.updated_at = new Date();

        const { data, error } = await supabase
            .from('follow_ups')
            .update(updates)
            .eq('id', req.params.id)
            .eq('user_id', req.user.id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Error updating follow-up:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/follow-ups/:id
router.delete('/:id', async (req, res) => {
    try {
        const supabase = await getAuthenticatedSupabase(req);
        const { error } = await supabase
            .from('follow_ups')
            .delete()
            .eq('id', req.params.id)
            .eq('user_id', req.user.id);

        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting follow-up:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
