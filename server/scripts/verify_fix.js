
require('dotenv').config({ path: 'f:/whatsapp/Final-Project-Wp/wpcode/.env' });
const { supabaseAdmin } = require('../lib/supabaseClient');

async function checkColumns() {
    // This is a workaround since we can't reliably run DDL via JS client without specific RPCs.
    // We will try to SELECT the column. If it fails, we know it's missing.
    console.log('Checking for flow_id column...');

    const { data, error } = await supabaseAdmin
        .from('sheet_automations')
        .select('flow_id')
        .limit(1);

    if (error) {
        console.error('Column Check Failed:', error.message);
        console.log('AUTO-FIX ATTEMPT: We will try to create the column using a known RPC "exec_sql" or tell user to run SQL.');
    } else {
        console.log('✅ Column flow_id EXISTS. PostgREST cache might just need a reload.');
        // Try to trigger reload
        await supabaseAdmin.rpc('exec_sql', { sql_query: "NOTIFY pgrst, 'reload config';" });
    }
}

checkColumns();
