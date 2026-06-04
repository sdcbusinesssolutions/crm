const { supabaseAdmin } = require('./lib/supabaseClient');
async function test() {
  const { data } = await supabaseAdmin.from('leads').select('*').limit(1);
  console.log("LEAD SCHEMA:", Object.keys(data[0] || {}));
}
test();
