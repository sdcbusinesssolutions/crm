const { supabaseAdmin } = require('../lib/supabaseClient');
async function fetchTpls() {
  const { data } = await supabaseAdmin.from('whatsapp_templates').select('*').eq('name', 'uti');
  console.log(JSON.stringify(data, null, 2));
}
fetchTpls();
