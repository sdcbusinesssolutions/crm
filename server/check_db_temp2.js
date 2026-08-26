const { supabaseAdmin } = require('./lib/supabaseClient');
async function run() {
    const { data } = await supabaseAdmin.from('wa_message_rates').select('*').eq('scope', 'GLOBAL').eq('currency', 'INR');
    console.log("GLOBAL RATES:", data);
}
run();
