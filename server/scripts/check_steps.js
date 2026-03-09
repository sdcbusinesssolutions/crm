
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkSteps() {
    const { data: campaign } = await supabase.from('drip_campaigns').select('id').ilike('name', 'newdrip').single();
    if (campaign) {
        const { data: steps } = await supabase.from('drip_steps').select('*').eq('drip_campaign_id', campaign.id).order('step_order', { ascending: true });
        console.log('STEPS:', JSON.stringify(steps));
    }
}
checkSteps();
