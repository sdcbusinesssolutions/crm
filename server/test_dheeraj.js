const { supabaseAdmin } = require('./lib/supabaseClient');
async function test() {
  const { data } = await supabaseAdmin.from('contacts').select('name, phone');
  console.log("ALL CONTACTS:", JSON.stringify(data, null, 2));
}
test();
