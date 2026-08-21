const { supabaseAdmin } = require('./lib/supabaseClient');

async function testMatch() {
    const pastIso = new Date(Date.now() - 100000).toISOString();
    
    // Create dummy flow
    const flowId = '11111111-1111-1111-1111-111111111111';
    await supabaseAdmin.from('flows').insert({
        id: flowId,
        user_id: '5ae5999e-1eb2-4425-adf4-858156709d2d',
        name: 'test_flow'
    });

    // Insert a dummy delayed session
    const { data: insertData, error: insertError } = await supabaseAdmin.from('flow_sessions').insert({
        id: '11111111-1111-1111-1111-111111111111',
        status: 'delayed',
        contact_phone: '1234567890',
        flow_id: flowId,
        user_id: '5ae5999e-1eb2-4425-adf4-858156709d2d',
        variables: {
            global_resume_at: pastIso
        }
    }).select();
    
    console.log("Insert Error:", insertError);
    if (!insertError) {
        console.log("Inserted session.");
    }
    
    const nowIso = new Date().toISOString();
    console.log("Now ISO:", nowIso);
    console.log("Past ISO:", pastIso);
    
    const { data, error } = await supabaseAdmin
        .from('flow_sessions')
        .select('id, variables')
        .eq('status', 'delayed')
        .or(`variables->>global_resume_at.lte.${nowIso},variables->global_resume_at.is.null`)
        .eq('id', '11111111-1111-1111-1111-111111111111');

    console.log("Query Error:", error);
    console.log("Query Data length:", data ? data.length : 0);
    
    // Cleanup
    await supabaseAdmin.from('flow_sessions').delete().eq('id', '11111111-1111-1111-1111-111111111111');
    await supabaseAdmin.from('flows').delete().eq('id', flowId);
}

testMatch();
