const { supabaseAdmin } = require('./lib/supabaseClient');

async function testQuery() {
    const pastIso = new Date(Date.now() - 100000).toISOString();
    
    // Insert a dummy delayed session
    const { data: insertData, error: insertError } = await supabaseAdmin.from('flow_sessions').insert({
        id: '11111111-1111-1111-1111-111111111111',
        status: 'delayed',
        contact_phone: '1234567890',
        flow_id: 'ffa04169-4b72-44a4-a311-994a83ddc45a',
        user_id: '1586284c-4ab4-44e3-8b09-329d8445358c',
        variables: {
            global_resume_at: pastIso
        }
    }).select();
    
    console.log("Insert Error:", insertError);
    if (!insertError) {
        console.log("Inserted session.");
    }
    
    const nowIso = new Date().toISOString();
    
    const { data, error } = await supabaseAdmin
        .from('flow_sessions')
        .select('id, variables')
        .eq('status', 'delayed')
        .or(`variables->>global_resume_at.lte.${nowIso},variables->global_resume_at.is.null`)
        .eq('id', '11111111-1111-1111-1111-111111111111');

    console.log("Query Error:", error);
    console.log("Query Data:", data);
    
    // Cleanup
    await supabaseAdmin.from('flow_sessions').delete().eq('id', '11111111-1111-1111-1111-111111111111');
}

testQuery();
