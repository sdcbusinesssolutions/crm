const { supabaseAdmin } = require('./lib/supabaseClient');
async function test() {
  const { data } = await supabaseAdmin.from('team_staff_permissions').select('module_name').limit(20);
  const modules = [...new Set(data.map(d => d.module_name))];
  console.log("MODULES IN DB:", modules);
}
test();
