
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkAuthUsers() {
    console.log('--- Checking Auth Users ---');
    const { data: { users }, error } = await supabase.auth.admin.listUsers();

    if (error) {
        console.error('Error fetching auth users:', error.message);
        return;
    }

    const map = {};
    users.forEach(u => {
        if (u.email === 'kd31967@gmail.com' || u.email === 'onlinemarketing1007@gmail.com') {
            map[u.email] = u.id;
        }
    });
    console.log('Target Emails to ID Map:', JSON.stringify(map, null, 2));

    // Also verify contact owners again just to be sure
    const { data: contacts } = await supabase.from('contacts').select('user_id');
    const counts = {};
    (contacts || []).forEach(c => {
        const uid = c.user_id || 'NULL';
        counts[uid] = (counts[uid] || 0) + 1;
    });
    console.log('Owner Counts:', JSON.stringify(counts, null, 2));
}

checkAuthUsers();
