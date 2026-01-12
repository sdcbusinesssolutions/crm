const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env");
    console.log("Looking for .env at:", path.join(__dirname, '../.env'));
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    console.log('Fetching contacts with group_ids...');
    // Fetch a few contacts that have group_ids
    const { data, error } = await supabase
        .from('contacts')
        .select('id, phone, group_ids, user_id')
        .not('group_ids', 'is', null)
        .limit(5);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`Found ${data.length} contacts with non-null group_ids.`);

    data.forEach((sample, i) => {
        console.log(`\n--- Contact ${i + 1} ---`);
        console.log('ID:', sample.id);
        console.log('GroupIDs Value:', sample.group_ids);
        console.log('Type of group_ids:', typeof sample.group_ids);
        console.log('Is Array:', Array.isArray(sample.group_ids));
        if (Array.isArray(sample.group_ids) && sample.group_ids.length > 0) {
            console.log('First Element Type:', typeof sample.group_ids[0]);
        }

        // Test Deduplication Key
        const key = sample.phone ? String(sample.phone).trim() : `id:${sample.id}`;
        console.log('Dedupe Key:', key);
    });
}

test();
