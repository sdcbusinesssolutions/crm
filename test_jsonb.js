const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'server/.env' });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function test() {
    const { data, error } = await supabase.from('tasks').select('metadata').limit(1);
    console.log("DB fetch:", typeof data[0].metadata, data[0].metadata);
}
test();
