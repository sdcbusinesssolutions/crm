require('dotenv').config();
const { supabaseAdmin } = require('./lib/supabaseClient');
async function check() {
  const { data } = await supabaseAdmin.from('forms').select('id, name, fields').limit(1);
  console.log(JSON.stringify(data, null, 2));
}
check();
