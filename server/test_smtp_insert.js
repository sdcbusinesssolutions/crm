require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabaseAdmin.from('user_integrations').insert({
    user_id: '00000000-0000-0000-0000-000000000000',
    provider: 'smtp',
    credentials: {},
    is_active: true
  });
  console.log("Error:", error);
}
run();
