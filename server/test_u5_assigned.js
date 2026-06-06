const { supabaseAdmin } = require('./lib/supabaseClient');
async function test() {
  const staffId = '6274c2ee-6da1-4ec9-891e-a651326303d8';
  
  const { data: leads } = await supabaseAdmin.from('leads').select('id, phone, assigned_staff_ids');
  
  const assigned = leads.filter(l => l.assigned_staff_ids && l.assigned_staff_ids.includes(staffId));
  console.log("LEADS FOR U5:", assigned.length);
  console.log("PHONES:", assigned.map(a => a.phone));
}
test();
