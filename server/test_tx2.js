const { supabaseAdmin } = require('./lib/supabaseClient');
async function test() {
    const { data } = await supabaseAdmin
        .from('wallet_transactions')
        .select('user_id, amount')
        .limit(5);
    console.log("Tx Data:", data);
}
test();
