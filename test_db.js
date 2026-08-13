const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '/home/devendra/proj/wpcode/.env' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
async function run() {
  const { data, error } = await supabase.from('messages').select('type, status, text, whatsapp_message_id, created_at').order('created_at', { ascending: false }).limit(5);
  console.log(JSON.stringify(data, null, 2));
  process.exit(0);
}
run();
