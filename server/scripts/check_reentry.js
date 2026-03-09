
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
    console.log('--- RE-ENTRY CHECK ---');
    const { data: campaign } = await supabase.from('drip_campaigns').select('id, name, allow_reentry, status').ilike('name', 'newdrip').single();
    if (campaign) {
        console.log(`Campaign: ${campaign.name}`);
        console.log(`Allow Re-entry: ${campaign.allow_reentry}`);
        console.log(`Status: ${campaign.status}`);
    } else {
        console.log('Campaign not found');
    }
}
run();
