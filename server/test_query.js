const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testQuery() {
    const nowIso = new Date().toISOString();
    console.log("nowIso:", nowIso);
    const { data, error } = await supabaseAdmin
        .from('flow_sessions')
        .select('id, status, current_node_id')
        .eq('status', 'delayed')
        .or(`variables->>global_resume_at.lte.${nowIso},variables->global_resume_at.is.null`);

    console.log("Error:", error);
    console.log("Data length:", data ? data.length : 0);
}

testQuery();
