
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function inspectDates() {
    console.log('--- INSPECT DATES ---');

    // 1. Get Users and their creation dates
    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    const u1 = users.find(u => u.email === 'kd31967@gmail.com');
    const u2 = users.find(u => u.email === 'onlinemarketing1007@gmail.com');

    console.log(`User 1 [kd31967]: ${u1.id} | Created: ${u1.created_at}`);
    console.log(`User 2 [online.]: ${u2.id} | Created: ${u2.created_at}`);

    // 2. Sample contacts currently owned by User 1
    const { data: contacts } = await supabase
        .from('contacts')
        .select('name, created_at')
        .eq('user_id', u1.id)
        .limit(5)
        .order('created_at', { ascending: true }); // Get oldest

    console.log('Oldest Contacts owned by kd31967:');
    (contacts || []).forEach(c => {
        console.log(`- ${c.name}: ${c.created_at}`);
    });
}

inspectDates();
