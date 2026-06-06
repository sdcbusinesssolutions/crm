const { supabaseAdmin } = require('./lib/supabaseClient');
async function test() {
  const { data } = await supabaseAdmin.from('staff').select('email, id, name').eq('name', 'u5');
  if (data && data.length > 0) {
     const staffId = data[0].id;
     const { data: perms } = await supabaseAdmin.from('team_staff_permissions').select('*').eq('staff_id', staffId);
     console.log("STAFF DATA:", data[0]);
     console.log("PERMISSIONS:", perms);
  } else {
     console.log("No staff found with name u5");
  }
}
test();
