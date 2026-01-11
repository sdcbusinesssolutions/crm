
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkGroupIds() {
    console.log('--- CHECK GROUP IDS ---');
    // Get User 2 ID
    const { data: { users } } = await supabase.auth.admin.listUsers();
    const u2 = users.find(u => u.email === 'onlinemarketing1007@gmail.com');

    if (!u2) {
        console.log('User 2 not found');
        return;
    }

    // Get 5 contacts
    const { data: contacts } = await supabase
        .from('contacts')
        .select('id, name, group_ids')
        .eq('user_id', u2.id)
        .limit(5);

    console.log('Sample Contacts for User 2:');
    console.log(JSON.stringify(contacts, null, 2));

    // Get Groups
    const { data: groups } = await supabase
        .from('contact_groups')
        .select('id, name')
        .eq('user_id', u2.id);

    console.log('Groups for User 2:');
    console.log(JSON.stringify(groups, null, 2));
}

checkGroupIds();
