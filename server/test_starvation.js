const { supabaseAdmin } = require('./lib/supabaseClient');

async function check() {
    const { data, error } = await supabaseAdmin.from('flow_sessions')
        .select('id, variables')
        .eq('status', 'delayed')
        .is('variables->global_resume_at', null)
        .limit(100);
    
    console.log("Sessions with null global_resume_at:", data ? data.length : 0);
    if (data && data.length > 0) {
        console.log("Sample:", JSON.stringify(data[0].variables).substring(0, 200));
    }
}
check();
