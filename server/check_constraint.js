require('dotenv').config();
const { supabaseAdmin } = require('./lib/supabaseClient');
async function test() {
    const { data, error } = await supabaseAdmin.rpc('get_unique_constraints', { table_name: 'wa_message_rates' });
    console.log(data || error);
}
test();
