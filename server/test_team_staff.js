const { supabaseAdmin } = require('./lib/supabaseClient');
async function test() {
  const { data } = await supabaseAdmin.from('team_staff').select('id, name, email');
  console.log("TEAM STAFF:", JSON.stringify(data, null, 2));
}
test();
