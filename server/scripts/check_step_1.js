
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkStep1() {
    const { data: campaign } = await supabase.from('drip_campaigns').select('id').ilike('name', 'newdrip').single();
    if (campaign) {
        const { data: step } = await supabase.from('drip_steps').select('*').eq('drip_campaign_id', campaign.id).eq('step_order', 1).single();
        if (step) {
            console.log(`Step 1 Delay: ${step.delay_value} ${step.delay_unit}`);
            console.log(`Step 1 Type: ${step.step_type}`);
        } else {
            console.log('Step 1 not found for newdrip');
        }
    }
}
checkStep1();
