const { supabaseAdmin } = require('../lib/supabaseClient');
async function test() {
    // try inserting pipeline_STAGE_CHANGED
    const { data: user } = await supabaseAdmin.from('profiles').select('id').limit(1).single();
    const payload = {
        user_id: user.id,
        name: 'New Sequence Test 2',
        description: '',
        trigger_type: 'pipeline_STAGE_CHANGED',
        trigger_value: '',
        stop_on_reply: true,
        allow_reentry: false,
        status: 'DRAFT',
    };
    const { data, error } = await supabaseAdmin.from('drip_campaigns').insert(payload).select().single();
    console.log("Result for pipeline_STAGE_CHANGED:", data ? "Success" : error.message);
    
    const payload2 = { ...payload, trigger_type: 'PIPELINE_STAGE_CHANGED' };
    const { data: d2, error: e2 } = await supabaseAdmin.from('drip_campaigns').insert(payload2).select().single();
    console.log("Result for PIPELINE_STAGE_CHANGED:", d2 ? "Success" : e2.message);
}
test();
