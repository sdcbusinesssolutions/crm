const { supabaseAdmin } = require('./lib/supabaseClient');
async function test() {
  const { data } = await supabaseAdmin.from('staff').select('email, id, name, permissions').ilike('email', 'u5%');
  console.log("STAFF DATA:", JSON.stringify(data, null, 2));
}
test();
