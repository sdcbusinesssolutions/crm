const { supabaseAdmin } = require('./lib/supabaseClient');
async function test() {
    const { data, count, error } = await supabaseAdmin
        .from('wallet_transactions')
        .select('*', { count: 'exact', head: true });
    console.log("Total Transactions count:", count, "Error:", error);
}
test();
