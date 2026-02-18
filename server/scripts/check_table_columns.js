
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase URL or Key');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkColumns() {
    console.log('--- Checking Conversations Columns ---');
    const { data: convCols, error: cErr } = await supabase.rpc('get_table_info', { table_name: 'conversations' });

    // If RPC doesn't exist, we can try querying one row and printing keys, 
    // BUT empty table would fail.
    // Better: Query Postgres system tables via RPC if available, or just guess.

    // Fallback: Query one row
    const { data: convData } = await supabase.from('conversations').select('*').limit(1);
    if (convData && convData.length > 0) {
        console.log('Conversations Keys:', Object.keys(convData[0]));
    } else {
        console.log('Conversations table is empty or could not be read.');
    }

    console.log('\n--- Checking Messages Columns ---');
    const { data: msgData } = await supabase.from('messages').select('*').limit(1);
    if (msgData && msgData.length > 0) {
        console.log('Messages Keys:', Object.keys(msgData[0]));
    } else {
        console.log('Messages table is empty or could not be read.');
    }
}

checkColumns();
