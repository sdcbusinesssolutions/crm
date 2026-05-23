const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
async function get() {
  const { data } = await supabase.from('messages').select('*').eq('type', 'location').order('created_at', { ascending: false }).limit(1);
  console.log(data);
}
get();
