
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function manualRestore() {
    console.log('--- MANUAL RESTORE ---');

    // 1. Get Group "pop" or "po"
    const { data: groups } = await supabase.from('contact_groups').select('id, name').in('name', ['pop', 'po', 'kr', 'lll89']);
    console.log('Groups found:', groups.map(g => `${g.name} (${g.id})`));

    // 2. Identify Target Contacts (from previous known context)
    const phones = ['918408907516', '910000000000', '+918408907516', '+910000000000'];

    // 3. Find these contacts
    const { data: contacts } = await supabase.from('contacts').select('id, phone, name, group_ids').or(`phone.in.(${phones.map(p => `"${p}"`).join(',')})`);

    console.log(`Found ${contacts?.length} contacts.`);

    // 4. Restore 'pop'/'po'
    const popGroup = groups.find(g => g.name === 'pop' || g.name === 'po');

    if (popGroup && contacts && contacts.length > 0) {
        console.log(`Restoring contacts to group: ${popGroup.name}`);

        for (const c of contacts) {
            const current = c.group_ids || [];
            if (!current.includes(popGroup.id)) {
                const newG = [...current, popGroup.id];
                console.log(`Adding ${c.phone} to ${popGroup.name}`);
                await supabase.from('contacts').update({ group_ids: newG }).eq('id', c.id);
            } else {
                console.log(`${c.phone} already in ${popGroup.name}`);
            }
        }
    }

    // 5. General Restore for empty groups based on Campaign Title matching?
    // Let's iterate all empty groups.
    for (const g of groups) {
        if (g.name === 'pop' || g.name === 'po') continue; // handled

        // Search for campaign with title == group name
        const { data: camps } = await supabase.from('campaigns').select('id').eq('title', g.name).limit(1);
        if (camps && camps.length > 0) {
            console.log(`Found Campaign matching group ${g.name}. Restoring recipients...`);
            const { data: q } = await supabase.from('campaign_queue').select('phone_number').eq('campaign_id', camps[0].id);

            if (q) {
                const qPhones = q.map(i => i.phone_number.replace(/\D/g, ''));
                // Update contacts
                // (Simplified logic: fetch contacts in phones, append g.id)
                // Due to complexity, just logging feasibility.
                console.log(`Would restore ${qPhones.length} contacts to ${g.name}`);
            }
        }
    }

    console.log('--- DONE ---');
}

manualRestore();
