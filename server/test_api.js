const { supabaseAdmin } = require('./lib/supabaseClient');
async function test() {
    let query = supabaseAdmin.from('profiles').select('id, name, email, phone, signup_domain');
    const { data, error } = await query;
    console.log("Profiles count:", data?.length, "Error:", error);
}
test();
