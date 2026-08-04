const { supabaseAdmin } = require('./lib/supabaseClient');
async function test() {
    const { data } = await supabaseAdmin.from('whatsapp_config').select('*').limit(1);
    console.log("Config keys:", Object.keys(data[0] || {}));
}
test();
