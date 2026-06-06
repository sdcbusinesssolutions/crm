const { supabaseAdmin } = require('./lib/supabaseClient');
async function test() {
  const staffId = '6274c2ee-6da1-4ec9-891e-a651326303d8';
  const { data } = await supabaseAdmin.from('leads').select('phone, assigned_staff_ids').contains('assigned_staff_ids', [staffId]);
  console.log("LEADS ASSIGNED TO U5:", JSON.stringify(data, null, 2));
}
test();
