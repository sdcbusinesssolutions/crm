const { supabaseAdmin } = require('../lib/supabaseClient');
async function fetchTpls() {
  const { data } = await supabaseAdmin.from('whatsapp_templates').select('*').eq('name', 'uti');
  // let's see how they are mapped in the GET /api/whatsapp/templates route
}
fetchTpls();
