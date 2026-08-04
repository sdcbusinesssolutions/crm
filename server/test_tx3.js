const { supabaseAdmin } = require('./lib/supabaseClient');
async function test() {
    const { data, count, error } = await supabaseAdmin
        .from('wallet_transactions')
        .select('*, whatsapp_config:whatsapp_account_id(whatsapp_account_id)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(0, 49);
    console.log("Tx Data Count:", data?.length, "Error:", error);
}
test();
