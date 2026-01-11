
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkUsers() {
    console.log('--- DEBUG START ---');

    // 1. Find the ID for the target email
    const email = 'kd31967@gmail.com';
    const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, email')
        .eq('email', email)
        .single();

    if (userError) {
        console.log(`Error finding user ${email}:`, userError.message);
    } else {
        console.log(`User ${email} has ID: ${userData.id}`);
    }

    // 2. Aggregate contact ownership
    const { data: contacts, error: contactError } = await supabase
        .from('contacts')
        .select('user_id');

    if (contactError) {
        console.log('Error fetching contacts:', contactError.message);
    } else {
        const counts = {};
        (contacts || []).forEach(c => {
            const uid = c.user_id || 'NULL';
            counts[uid] = (counts[uid] || 0) + 1;
        });
        console.log('Owner Counts:', JSON.stringify(counts, null, 2));
    }
    console.log('--- DEBUG END ---');
}

checkUsers();
