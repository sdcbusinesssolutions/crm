
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function restoreUser3() {
    console.log('--- RESTORING USER 3 DATA ---');

    console.log('Fetching users...');
    const { data: { users }, error } = await supabase.auth.admin.listUsers();

    // The 3 protagonists
    const u1 = users.find(u => u.email === 'kd31967@gmail.com');
    const u2 = users.find(u => u.email === 'onlinemarketing1007@gmail.com');
    const u3 = users.find(u => u.email === 'user1.compnet@gmail.com');

    if (!u1 || !u2 || !u3) {
        console.log('Error: Could not find one of the users.');
        console.log(`U1: ${u1?.id}`);
        console.log(`U2: ${u2?.id}`);
        console.log(`U3: ${u3?.id}`);
        return;
    }

    console.log(`User 3 (Original Owner): ${u3.id}`);

    // We want to move data FROM User 1 (where I dumped it) TO User 3.
    // We should also check User 2 just in case.

    await moveData(u1.id, u3.id, 'User 1 -> User 3');
    await moveData(u2.id, u3.id, 'User 2 -> User 3'); // Safety sweep

    console.log('--- RESTORE COMPLETE ---');
}

async function moveData(fromId, toId, label) {
    console.log(`Processing: ${label}`);

    // Contacts
    const { count } = await supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('user_id', fromId);
    if (count > 0) {
        console.log(`Moving ${count} contacts...`);
        await supabase.from('contacts').update({ user_id: toId }).eq('user_id', fromId);
    } else {
        console.log('No contacts to move.');
    }

    // Leads
    await supabase.from('leads').update({ user_id: toId }).eq('user_id', fromId);

    // Groups
    await supabase.from('contact_groups').update({ user_id: toId }).eq('user_id', fromId);

    // Tasks
    await supabase.from('tasks').update({ user_id: toId }).eq('user_id', fromId);
}

restoreUser3();
