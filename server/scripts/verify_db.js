const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

console.log('Supabase URL:', supabaseUrl);
console.log('Service Key starts with:', supabaseServiceKey ? supabaseServiceKey.substring(0, 10) : 'MISSING');

if (!supabaseServiceKey) {
    console.error('CRITICAL: Service Key is missing!');
    process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
});

async function run() {
    const { data, error } = await supabaseAdmin.from('sheet_automations').select('id, name');
    if (error) {
        console.error('Query Error:', error);
    } else {
        console.log('Automations Count:', data.length);
        console.table(data);
    }
}

run();
