require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Error: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugContacts() {
    console.log('--- DEBUG USER CONTACT COUNTS ---');

    // 1. Get total count
    const { count, error: countErr } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true });

    if (countErr) {
        console.error('Error counting:', countErr);
        return;
    }
    console.log(`Total Contacts in DB (All Users): ${count}`);

    // 2. Group by user_id to see distribution
    // Since we can't do "GROUP BY" easily with standard SDK select without RPC,
    // We will fetch limited fields and aggregate in JS. 
    // Fetching 10000 should be enough if total is 7763.

    const { data, error } = await supabase
        .from('contacts')
        .select('user_id')
        .range(0, 9999);

    if (error) {
        console.error('Error fetching data:', error);
        return;
    }

    const userCounts = {};
    let nullUser = 0;

    data.forEach(c => {
        if (c.user_id) {
            userCounts[c.user_id] = (userCounts[c.user_id] || 0) + 1;
        } else {
            nullUser++;
        }
    });

    console.log('--- Counts per User ID ---');
    Object.keys(userCounts).forEach(uid => {
        console.log(`User ${uid}: ${userCounts[uid]} contacts`);
    });
    if (nullUser > 0) {
        console.log(`Contacts with NULL user_id: ${nullUser}`);
    }
}

debugContacts();
