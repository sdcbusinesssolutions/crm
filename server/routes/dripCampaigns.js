const express = require('express');
const router = express.Router();
const { getAuthenticatedSupabase } = require('../lib/supabaseClient');

// --- CAMPAIGNS ---

// GET /api/drip-campaigns
router.get('/', async (req, res) => {
    try {
        const supabase = await getAuthenticatedSupabase(req);

        let query = supabase
            .from('drip_campaigns')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });

        const { data, error } = await query;
        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Error fetching drip campaigns:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/drip-campaigns/:id
router.get('/:id', async (req, res) => {
    try {
        const supabase = await getAuthenticatedSupabase(req);

        // Fetch campaign details and steps in one go if possible, or separate queries
        const { data: campaign, error: campaignError } = await supabase
            .from('drip_campaigns')
            .select('*, steps:drip_steps(*)')
            .eq('id', req.params.id)
            .eq('user_id', req.user.id)
            .order('step_order', { foreignTable: 'drip_steps', ascending: true })
            .single();

        if (campaignError) {
            console.error('Campaign retrieval error:', campaignError);
            throw campaignError;
        }
        res.json(campaign);
    } catch (err) {
        console.error('Error fetching drip campaign details:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/drip-campaigns
router.post('/', async (req, res) => {
    try {
        const supabase = await getAuthenticatedSupabase(req);
        const { name, description, trigger_type, trigger_config, stop_on_reply, allow_reentry, allowed_days, time_window_start, time_window_end } = req.body;
        const status = req.body.status || 'DRAFT';

        const { data, error } = await supabase
            .from('drip_campaigns')
            .insert({
                user_id: req.user.id,
                name,
                description,
                trigger_type: trigger_type || 'MANUAL',
                trigger_value: req.body.trigger_value,
                trigger_config,
                stop_on_reply: stop_on_reply !== undefined ? stop_on_reply : true,
                allow_reentry: allow_reentry || false,
                status: status,
                allowed_days: allowed_days || '0,1,2,3,4,5,6',
                time_window_start: time_window_start || '00:00',
                time_window_end: time_window_end || '23:59'
            })
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Error creating drip campaign:', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/drip-campaigns/:id
router.put('/:id', async (req, res) => {
    try {
        const supabase = await getAuthenticatedSupabase(req);
        const { name, description, trigger_type, trigger_config, status, stop_on_reply, allow_reentry, allowed_days, time_window_start, time_window_end } = req.body;

        const updates = {};
        if (name !== undefined) updates.name = name;
        if (description !== undefined) updates.description = description;
        if (trigger_type !== undefined) updates.trigger_type = trigger_type;
        if (trigger_config !== undefined) updates.trigger_config = trigger_config;
        if (req.body.trigger_value !== undefined) updates.trigger_value = req.body.trigger_value;
        if (status !== undefined) updates.status = status;
        if (stop_on_reply !== undefined) updates.stop_on_reply = stop_on_reply;
        if (allow_reentry !== undefined) updates.allow_reentry = allow_reentry;
        if (allowed_days !== undefined) updates.allowed_days = allowed_days;
        if (time_window_start !== undefined) updates.time_window_start = time_window_start;
        if (time_window_end !== undefined) updates.time_window_end = time_window_end;
        updates.updated_at = new Date();

        const { data, error } = await supabase
            .from('drip_campaigns')
            .update(updates)
            .eq('id', req.params.id)
            .eq('user_id', req.user.id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Error updating drip campaign:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/drip-campaigns/:id
router.delete('/:id', async (req, res) => {
    try {
        const supabase = await getAuthenticatedSupabase(req);
        const { error } = await supabase
            .from('drip_campaigns')
            .delete()
            .eq('id', req.params.id)
            .eq('user_id', req.user.id);

        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting drip campaign:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- STEPS ---

// POST /api/drip-campaigns/:id/steps
router.post('/:id/steps', async (req, res) => {
    try {
        const supabase = await getAuthenticatedSupabase(req);
        // Verify ownership of campaign first
        const { data: campaign, error: campError } = await supabase
            .from('drip_campaigns')
            .select('id')
            .eq('id', req.params.id)
            .eq('user_id', req.user.id)
            .single();

        if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

        const { step_order, delay_value, delay_unit, step_type, template_id, content, step_config, conditions, parent_step_id } = req.body;

        const { data, error } = await supabase
            .from('drip_steps')
            .insert({
                drip_campaign_id: req.params.id,
                step_order: step_order || 1,
                delay_value: delay_value || 0,
                delay_unit: delay_unit || 'DAYS',
                step_type: step_type || 'WHATSAPP_MESSAGE', // 'WHATSAPP_MESSAGE' | 'EMAIL' | 'WAIT' | 'AI_INTENT'
                step_config: step_config || { template_id, content }, // Consolidate config
                // REMOVED: channel, action_type (Use step_type instead)
                parent_step_id
            })
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Error creating drip step:', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/drip-campaigns/:id/steps/:stepId
router.put('/:id/steps/:stepId', async (req, res) => {
    try {
        const supabase = await getAuthenticatedSupabase(req);
        // Verify ownership via join or two steps. Simpler is two steps for security.
        const { data: campaign } = await supabase
            .from('drip_campaigns')
            .select('id')
            .eq('id', req.params.id)
            .eq('user_id', req.user.id)
            .single();

        if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

        const updates = req.body;
        // prevent altering critical IDs
        delete updates.id;
        delete updates.drip_campaign_id;
        delete updates.created_at;

        const { data, error } = await supabase
            .from('drip_steps')
            .update(updates)
            .eq('id', req.params.stepId)
            .eq('drip_campaign_id', req.params.id) // Ensure it belongs to this campaign
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Error updating drip step:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/drip-campaigns/:id/steps/:stepId
router.delete('/:id/steps/:stepId', async (req, res) => {
    try {
        const supabase = await getAuthenticatedSupabase(req);

        // Verify ownership
        const { data: campaign } = await supabase
            .from('drip_campaigns')
            .select('id')
            .eq('id', req.params.id)
            .eq('user_id', req.user.id)
            .single();

        if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

        const { error } = await supabase
            .from('drip_steps')
            .delete()
            .eq('id', req.params.stepId)
            .eq('drip_campaign_id', req.params.id);

        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting drip step:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- ENROLLMENT ---

// POST /api/drip-campaigns/:id/enroll
// POST /api/drip-campaigns/:id/enroll
router.post('/:id/enroll', async (req, res) => {
    try {
        const supabase = await getAuthenticatedSupabase(req);
        const { contact_ids, stop_at, notification_rules, is_looping } = req.body;

        if (!contact_ids || !Array.isArray(contact_ids) || contact_ids.length === 0) {
            return res.status(400).json({ error: 'No contacts provided' });
        }

        // Verify campaign
        const { data: campaign } = await supabase
            .from('drip_campaigns')
            .select('*')
            .eq('id', req.params.id)
            .eq('user_id', req.user.id)
            .single();

        if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

        // Get the first step
        const { data: firstStep } = await supabase
            .from('drip_steps')
            .select('*')
            .eq('drip_campaign_id', campaign.id)
            .order('step_order', { ascending: true })
            .limit(1)
            .single();

        if (!firstStep) return res.status(400).json({ error: 'Campaign has no steps' });

        // Check for existing enrollments
        let existingQuery = supabase
            .from('drip_enrollments')
            .select('contact_id')
            .eq('drip_campaign_id', campaign.id)
            .in('contact_id', contact_ids);

        if (campaign.allow_reentry) {
            existingQuery = existingQuery.in('status', ['ACTIVE', 'PAUSED', 'PROCESSING']);
        }
        const { data: existing } = await existingQuery;

        const existingContactIds = new Set((existing || []).map(e => e.contact_id));
        const newContacts = contact_ids.filter(id => !existingContactIds.has(id));

        // Update settings for existing active enrollments (Upsert behavior for settings)
        if (existingContactIds.size > 0) {
            const updates = {};
            // Only update fields if provided in request
            if (stop_at !== undefined) updates.stop_at = stop_at ? new Date(stop_at) : null;
            if (notification_rules !== undefined) updates.notification_rules = notification_rules;
            if (is_looping !== undefined) updates.is_looping = is_looping;

            // Only perform update if there are changes to make
            if (Object.keys(updates).length > 0) {
                await supabase
                    .from('drip_enrollments')
                    .update(updates)
                    .eq('drip_campaign_id', campaign.id)
                    .in('contact_id', Array.from(existingContactIds))
                    .in('status', ['ACTIVE', 'PAUSED', 'PROCESSING']);
            }
        }

        if (newContacts.length === 0) {
            return res.json({
                success: true,
                count: 0,
                updated: existingContactIds.size,
                message: 'Existing enrollments updated. No new enrollments created.'
            });
        }

        // Create enrollment records with stop_at
        const enrollments = newContacts.map(contactId => ({
            drip_campaign_id: campaign.id,
            contact_id: contactId,
            current_step_id: firstStep.id,
            status: 'ACTIVE',
            next_run_at: calculateDelay(new Date(), firstStep.delay_value, firstStep.delay_unit),
            started_at: new Date(),
            stop_at: stop_at ? new Date(stop_at) : null,
            notification_rules: notification_rules ? notification_rules : [],
            is_looping: is_looping || false // Should default to false in DB anyway, but explicit is good
        }));

        const { data, error } = await supabase
            .from('drip_enrollments')
            .insert(enrollments);

        if (error) throw error;
        res.json({ success: true, count: newContacts.length, skipped: existingContactIds.size });
    } catch (err) {
        console.error('Error enrolling contacts:', err);
        res.status(500).json({ error: err.message });
    }
});


// Get Enrollments for a Campaign
router.get('/:id/enrollments', async (req, res) => {
    try {
        const supabase = await getAuthenticatedSupabase(req);
        const { supabaseAdmin } = require('../lib/supabaseClient');

        // 1. Verify campaign ownership first using the Auth Client (Respects RLS)
        const { data: campaign, error: cErr } = await supabase
            .from('drip_campaigns')
            .select('id')
            .eq('id', req.params.id)
            .single();

        if (cErr || !campaign) {
            return res.status(404).json({ error: 'Campaign not found or access denied' });
        }

        // 2. Use Admin Client to fetch detailed data including logs (Bypasses missing RLS on log table)
        const { data, error } = await supabaseAdmin
            .from('drip_enrollments')
            .select(`
                *,
                contact:contacts(name, phone),
                current_step:drip_steps(step_order),
                logs:drip_logs(*)
            `)
            .eq('drip_campaign_id', req.params.id)
            .order('started_at', { ascending: false });

        if (error) throw error;
        
        // Sorting logs in JS to be safe if Supabase doesn't sort nested selects as expected
        const processedData = data.map(en => ({
            ...en,
            logs: (en.logs || []).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        }));

        res.json(processedData);
    } catch (error) {
        console.error('Error fetching enrollments:', error);
        res.status(500).json({ error: error.message });
    }
});

// Stop/Cancel an Enrollment Manually
router.post('/enrollments/:enrollmentId/stop', async (req, res) => {
    try {
        const supabase = await getAuthenticatedSupabase(req);
        const { data, error } = await supabase
            .from('drip_enrollments')
            .update({ status: 'CANCELLED', completed_at: new Date() })
            .eq('id', req.params.enrollmentId)
            .select();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error stopping enrollment:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete an Enrollment
router.delete('/enrollments/:enrollmentId', async (req, res) => {
    try {
        const supabase = await getAuthenticatedSupabase(req);
        // Ensure user owns the campaign linked to this enrollment (implicit via RLS usually, but safer to check)
        // RLS on drip_enrollments usually requires user_id on the table or join.
        // If RLS is set up correctly on 'drip_enrollments' (e.g. via join to drip_campaigns), this is simple.
        // Assuming RLS allows delete if user owns the campaign.

        const { error } = await supabase
            .from('drip_enrollments')
            .delete()
            .eq('id', req.params.enrollmentId);

        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting enrollment:', error);
        res.status(500).json({ error: error.message });
    }
});

// SYNC: Retroactively enroll contacts with the matching tag
router.post('/:id/sync', async (req, res) => {
    try {
        const DripTriggerService = require('../services/DripTriggerService');
        const result = await DripTriggerService.syncCampaignEnrollments(req.user.id, req.params.id);
        res.json({ success: true, count: result.count });
    } catch (error) {
        console.error('Error syncing campaign:', error);
        res.status(500).json({ error: error.message });
    }
});

function calculateDelay(startDate, value, unit) {
    const date = new Date(startDate);
    if (!value) return date; // Immediate

    switch (unit) {
        case 'MINUTES': date.setMinutes(date.getMinutes() + value); break;
        case 'HOURS': date.setHours(date.getHours() + value); break;
        case 'DAYS': date.setDate(date.getDate() + value); break;
        case 'WEEKS': date.setDate(date.getDate() + (value * 7)); break;
        case 'MONTHS': date.setMonth(date.getMonth() + value); break;
        default: break;
    }
    return date;
}

module.exports = router;
