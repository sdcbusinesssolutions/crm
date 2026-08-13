require('dotenv').config();
const { supabaseAdmin } = require('./lib/supabaseClient');
async function check() {
  const { data } = await supabaseAdmin.from('forms').select('*').eq('id', 'cb695254-48c9-4025-8106-38b1329a371e');
  console.log(JSON.stringify(data, null, 2));
}
check();
