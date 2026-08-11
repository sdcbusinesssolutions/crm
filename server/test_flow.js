require('dotenv').config();
const { supabaseAdmin } = require('./lib/supabaseClient');
async function check() {
  const { data } = await supabaseAdmin.from('flows').select('nodes').limit(1);
  const checkFormNode = data[0].nodes.find(n => n.type === 'checkForm');
  console.log(JSON.stringify(checkFormNode, null, 2));
}
check();
