const { supabaseAdmin } = require('../lib/supabaseClient');
async function check() {
  const { data, error } = await supabaseAdmin.from('drip_campaigns').select('*').limit(1);
  console.log(data ? Object.keys(data[0] || {}) : error);
}
check();
