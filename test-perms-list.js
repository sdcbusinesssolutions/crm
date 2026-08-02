const { supabaseAdmin } = require('./server/lib/supabaseClient');
async function test() {
  const { data, error } = await supabaseAdmin.from('team_staff_permissions').select('module_name').limit(100);
  console.log(error ? "ERROR: " + error.message : "SUCCESS: " + [...new Set(data.map(r => r.module_name))].join(', '));
}
test();
