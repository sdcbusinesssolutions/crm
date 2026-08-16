require('dotenv').config();
const { supabaseAdmin } = require('./lib/supabaseClient');
async function test() {
    const { data, error } = await supabaseAdmin
        .from('wa_message_rates')
        .select('*')
        .eq('country_code', 'IN');
    console.log("Data length:", data.length);
    console.log("Data:", JSON.stringify(data, null, 2));
}
test();
