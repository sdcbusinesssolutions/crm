require('dotenv').config();
const { supabaseAdmin } = require('./lib/supabaseClient');
async function test() {
    const { data } = await supabaseAdmin.from('wa_message_rates').select('*').eq('country_code', 'IN');
    console.log(data);
}
test();
