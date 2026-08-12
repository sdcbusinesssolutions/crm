require('dotenv').config();
const { supabaseAdmin } = require('./lib/supabaseClient');
async function check() {
  const { data } = await supabaseAdmin.from('tasks').select('due_date').not('due_date', 'is', null).limit(1);
  console.log(data);
}
check();
