
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
    const { data, error } = await supabase.from('drip_campaigns').update({ allow_reentry: true }).ilike('name', 'newdrip').select();
    if (error) {
        console.error('Update failed:', error.message);
    } else {
        console.log('Successfully set allow_reentry to TRUE for "newdrip"');
    }
}
run();
