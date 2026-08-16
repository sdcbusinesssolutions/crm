require('dotenv').config();
const { supabaseAdmin } = require('./lib/supabaseClient');
async function test() {
    const upserts = [
        {
            scope: 'GLOBAL', category: 'TEST_INSERT', country_code: 'IN', meta_cost: 0, platform_rate: 0
        },
        {
            id: '52bb1067-a39b-48a0-b114-14aa4f9fc4ea', // Marketing ID from earlier
            scope: 'GLOBAL', category: 'MARKETING', country_code: 'IN', meta_cost: 0.99, platform_rate: 1.99
        }
    ];
    const { data, error } = await supabaseAdmin.from('wa_message_rates').upsert(upserts).select();
    console.log("Error:", error);
    console.log("Data:", JSON.stringify(data, null, 2));
}
test();
