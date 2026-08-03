const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
async function run() {
  const { data } = await supabase.from('conversations').select('*').limit(1);
  if (data && data.length > 0) console.log(Object.keys(data[0]));
}
run();
