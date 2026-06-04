const { supabaseAdmin } = require('./lib/supabaseClient');
async function test() {
  const { data, count } = await supabaseAdmin.from('contacts').select('phone', { count: 'exact' });
  console.log("TOTAL CONTACTS IN DB:", count);
}
test();
