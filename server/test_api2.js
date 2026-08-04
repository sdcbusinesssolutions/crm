const { supabaseAdmin } = require('./lib/supabaseClient');
async function test() {
    const { data, error } = await supabaseAdmin.from('profiles').select('*').limit(1);
    console.log(data?.[0]);
}
test();
