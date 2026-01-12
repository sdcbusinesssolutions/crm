
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function restoreMembers() {
    console.log('--- RESTORE GROUP MEMBERS FROM CAMPAIGN HISTORY ---');

    // 1. Get IDs for specific groups
    const { data: groups, error: gError } = await supabase
        .from('contact_groups')
        .select('*')
        .in('name', ['pop', 'kr', 'lll89', 'po']);

    if (gError || !groups) {
        console.error('Error fetching groups:', gError);
        return;
    }

    console.log(`Found ${groups.length} groups.`);

    for (const group of groups) {
        console.log(`\nProcessing Group: ${group.name} (${group.id})`);

        // 2. Find Campaigns for this Group
        // We assume campaigns table has a column 'group_id' or we search config?
        // Let's try to select campaigns where contact_group_id matches.
        // Or inspect the table structure via a debug select if unsure.
        // Assuming 'group_id' exists based on typical schema, but let's check recent campaigns first.

        const { data: campaigns, error: campError } = await supabase
            .from('campaigns')
            .select('id, title, created_at')
            .eq('group_id', group.id) // Assuming column name is group_id or contact_group_id
            .order('created_at', { ascending: false })
            .limit(5);

        // Fallback if column name differs (e.g. metadata store)
        // But let's assume it works or we catch error.

        if (campError) {
            console.log(`Error finding campaigns for group ${group.name} (maybe column differs):`, campError.message);
            // Try fetching all recent campaigns and checking manual inspection if needed? 
            // Or maybe the user didn't send a campaign yet?
            continue;
        }

        if (!campaigns || campaigns.length === 0) {
            console.log(`No campaigns found for group ${group.name}. Cannot recover members.`);
            continue;
        }

        console.log(`Found ${campaigns.length} campaigns. Using latest: ${campaigns[0].title}`);
        const campaignId = campaigns[0].id;

        // 3. Get Recipients from Campaign Queue
        const { data: queueItems, error: qError } = await supabase
            .from('campaign_queue')
            .select('phone_number')
            .eq('campaign_id', campaignId);

        if (qError) {
            console.error('Error fetching queue:', qError);
            continue;
        }

        const phones = [...new Set(queueItems.map(q => q.phone_number.replace(/\D/g, '')))]; // Normalize
        console.log(`Recovered ${phones.length} unique phone numbers from campaign history.`);

        if (phones.length === 0) continue;

        // 4. Update Contacts
        // We need to fetch these contacts and APPEND the group ID if missing, or SET it.
        // Actually, safer to APPEND.

        // Fetch contacts by phone
        const { data: contacts, error: cError } = await supabase
            .from('contacts')
            .select('id, phone, group_ids')
            .in('phone', phones) // Note: phones must be exact match in DB.
        // If DB phones have '+', ensure our queue phones have it? 
        // Usually queue phones have '+' if E.164.
        // Let's assume queue items are correct.

        // Queue items usually have '+' because they come from validContacts which were normalized.
        const validPhones = queueItems.map(q => q.phone_number);

        const { data: dbContacts, error: dbError } = await supabase
            .from('contacts')
            .select('id, group_ids, phone')
            .in('phone', validPhones);

        if (dbError) {
            console.error('Error fetching contacts to update:', dbError);
            continue;
        }

        console.log(`Found ${dbContacts.length} matching contact records.`);

        for (const contact of dbContacts) {
            const currentGroups = contact.group_ids || [];
            if (!currentGroups.includes(group.id)) {
                const newGroups = [...currentGroups, group.id];
                console.log(`Restoring ${contact.phone} to ${group.name}...`);

                await supabase
                    .from('contacts')
                    .update({ group_ids: newGroups })
                    .eq('id', contact.id);
            } else {
                // console.log(`${contact.phone} already in group.`);
            }
        }
    }
    console.log('\n--- RESTORE COMPLETE ---');
}

restoreMembers();
