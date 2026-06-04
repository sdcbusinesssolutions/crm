const { supabaseAdmin } = require('./lib/supabaseClient');
async function test() {
  const { data } = await supabaseAdmin.from('staff').select('id, name, email');
  console.log("STAFF:", JSON.stringify(data, null, 2));
}
test();
