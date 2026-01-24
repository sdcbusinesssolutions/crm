const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, 'server', '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const TARGET_USER_ID = '35d4fe7d-753d-43da-85fb-a32b6f66133e';

async function runQueries() {
    console.log(`--- Running Queries for User: ${TARGET_USER_ID} ---`);

    // 1. Simple Count
    console.log('\n1. Executing: SELECT count(*) FROM contacts WHERE user_id = ...');
    const { count, error: countError } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', TARGET_USER_ID);

    if (countError) {
        console.error('Error counting contacts:', countError);
    } else {
        console.log(`Count result: ${count}`);
    }

    // 2. Inspect Schema for Group-wise count
    console.log('\n2. Inspecting one contact record to determine grouping column...');
    const { data: contacts, error: fetchError } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', TARGET_USER_ID)
        .limit(1);

    if (fetchError) {
        console.error('Error fetching contact:', fetchError);
    } else if (contacts.length > 0) {
        console.log('Sample contact keys:', Object.keys(contacts[0]));
        console.log('Sample contact:', contacts[0]);
    } else {
        console.log('No contacts found for this user to inspect schema. Checking any contact...');
        const { data: anyContact } = await supabase.from('contacts').select('*').limit(1);
        if (anyContact && anyContact.length > 0) {
            console.log('Sample global contact keys:', Object.keys(anyContact[0]));
        }
    }
}

runQueries();
