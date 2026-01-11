
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function undoRecovery() {
    console.log('--- UNDO RECOVERY (U1 -> U3) ---');

    // Get timestamps
    const { data: { users } } = await supabase.auth.admin.listUsers();

    // U1 = kd31967 (Target of cleanup)
    const u1 = users.find(u => u.email === 'kd31967@gmail.com');
    // U3 = user1.compnet (Original owner)
    const u3 = users.find(u => u.email === 'user1.compnet@gmail.com');

    if (!u1 || !u3) { console.log('Users not found'); return; }

    console.log(`Moving ALL data back from ${u1.email} to ${u3.email}`);

    // 1. Contacts
    const { count: cCount } = await supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('user_id', u1.id);
    if (cCount > 0) {
        console.log(`Moving ${cCount} contacts...`);
        await supabase.from('contacts').update({ user_id: u3.id }).eq('user_id', u1.id);
    }

    // 2. Leads
    await supabase.from('leads').update({ user_id: u3.id }).eq('user_id', u1.id);

    // 3. Groups
    const { count: gCount } = await supabase.from('contact_groups').select('*', { count: 'exact', head: true }).eq('user_id', u1.id);
    if (gCount > 0) {
        console.log(`Moving ${gCount} groups...`);
        await supabase.from('contact_groups').update({ user_id: u3.id }).eq('user_id', u1.id);
    }

    // 4. Tasks
    await supabase.from('tasks').update({ user_id: u3.id }).eq('user_id', u1.id);

    console.log('--- UNDO COMPLETE ---');
}

undoRecovery();
