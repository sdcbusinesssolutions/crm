require('dotenv').config({ path: __dirname + '/.env' });
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabaseAdmin.from('user_integrations').insert({
    user_id: '11111111-1111-1111-1111-111111111111',
    provider: 'smtp',
    credentials: {}
  });
  console.log("Error:", error);
}
run();
