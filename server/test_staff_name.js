const { supabaseAdmin } = require('./lib/supabaseClient');
async function test() {
  const { data } = await supabaseAdmin.from('team_staff').select('name').eq('id', '6274c2ee-6da1-4ec9-891e-a651326303d8').single();
  console.log("TEAM STAFF:", data);
  const { data: sData } = await supabaseAdmin.from('staff').select('name').eq('id', '6274c2ee-6da1-4ec9-891e-a651326303d8').single();
  console.log("STAFF:", sData);
}
test();
