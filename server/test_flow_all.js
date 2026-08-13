require('dotenv').config();
const { supabaseAdmin } = require('./lib/supabaseClient');
async function check() {
  const { data } = await supabaseAdmin.from('flows').select('nodes');
  const flow = data.find(f => f.nodes.some(n => n.type === 'checkForm'));
  if (flow) {
    const node = flow.nodes.find(n => n.type === 'checkForm');
    console.log(JSON.stringify(node, null, 2));
  } else {
    console.log('No checkForm node found in any flow');
  }
}
check();
