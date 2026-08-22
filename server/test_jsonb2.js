const { supabaseAdmin } = require('./lib/supabaseClient');

async function testQuery() {
    const pastIso = new Date(Date.now() - 100000).toISOString();
    
    // Insert a dummy delayed session
    const { data: insertData, error: insertError } = await supabaseAdmin.from('flow_sessions').insert({
        id: '11111111-1111-1111-1111-111111111111',
        status: 'delayed',
        contact_id: '11111111-1111-1111-1111-111111111111',
        flow_id: '11111111-1111-1111-1111-111111111111',
        user_id: '11111111-1111-1111-1111-111111111111',
        tenant_id: '11111111-1111-1111-1111-111111111111',
        variables: {
            global_resume_at: pastIso
        }
    }).select();
    
    console.log("Insert Error:", insertError);
    
    const nowIso = new Date().toISOString();
    
    const { data, error } = await supabaseAdmin
        .from('flow_sessions')
        .select('id')
        .eq('status', 'delayed')
        .or(`variables->>global_resume_at.lte.${nowIso},variables->global_resume_at.is.null`)
        .eq('id', '11111111-1111-1111-1111-111111111111');

    console.log("Error:", error);
    console.log("Data:", data);
    
    // Cleanup
    await supabaseAdmin.from('flow_sessions').delete().eq('id', '11111111-1111-1111-1111-111111111111');
}

testQuery();
