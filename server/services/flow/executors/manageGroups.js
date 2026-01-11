const { supabase, supabaseAdmin } = require('../../../lib/supabaseClient');

const execute = async (session, node, context) => {
    try {
        const { action = 'add', groups } = node.data;
        const phone = session.contact_phone;
        const userId = session.user_id;

        if (!Array.isArray(groups) || groups.length === 0) {
            return { success: true, message: 'No groups to process or invalid format' };
        }

        console.log(`[ManageGroups] Processing groups for User ${userId}, Phone ${phone}: ${action} [${groups.join(', ')}]`);

        const rpcClient = supabaseAdmin || supabase;

        // 1. Get ALL matching contacts for this user (handle potential duplicates)
        const { data: contacts, error: fetchError } = await rpcClient
            .from('contacts')
            .select('*')
            .eq('user_id', userId)
            .eq('phone', phone);

        if (fetchError) {
            console.error('[ManageGroups] Error fetching contacts:', fetchError);
            throw fetchError;
        }

        // 2. If NO contact exists, create it (only if adding groups)
        if (!contacts || contacts.length === 0) {
            if (action === 'remove') {
                return { success: true, message: 'Contact not found, nothing to remove' };
            }

            console.log('[ManageGroups] Contact not found, creating new contact for current user...');

            const { data: newContact, error: createError } = await rpcClient
                .from('contacts')
                .insert([{
                    user_id: userId,
                    phone: phone,
                    name: session.variables?.trigger?.name || phone, // Fallback to phone if name is missing
                    group_ids: groups,
                    status: 'New',
                    source: 'flow_automation'
                }])
                .select()
                .single();

            if (createError) {
                console.error('[ManageGroups] Error creating contact:', createError);
                throw createError;
            }
            console.log('[ManageGroups] Created contact with groups:', newContact.group_ids);
            return { success: true, groups: newContact.group_ids };
        }

        // 3. Update ALL found contacts (in case of duplicates)
        let finalGroups = [];
        let atLeastOneUpdated = false;

        for (const contact of contacts) {
            let currentGroups = contact.group_ids || [];
            let newGroups = [...currentGroups];

            if (action === 'add') {
                // Add unique groups
                groups.forEach(g => {
                    if (!newGroups.includes(g)) newGroups.push(g);
                });
            } else if (action === 'remove') {
                // Remove groups
                newGroups = newGroups.filter(g => !groups.includes(g));
            }

            // Don't update if nothing changed
            if (JSON.stringify(currentGroups.sort()) === JSON.stringify(newGroups.sort())) {
                finalGroups = newGroups; // Capture current state even if no change
                continue;
            }

            // Update this specific contact record
            const { data: updatedContact, error: updateError } = await rpcClient
                .from('contacts')
                .update({ group_ids: newGroups })
                .eq('id', contact.id)
                .select()
                .single();

            if (updateError) {
                console.error(`[ManageGroups] Failed to update contact ${contact.id}:`, updateError);
            } else {
                console.log(`[ManageGroups] Updated contact ${contact.id} groups:`, newGroups);
                finalGroups = newGroups; // Keep track of latest state for return
                atLeastOneUpdated = true;
            }
        }

        return { success: true, groups: finalGroups };

    } catch (error) {
        console.error('[ManageGroups] Execution failed:', error);
        return { success: false, error: error.message };
    }
};

module.exports = { execute };
