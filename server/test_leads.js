const { supabaseAdmin } = require('./lib/supabaseClient');
async function test() {
  const { data } = await supabaseAdmin.from('leads').select('phone, assigned_staff_ids').eq('phone', '917568422013');
  console.log("LEADS FOR 917568422013:", JSON.stringify(data, null, 2));
}
test();
