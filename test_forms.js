require('dotenv').config({ path: './server/.env' });
const { supabaseAdmin } = require('./server/lib/supabaseClient');

async function check() {
  const { data, error } = await supabaseAdmin.from('forms').select('id, name, fields').limit(3);
  if (error) console.error(error);
  else console.log(JSON.stringify(data, null, 2));
}
check();
