
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkLeads() {
    console.log('--- CHECK LEADS STATUS ---');
    const { data: { users }, error } = await supabase.auth.admin.listUsers();

    // U1 = kd31967
    const u1 = users.find(u => u.email === 'kd31967@gmail.com');

    if (!u1) { console.log('User 1 not found'); return; }

    const { count } = await supabase.from('leads').select('*', { count: 'exact', head: true }).eq('user_id', u1.id);
    console.log(`Leads for User 1: ${count}`);

    // Check if there are leads pointing to contacts that ARE owned by U1 now
    // If contacts were moved, leads might have been missed if I didn't move them in specific script
    // restore_specific_groups moved: Groups and Contacts.
    // It did NOT move leads.
}

checkLeads();
