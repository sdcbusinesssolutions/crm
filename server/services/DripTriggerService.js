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
            let { data: campaigns, error } = await supabaseAdmin
                .from('drip_campaigns')
                .select('id, name, allow_reentry, trigger_value')
                .eq('user_id', userId)
                .eq('status', 'ACTIVE') // Only active campaigns
                .eq('trigger_type', 'TAG_ADDED')
                .in('trigger_value', addedTags);

            if (error) throw error;

            if (!campaigns || campaigns.length === 0) {
                // FALLBACK: If exact match fails, try case-insensitive check 
                // Postgres .in() is case sensitive. We fetch all active TAG_ADDED campaigns for user 
                // and filter in memory for maximum reliability.
                const { data: allActive, error: fetchErr } = await supabaseAdmin
                    .from('drip_campaigns')
                    .select('id, name, allow_reentry, trigger_value')
                    .eq('user_id', userId)
                    .eq('status', 'ACTIVE')
                    .eq('trigger_type', 'TAG_ADDED');
                
                if (fetchErr) throw fetchErr;

                const lowerAddedTags = addedTags.map(t => t.toLowerCase().trim());
                const matchingCampaigns = (allActive || []).filter(camp => {
                    if (!camp.trigger_value) return false;
                    return lowerAddedTags.includes(camp.trigger_value.toLowerCase().trim());
                });

                if (matchingCampaigns.length === 0) {
                    // console.log('[DripTrigger] No matching campaigns after lower-case check.');
                    return;
                }
                campaigns = matchingCampaigns;
            }

            console.log(`[DripTrigger] Found ${campaigns.length} matching campaigns.`);

            // 2. Enroll Contact in each campaign
            for (const campaign of campaigns) {
                await DripTriggerService.enrollContact(userId, contact.id, campaign, contact);
            }

        } catch (err) {
            console.error('[DripTrigger] Error handling tag trigger:', err);
        }
    },

    /**
     * Handle 'TAG_REMOVED' trigger - STOP campaigns if tag is removed
     * @param {string} userId - The owner's ID
     * @param {object} contact - The contact object
     * @param {string[]} removedTags - Array of tags that were removed
     */
    async handleTagRemoved(userId, contact, removedTags) {
        if (!removedTags || removedTags.length === 0) return;

        console.log(`[DripTrigger] Checking TAG_REMOVED for ${contact.id}. Tags: ${removedTags.join(', ')}`);

        try {
            // Find all ACTIVE enrollments for this contact + user
            // Where the campaign trigger_type is 'TAG_ADDED' 
            // AND the trigger_value is one of the removed tags
            const { data: enrollments, error } = await supabaseAdmin
                .from('drip_enrollments')
                .select(`
                    id,
                    drip_campaigns!inner(id, name, trigger_type, trigger_value)
                `)
                .eq('contact_id', contact.id)
                .eq('status', 'ACTIVE')
                .eq('drip_campaigns.user_id', userId)
                .eq('drip_campaigns.trigger_type', 'TAG_ADDED')
                .in('drip_campaigns.trigger_value', removedTags);

            if (error) throw error;
            if (!enrollments || enrollments.length === 0) return;

            const idsToCancel = enrollments.map(e => e.id);
            const { error: cancelError } = await supabaseAdmin
                .from('drip_enrollments')
                .update({ 
                    status: 'CANCELLED', 
                    completed_at: new Date() 
                })
                .in('id', idsToCancel);

            if (cancelError) throw cancelError;

            enrollments.forEach(e => {
                console.log(`[DripTrigger] Cancelled campaign '${e.drip_campaigns.name}' for ${contact.id} (Tag Removed).`);
            });

        } catch (err) {
            console.error('[DripTrigger] Error handling tag removal:', err);
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
                await DripTriggerService.enrollContact(userId, contactId, campaign);
            }

        } catch (err) {
            console.error('[DripTrigger] Error handling stage trigger:', err);
        }
    },

    /**
     * Core Enrollment Logic
     */
    async enrollContact(userId, contactId, campaign, contactObj = null) {
        try {
            // 1. Resolve Contact Phone for robust global deduplication
            // This prevents duplicate enrollments if the same phone exists in multiple contact records
            let targetPhone = contactObj?.phone;
            if (!targetPhone) {
                const { data: contact } = await supabaseAdmin
                    .from('contacts')
                    .select('phone')
                    .eq('id', contactId)
                    .maybeSingle();
                targetPhone = contact?.phone;
            }

            // 2. Check existing enrollment (by ID AND Phone)
            // We join with contacts to find ANY enrollment for this campaign that matches this phone
            const { data: existingById } = await supabaseAdmin
                .from('drip_enrollments')
                .select('id, status')
                .eq('drip_campaign_id', campaign.id)
                .eq('contact_id', contactId)
                .neq('status', 'CANCELLED')
                .neq('status', 'EXPIRED')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            let existing = existingById;

            // If no enrollment found by ID, check by Phone for other contact records
            if (!existing && targetPhone) {
                const { data: existingByPhone } = await supabaseAdmin
                    .from('drip_enrollments')
                    .select('id, status, contacts!inner(phone)')
                    .eq('drip_campaign_id', campaign.id)
                    .eq('contacts.phone', targetPhone)
                    .neq('status', 'CANCELLED')
                    .neq('status', 'EXPIRED')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                
                if (existingByPhone) {
                    existing = { id: existingByPhone.id, status: existingByPhone.status };
                }
            }

            // Logic:
            // If ACTIVE/PROCESSING -> Don't enroll (already running)
            // If COMPLETED -> Check allow_reentry
            // If None -> Enroll

            if (existing) {
                // 1. If currently Active/Paused/Processing -> Never re-enroll (duplication guard)
                if (['ACTIVE', 'PAUSED', 'PROCESSING'].includes(existing.status)) {
                    console.log(`[DripTrigger] Contact ${contactId} (Phone: ${targetPhone}) already in progress for ${campaign.name}. Skipping.`);
                    return;
                }

                // 2. If finished/stopped -> Check Re-entry policy
                // If allow_reentry is FALSE, we block even if they were completed/cancelled before.
                if (!campaign.allow_reentry) {
                    console.log(`[DripTrigger] Contact ${contactId} (Phone: ${targetPhone}) previously enrolled in ${campaign.name} and re-entry is disabled. Skipping.`);
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
            const nextRun = DripTriggerService.calculateDelay(now, delayValue, delayUnit);

            // Create Enrollment
            const enrollmentPayload = {
                drip_campaign_id: campaign.id,
                contact_id: contactId,
                current_step_id: firstStep.id,
                status: 'ACTIVE',
                started_at: now,
                next_run_at: nextRun,
                is_looping: false
            };

            const { error: insertError } = await supabaseAdmin
                .from('drip_enrollments')
                .insert(enrollmentPayload);

            if (insertError) {
                // If it fails because of missing columns unexpectedly, we log it
                console.error('[DripTrigger] Insert failed. Error:', insertError.message);
                throw insertError;
            }

            // --- INCREMENT ENROLLMENT COUNT ---
            try {
            const { data, error } = await supabaseAdmin.rpc('increment_campaign_enrollment', { camp_id: campaign.id });
            if (error) {
                // Fallback to direct update if RPC fails
                const { data: campaignData } = await supabaseAdmin.from('drip_campaigns').select('enrollment_count').eq('id', campaign.id).single();
                await supabaseAdmin.from('drip_campaigns').update({ enrollment_count: (campaignData?.enrollment_count || 0) + 1 }).eq('id', campaign.id);
            }
        } catch (e) { console.error('Enrollment count update failed:', e); }

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
    },

    /**
     * Stop campaigns if user replies (if stop_on_reply is enabled)
     */
    async handleReply(userId, contactPhone) {
        try {
            // Find all active enrollments for this contact where campaign has stop_on_reply=true
            // We join with drip_campaigns to check the flag
            const { data: toStop, error } = await supabaseAdmin
                .from('drip_enrollments')
                .select(`
                    id,
                    drip_campaign:drip_campaigns(id, name, stop_on_reply)
                `)
                .eq('contact_phone_cached', contactPhone) // Using a cached phone or we'd need a join with contacts
                .eq('status', 'ACTIVE'); // Only stop active ones

            // Note: If contact_phone_cached doesn't exist, we might need to join contacts.
            // Let's assume we can find them by contact_id through a subquery or join.
            // Revised approach for safety:
            const { data: enrollments, error: err } = await supabaseAdmin
                .from('drip_enrollments')
                .select('id, drip_campaign_id, drip_campaigns!inner(stop_on_reply, name), contacts!inner(phone)')
                .eq('contacts.phone', contactPhone)
                .eq('contacts.user_id', userId)
                .eq('status', 'ACTIVE')
                .eq('drip_campaigns.stop_on_reply', true);

            if (err) throw err;
            if (!enrollments || enrollments.length === 0) return;

            const idsToStop = enrollments.map(e => e.id);
            await supabaseAdmin
                .from('drip_enrollments')
                .update({ 
                    status: 'STOPPED_BY_REPLY', 
                    completed_at: new Date() 
                })
                .in('id', idsToStop);

            enrollments.forEach(e => {
                console.log(`[DripTrigger] Stopped campaign '${e.drip_campaigns.name}' for ${contactPhone} due to reply.`);
            });

        } catch (e) {
            console.error('[DripTrigger] Error in handleReply:', e.message);
        }
    },

    /**
     * Finds contacts who have the tag but aren't enrolled and enrolls them.
     */
    async syncCampaignEnrollments(userId, campaignId) {
        console.log(`[DripTrigger] Starting ROBUST SYNC for Campaign ${campaignId} (User: ${userId})...`);
        try {
            // 1. Get Campaign Details
            const { data: campaign, error: campError } = await supabaseAdmin
                .from('drip_campaigns')
                .select('*')
                .eq('id', campaignId)
                .eq('user_id', userId)
                .single();

            if (campError || !campaign || campaign.trigger_type !== 'TAG_ADDED') {
                throw new Error('Sync only available for Tag-based campaigns');
            }

            const triggerValue = (campaign.trigger_value || '').trim().toLowerCase();
            if (!triggerValue) throw new Error('Campaign has no trigger tag defined.');

            // 2. Fetch ALL contacts for this user (Robust Chunk-based Fetching)
            let allContacts = [];
            let page = 0;
            const size = 1000;
            let hasMore = true;

            while (hasMore) {
                const from = page * size;
                const to = from + size - 1;
                const { data: chunk, error: chunkErr } = await supabaseAdmin
                    .from('contacts')
                    .select('id, tags, name, phone')
                    .eq('user_id', userId)
                    .range(from, to);
                
                if (chunkErr) throw chunkErr;
                if (!chunk || chunk.length === 0) {
                    hasMore = false;
                } else {
                    allContacts = allContacts.concat(chunk);
                    if (chunk.length < size) hasMore = false;
                    else page++;
                }
                // Safety break for extreme data sizes
                if (allContacts.length > 100000) break;
            }

            console.log(`[DripTrigger] Scanned ${allContacts.length} contacts for matching tags.`);

            // 3. Find contacts with matching tag (case-insensitive + trim)
            const matchingContactsRaw = allContacts.filter(c => {
                const contactTags = Array.isArray(c.tags) ? c.tags : [];
                return contactTags.some(t => {
                    if (typeof t !== 'string') return false;
                    return t.trim().toLowerCase() === triggerValue;
                });
            });

            // 4. DEDUPLICATE BY PHONE (Global deduplication to prevent double spending/messaging)
            const uniqueMatchingContacts = [];
            const seenPhones = new Set();
            
            // First, prioritize contacts that are already enrolled to ensure we don't double-enroll them
            const { data: alreadyEnrolled } = await supabaseAdmin
                .from('drip_enrollments')
                .select('id, contact_id, contacts(phone)')
                .eq('drip_campaign_id', campaignId);
            
            (alreadyEnrolled || []).forEach(e => {
                const phone = e.contacts?.phone?.trim();
                if (phone) seenPhones.add(phone);
            });

            for (const c of matchingContactsRaw) {
                const phone = (c.phone || '').trim();
                if (phone) {
                    if (!seenPhones.has(phone)) {
                        seenPhones.add(phone);
                        uniqueMatchingContacts.push(c);
                    }
                } else {
                    // Fallback to ID uniqueness if no phone exists
                    uniqueMatchingContacts.push(c);
                }
            }

            console.log(`[DripTrigger] Found ${uniqueMatchingContacts.length} total contacts with tag '${triggerValue}'.`);
            if (uniqueMatchingContacts.length === 0) return { count: 0 };

            // 5. Get items ALREADY enrolled (Join with contacts to check phones)
            const { data: existing, error: enrError } = await supabaseAdmin
                .from('drip_enrollments')
                .select(`
                    contact_id, 
                    contacts:contact_id(phone)
                `)
                .eq('drip_campaign_id', campaignId);

            if (enrError) throw enrError;

            const enrolledIds = new Set();
            const enrolledPhones = new Set();
            (existing || []).forEach(e => {
                enrolledIds.add(e.contact_id);
                if (e.contacts?.phone) enrolledPhones.add(e.contacts.phone.trim());
            });

            const newContactsToEnroll = uniqueMatchingContacts.filter(c => {
                const isIdIn = enrolledIds.has(c.id);
                const isPhoneIn = c.phone && enrolledPhones.has(c.phone.trim());
                return !isIdIn && !isPhoneIn;
            });

            console.log(`[DripTrigger] ${newContactsToEnroll.length} are new. Starting enrollment...`);
            if (newContactsToEnroll.length === 0) return { count: 0 };

            // 6. Enroll them
            let count = 0;
            for (const contact of newContactsToEnroll) {
                try {
                    await this.enrollContact(userId, contact.id, campaign, contact);
                    count++;
                } catch (e) { 
                    console.error(`[DripTrigger] Sync failed for contact ${contact.id}:`, e.message); 
                }
            }

            return { count };
        } catch (err) {
            console.error('[DripTrigger] Robust sync failed:', err);
            throw err;
        }
    }
};

module.exports = DripTriggerService;
