
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function inspectUser1Groups() {
    console.log('--- INSPECT USER 1 GROUPS ---');

    console.log('Fetching users...');
    const { data: { users }, error } = await supabase.auth.admin.listUsers();

    // U1 = kd31967@gmail.com
    const u1 = users.find(u => u.email === 'kd31967@gmail.com');
    if (!u1) { console.log('User 1 not found'); return; }

    const { data: groups, error: gError } = await supabase
        .from('contact_groups')
        .select('name, created_at, id')
        .eq('user_id', u1.id)
        .order('created_at', { ascending: false });

    if (gError) { console.error(gError); return; }

    console.log(`Found ${groups.length} groups for User 1:`);
    groups.forEach(g => {
        console.log(`[${g.created_at}] ${g.name}`);
    });
}

inspectUser1Groups();
