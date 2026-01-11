
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function debugIsolation() {
    console.log('--- DEBUG ISOLATION ---');

    // 1. Get User IDs
    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    if (error) { console.error(error); return; }

    const u1 = users.find(u => u.email === 'kd31967@gmail.com');
    const u2 = users.find(u => u.email === 'onlinemarketing1007@gmail.com');

    console.log(`User 1 (kd31967): ${u1 ? u1.id : 'NOT FOUND'}`);
    console.log(`User 2 (online...): ${u2 ? u2.id : 'NOT FOUND'}`);

    if (!u1 || !u2) return;

    // 2. Count contacts for each
    const { count: c1 } = await supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('user_id', u1.id);
    const { count: c2 } = await supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('user_id', u2.id);

    console.log(`Contacts showing for User 1: ${c1}`);
    console.log(`Contacts showing for User 2: ${c2}`);

    // 3. Inspect specific 'leaked' contacts
    // Names from screenshot: 'wprashant89', 'baludabhade12', 'MyCoder'
    const names = ['wprashant89', 'baludabhade12', 'MyCoder'];
    const { data: leaked } = await supabase.from('contacts').select('name, user_id').in('name', names);

    console.log('--- INSPECTING SPECIFIC CONTACTS ---');
    (leaked || []).forEach(c => {
        let owner = 'UNKNOWN';
        if (c.user_id === u1.id) owner = 'User 1 (kd31967)';
        if (c.user_id === u2.id) owner = 'User 2 (online...)';
        console.log(`Contact '${c.name}' is owned by: ${owner} (${c.user_id})`);
    });
}

debugIsolation();
