const { supabaseAdmin } = require('../lib/supabaseClient');
async function test() {
    const { data: user, error: userError } = await supabaseAdmin.from('profiles').select('id').limit(1).single();
    if (userError) return console.error('User Error', userError);
    
    const payload = {
        user_id: user.id,
        name: 'New Sequence Test',
        description: '',
        trigger_type: 'pipeline STAGE CHANGED',
        trigger_value: '',
        stop_on_reply: true,
        allow_reentry: false,
        status: 'DRAFT',
        allowed_days: '0,1,2,3,4,5,6',
        time_window_start: '09:00',
        time_window_end: '18:00'
    };
    
    console.log("Inserting:", payload);
    const { data, error } = await supabaseAdmin.from('drip_campaigns').insert(payload).select().single();
    console.log("Result:", data ? "Success" : "Error");
    if (error) console.error(error);
}
test();
