const { supabaseAdmin } = require('./lib/supabaseClient');
async function test() {
  const { data } = await supabaseAdmin.from('leads').select('phone, assigned_staff_ids').like('phone', '%2012');
  console.log("LEADS FOR 2012:", JSON.stringify(data, null, 2));
}
test();
