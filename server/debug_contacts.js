
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Use service key to bypass RLS for debugging

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkContacts() {
    console.log('Checking Contacts Table...');

    // 1. Total count
    const { count: total, error: err1 } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true });

    if (err1) {
        console.error('Error counting total contacts:', err1);
    } else {
        console.log(`Total Rows in 'contacts': ${total}`);
    }

    // 2. Count with NULL user_id
    const { count: nullUser, error: err2 } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .is('user_id', null);

    if (err2) {
        console.error('Error counting null user_id:', err2);
    } else {
        console.log(`Rows with NULL user_id: ${nullUser}`);
    }

    // 3. Distribution
    const { data, error: err3 } = await supabase
        .from('contacts')
        .select('user_id');

    if (err3) {
        console.error('Error fetching ids:', err3);
    } else {
        const counts = {};
        (data || []).forEach(c => {
            const uid = c.user_id || 'NULL';
            counts[uid] = (counts[uid] || 0) + 1;
        });
        console.log('Ownership Distribution:', counts);
    }
}

checkContacts();
