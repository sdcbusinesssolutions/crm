
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function restoreSpecificGroups() {
    console.log('--- RESTORE SPECIFIC GROUPS ---');

    // 1. Resolve Users
    const { data: { users }, error } = await supabase.auth.admin.listUsers();

    // Target: kd31967
    const u1 = users.find(u => u.email === 'kd31967@gmail.com');
    // Source: user1.compnet (Current holder)
    const u3 = users.find(u => u.email === 'user1.compnet@gmail.com');

    if (!u1 || !u3) { console.log('Users not found'); return; }

    const targetNames = ['tt', 'dd', 'abc', 'kkk'];
    console.log(`Looking for groups: ${targetNames.join(', ')} in User 3's account...`);

    // 2. Find Groups by Name owned by User 3
    const { data: groups, error: gError } = await supabase
        .from('contact_groups')
        .select('id, name')
        .eq('user_id', u3.id)
        .in('name', targetNames);

    if (gError) { console.error(gError); return; }

    if (groups.length === 0) {
        console.log('No matching groups found!');
        return;
    }

    console.log(`Found ${groups.length} groups to move:`);
    groups.forEach(g => console.log(`- ${g.name} [${g.id}]`));

    const groupIds = groups.map(g => g.id);

    // 3. Move Groups
    const { error: moveGError } = await supabase
        .from('contact_groups')
        .update({ user_id: u1.id })
        .in('id', groupIds);

    if (moveGError) { console.error('Error moving groups:', moveGError); return; }
    console.log('Groups moved to User 1.');

    // 4. Move Related Contacts
    // Contacts store groups in a JSONB array or similar 'group_ids' column.
    // We need to find contacts where group_ids INTERSECTS our list.
    // Supabase .contains() works for JSONB arrays. OR we might have to iterate if structure varies.
    // Let's assume group_ids is an array. We verify if it contains ANY of our IDs.
    // Postgres valid query: group_ids ?| array['id1','id2'] (overlap) matches.
    // Supabase filter: .overlaps('group_ids', groupIds)

    console.log('Finding related contacts...');

    // Check if contacts table uses JSONB or Text[] for group_ids.
    // Based on previous code: group_ids: groupIds || [] -> likely JSONB

    const { data: contacts, error: cError } = await supabase
        .from('contacts')
        .select('id, name')
        .eq('user_id', u3.id)
        .overlaps('group_ids', groupIds); // Checks if group_ids array has common elements

    if (cError) { console.error('Error finding contacts:', cError); return; }

    console.log(`Found ${contacts.length} related contacts.`);

    if (contacts.length > 0) {
        const contactIds = contacts.map(c => c.id);

        // Batch update might be large, but acceptable for < 10k
        const { error: moveCError } = await supabase
            .from('contacts')
            .update({ user_id: u1.id })
            .in('id', contactIds);

        if (moveCError) console.error('Error moving contacts:', moveCError);
        else console.log('Contacts moved to User 1.');
    }

    console.log('--- RESTORE COMPLETE ---');
}

restoreSpecificGroups();
