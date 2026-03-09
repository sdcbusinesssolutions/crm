
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
    const { data } = await supabase.from('drip_enrollments').select('*').order('started_at', { ascending: false }).limit(1);
    console.log('LAST_ENROLLMENT:', JSON.stringify(data));
}
run();
