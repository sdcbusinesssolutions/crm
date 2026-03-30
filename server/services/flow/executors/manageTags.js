const { supabase, supabaseAdmin } = require('../../../lib/supabaseClient');

module.exports = {
    execute: async (session, node, context) => {
        try {
            const { action = 'add', tags } = node.data;
            const phone = typeof session.contact_phone === 'string' ? session.contact_phone : String(session.contact_phone || '');
            const userId = session.user_id;

            if (!phone) {
                console.error('[ManageTags] No phone number in session');
                return { success: false, message: 'No phone number' };
            }

            const rpcClient = supabaseAdmin || supabase;

            if (!Array.isArray(tags) || tags.length === 0) {
                return { success: true, message: 'No tags to process or invalid format' };
            }

            console.log(`[ManageTags] Processing tags for User ${userId}, Phone ${phone}: ${action} [${tags.join(', ')}]`);

            // 1. Get ALL matching contacts for this user (handle potential duplicates)
            // We use .select() instead of .maybeSingle() to avoid crashing if duplicates exist (PGRST116)
            const { data: contacts, error: fetchError } = await rpcClient
                .from('contacts')
                .select('*')
                .eq('user_id', userId)
                .eq('phone', phone);

            if (fetchError) {
                console.error('[ManageTags] Error fetching contacts:', fetchError);
                throw fetchError;
            }

            let activeContacts = [...(contacts || [])];
            let finalTags = [];

            // 2. If NO contact exists, create it (only if adding tags)
            if (activeContacts.length === 0) {
                if (action === 'remove') {
                    return { success: true, message: 'Contact not found, nothing to remove' };
                }

                console.log('[ManageTags] Contact not found, creating new contact for current user...');

                const { data: newContact, error: createError } = await rpcClient
                    .from('contacts')
                    .insert([{
                        user_id: userId,
                        phone: phone,
                        name: session.variables?.trigger?.name || phone, // Fallback to phone if name is missing
                        tags: tags,
                        status: 'New',
                        source: 'flow_automation'
                    }])
                    .select()
                    .single();

                if (createError) {
                    console.error('[ManageTags] Error creating contact:', createError);
                    throw createError;
                }
                console.log('[ManageTags] Created contact with IDs:', newContact.id);
                activeContacts = [newContact];
                finalTags = newContact.tags || [];
            } else {
                // 3. Update ALL found contacts (in case of duplicates)
                for (const contact of activeContacts) {
                    let currentTags = contact.tags || [];
                    let newTags = [...currentTags];

                    if (action === 'add') {
                        tags.forEach(t => {
                            if (!newTags.includes(t)) newTags.push(t);
                        });
                    } else if (action === 'remove') {
                        newTags = newTags.filter(t => !tags.includes(t));
                    }

                    if (JSON.stringify(currentTags.sort()) === JSON.stringify(newTags.sort())) {
                        finalTags = newTags;
                        continue;
                    }

                    const { data: updatedContact, error: updateError } = await rpcClient
                        .from('contacts')
                        .update({ tags: newTags })
                        .eq('id', contact.id)
                        .select()
                        .single();

                    if (updateError) {
                        console.error(`[ManageTags] Failed to update contact ${contact.id}:`, updateError);
                    } else {
                        console.log(`[ManageTags] Updated contact ${contact.id} tags:`, newTags);
                        finalTags = newTags;
                    }
                }
            }

            // 4. Trigger Drip Campaigns (TAG_ADDED / TAG_REMOVED)
            // Use the first active contact as the trigger source
            const triggerContact = activeContacts[0];
            if (triggerContact && triggerContact.id) {
                const DripTriggerService = require('../../DripTriggerService');
                
                if (action === 'add' && tags.length > 0) {
                    console.log(`[ManageTags] Triggering TAG_ADDED for contact ${triggerContact.id}`);
                    DripTriggerService.handleTagAdded(userId, triggerContact, tags).catch(e => console.error('[ManageTags] Drip Trigger Error:', e));
                } else if (action === 'remove' && tags.length > 0) {
                    console.log(`[ManageTags] Triggering TAG_REMOVED for contact ${triggerContact.id}`);
                    DripTriggerService.handleTagRemoved(userId, triggerContact, tags).catch(e => console.error('[ManageTags] Drip Removal Error:', e));
                }
            }

            return { success: true, tags: finalTags };

        } catch (error) {
            console.error('[ManageTags] Execution Error:', error);
            return { success: false, error: error.message };
        }
    }
};
