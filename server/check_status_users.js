
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkStatus() {
    console.log('--- CHECK STATUS ---');
    const { data: { users }, error } = await supabase.auth.admin.listUsers();

    const u1 = users.find(u => u.email === 'kd31967@gmail.com');
    const u2 = users.find(u => u.email === 'onlinemarketing1007@gmail.com');

    console.log(`User 1 (kd...): ${u1?.id}`);
    console.log(`User 2 (on...): ${u2?.id}`);

    if (u1) {
        const { count } = await supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('user_id', u1.id);
        console.log(`Contacts for User 1: ${count}`);

        const { count: gCount } = await supabase.from('contact_groups').select('*', { count: 'exact', head: true }).eq('user_id', u1.id);
        console.log(`Groups for User 1: ${gCount}`);
    }

    if (u2) {
        const { count } = await supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('user_id', u2.id);
        console.log(`Contacts for User 2: ${count}`);

        const { count: gCount } = await supabase.from('contact_groups').select('*', { count: 'exact', head: true }).eq('user_id', u2.id);
        console.log(`Groups for User 2: ${gCount}`);
    }
}

checkStatus();
