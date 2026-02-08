const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const searchQuery = process.argv[2] || 'test';

async function testSearch() {
    console.log(`Searching for: "${searchQuery}"`);

    // Simulate the query from leads.js
    let query = supabase
        .from('leads')
        .select('id, name, phone, email')
        .or(`name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,company.ilike.%${searchQuery}%`)
        .limit(5);

    const { data, error } = await query;

    if (error) {
        console.error('Search Error:', error);
    } else {
        console.log(`Found ${data.length} results:`);
        data.forEach(l => console.log(`- ${l.name} (${l.phone})`));
    }
}

testSearch();
