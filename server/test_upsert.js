require('dotenv').config();
const { supabaseAdmin } = require('./lib/supabaseClient');
async function test() {
    const upserts = [
        {
            scope: 'GLOBAL',
            category: 'MARKETING',
            country_code: 'IN',
            meta_cost: 0.0128,
            platform_rate: 0.70,
            is_active: true,
            user_id: null
        }
    ];
    const { data, error } = await supabaseAdmin
        .from('wa_message_rates')
        .upsert(upserts, { onConflict: 'scope, category, country_code, user_id' })
        .select();
    console.log("Data:", data);
    console.log("Error:", error);
}
test();
