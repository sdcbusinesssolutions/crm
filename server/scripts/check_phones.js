
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
    const { data } = await supabase.from('contacts').select('phone').limit(5);
    console.log('PHONES:', JSON.stringify(data));
}
run();
