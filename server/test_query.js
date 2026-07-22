const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = require('dotenv').config({ path: '/home/devendra/proj/wpcode/server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseKey) {
    console.error('No supabase key!');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    let query = supabase.from('contacts').select('id, custom_data', { count: 'exact' });
    
    // Opted out
    let resOut = await query.contains('custom_data', '{"opted_out":true}');
    console.log("Opted out count:", resOut.count);

    let queryIn = supabase.from('contacts').select('id, custom_data', { count: 'exact' });
    let resIn2 = await queryIn.or('custom_data.is.null,custom_data.not.cs.{"opted_out":true}');
    console.log("Opted in (or null not cs) count:", resIn2.count, resIn2.error);
}

run().catch(console.error);
