const { supabaseAdmin } = require('../lib/supabaseClient');

const DripTriggerService = {
    /**
     * Handle 'TAG_ADDED' trigger
     * @param {string} userId - The owner's ID
     * @param {object} contact - The contact object (must include id, phone, name)
     * @param {string[]} addedTags - Array of new tags added
     */
    async handleTagAdded(userId, contact, addedTags) {
        if (!addedTags || addedTags.length === 0) return;

        console.log(`[DripTrigger] Checking TAG_ADDED for ${contact.id}. Tags: ${addedTags.join(', ')}`);

        try {
            // 1. Find matching VALID campaigns
            // We search for campaigns where trigger_type = 'TAG_ADDED' 
            // AND trigger_value is in the list of addedTags
            const { data: campaigns, error } = await supabaseAdmin
                .from('drip_campaigns')
                .select('id, name, allow_reentry, trigger_value')
                .eq('user_id', userId)
                .eq('status', 'ACTIVE') // Only active campaigns
                .eq('trigger_type', 'TAG_ADDED')
                .in('trigger_value', addedTags);

            if (error) throw error;

            if (!campaigns || campaigns.length === 0) return;

            console.log(`[DripTrigger] Found ${campaigns.length} matching campaigns.`);

            // 2. Enroll Contact in each campaign
            for (const campaign of campaigns) {
                await this.enrollContact(userId, contact.id, campaign);
            }

        } catch (err) {
            console.error('[DripTrigger] Error handling tag trigger:', err);
        }
    },

    /**
     * Handle 'pipeline_STAGE_CHANGED' trigger
     * @param {string} userId - The owner's ID
     * @param {object} lead - The lead object (must include contact connection or phone)
     * @param {string} newStageId - The new stage ID
     */
    async handleStageChanged(userId, lead, newStageId) {
        if (!newStageId) return;

        console.log(`[DripTrigger] Checking STAGE_CHANGED for Lead ${lead.id}. Stage: ${newStageId}`);

        try {
            // 0. Resolve Contact ID from Lead
            // Leads might not have a direct contact_id, but usually link via phone or contact_id field.
            // Let's assume leads table might have contact_id OR we look up by phone.
            let contactId = lead.contact_id;

            if (!contactId && lead.phone) {
                // Try to find contact by phone
                const { data: contact } = await supabaseAdmin
                    .from('contacts')
                    .select('id')
                    .eq('user_id', userId)
                    .eq('phone', lead.phone)
                    .limit(1)
                    .maybeSingle();

                if (contact) contactId = contact.id;
            }

            if (!contactId) {
                console.log('[DripTrigger] No linked contact found for lead. Skipping enrollment.');
                return;
            }

            // 1. Find matching campaigns
            const { data: campaigns, error } = await supabaseAdmin
                .from('drip_campaigns')
                .select('id, name, allow_reentry, trigger_value')
                .eq('user_id', userId)
                .eq('status', 'ACTIVE')
                .eq('trigger_type', 'pipeline_STAGE_CHANGED')
                .eq('trigger_value', newStageId);

            if (error) throw error;

            if (!campaigns || campaigns.length === 0) return;

            console.log(`[DripTrigger] Found ${campaigns.length} matching campaigns.`);

            // 2. Enroll
            for (const campaign of campaigns) {
                await this.enrollContact(userId, contactId, campaign);
            }

        } catch (err) {
            console.error('[DripTrigger] Error handling stage trigger:', err);
        }
    },

    /**
     * Core Enrollment Logic
     */
    async enrollContact(userId, contactId, campaign) {
        try {
            // Check existing enrollment
            const { data: existing } = await supabaseAdmin
                .from('drip_enrollments')
                .select('id, status')
                .eq('drip_campaign_id', campaign.id)
                .eq('contact_id', contactId)
                .neq('status', 'CANCELLED') // Considering active or completed?
                .neq('status', 'EXPIRED')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            // Logic:
            // If ACTIVE -> Don't enroll (already running)
            // If COMPLETED -> Check allow_reentry
            // If None -> Enroll

            if (existing) {
                if (existing.status === 'ACTIVE' || existing.status === 'PAUSED') {
                    console.log(`[DripTrigger] Contact ${contactId} already active in ${campaign.name}. Skipping.`);
                    return;
                }
                if (existing.status === 'COMPLETED' && !campaign.allow_reentry) {
                    console.log(`[DripTrigger] Contact ${contactId} already completed ${campaign.name} and re-entry disabled. Skipping.`);
                    return;
                }
            }

            // Fetch First Step
            const { data: firstStep } = await supabaseAdmin
                .from('drip_steps')
                .select('*')
                .eq('drip_campaign_id', campaign.id)
                .order('step_order', { ascending: true })
                .limit(1)
                .single();

            if (!firstStep) {
                console.warn(`[DripTrigger] Campaign ${campaign.name} has no steps. Cannot enroll.`);
                return;
            }

            // Calculate Start Time
            const now = new Date();
            const delayValue = firstStep.delay_value || 0;
            const delayUnit = firstStep.delay_unit || 'HOURS';
            const nextRun = this.calculateDelay(now, delayValue, delayUnit);

            // Create Enrollment
            const { error: insertError } = await supabaseAdmin
                .from('drip_enrollments')
                .insert({
                    drip_campaign_id: campaign.id,
                    contact_id: contactId,
                    current_step_id: firstStep.id,
                    status: 'ACTIVE',
                    started_at: now,
                    next_run_at: nextRun,
                    is_looping: false // Triggers typically don't force looping? Or should we read from campaign?
                    // Campaign table doesn't seem to have is_looping column based on context, 
                    // usually it's per enrollment or if campaign metadata has it. 
                    // Let's assume false for auto-triggers for now.
                });

            if (insertError) throw insertError;

            console.log(`[DripTrigger] Enrolled Contact ${contactId} in Campaign ${campaign.name} (Triggered).`);

        } catch (err) {
            console.error('[DripTrigger] Enrollment failed:', err);
        }
    },

    calculateDelay(startDate, value, unit) {
        const date = new Date(startDate);
        if (!value) return date;
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
};

module.exports = DripTriggerService;
