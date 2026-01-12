
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkGroups() {
    console.log('--- DEBUG GROUP COUNTS ---');

    // 1. Get IDs for specific groups
    const { data: groups, error: gError } = await supabase
        .from('contact_groups')
        .select('*')
        .in('name', ['pop', 'kr', 'lll89', 'po']); // Added 'po' from previous context just in case

    if (gError) {
        console.error('Error fetching groups:', gError);
        return;
    }

    if (!groups || groups.length === 0) {
        console.log('No groups found with these names.');
        return;
    }

    console.log(`Found ${groups.length} groups.`);
    const groupIds = groups.map(g => g.id);

    // 2. Fetch ALL contacts for the user(s) of these groups
    // Assuming all groups belong to the same user for simplicity, or we filter by user if mixed.
    // Let's just fetch all contacts that have ANY overlap with these group IDs.

    const { data: contacts, error: cError } = await supabase
        .from('contacts')
        .select('id, phone, name, group_ids, user_id');

    if (cError) {
        console.error('Error fetching contacts:', cError);
        return;
    }

    console.log(`Total Contacts Scanned: ${contacts.length}`);

    // 3. Manual Count
    for (const group of groups) {
        const members = contacts.filter(c => c.group_ids && c.group_ids.includes(group.id));
        console.log(`Group: ${group.name} (${group.id})`);
        console.log(`   - Count DB: ${members.length}`);
        if (members.length > 0) {
            console.log(`   - Members: ${members.map(m => `${m.name} (${m.phone})`).join(', ')}`);
        } else {
            console.log(`   - Members: NONE`);
        }
        console.log('---');
    }
}

checkGroups();
