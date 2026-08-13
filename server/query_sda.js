const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '/home/devendra/proj/wpcode/server/.env' });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
async function run() {
    const { data } = await supabase.from('sheet_automations').select('*').eq('id', '3dcbe547-1994-4512-9cb3-cf2aed294614').single();
    console.log(JSON.stringify(data, null, 2));
}
run();
