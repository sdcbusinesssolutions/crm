
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing credentials');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function debugCampaign() {
    console.log('--- DEBUG DRIP CONFIG ---');

    // 1. Find Campaign
    const { data: campaigns, error } = await supabase
        .from('drip_campaigns')
        .select('*')
        .ilike('name', '%Tag drip check%');

    if (error) {
        console.error('Search Error:', error);
        return;
    }

    if (!campaigns || campaigns.length === 0) {
        console.log('No campaign found with name like "Tag drip check"');
        return;
    }

    console.log(`Found ${campaigns.length} campaigns.`);

    for (const camp of campaigns) {
        console.log(`\nCampaign: "${camp.name}" (ID: ${camp.id})`);
        console.log(`- Status: ${camp.status}`);
        console.log(`- Trigger Type: ${camp.trigger_type}`);
        console.log(`- Trigger Value (The Tag): "${camp.trigger_value}"`);
        console.log(`- User ID: ${camp.user_id}`);

        // 2. Count Steps
        const { data: steps, error: stepErr } = await supabase
            .from('drip_steps')
            .select('*')
            .eq('drip_campaign_id', camp.id)
            .order('step_order');

        if (stepErr) console.error('- Step Fetch Error:', stepErr);
        else {
            console.log(`- Steps Count: ${steps.length}`);
            steps.forEach(s => {
                console.log(`  [${s.step_order}] ${s.step_type} (Delay: ${s.delay_value} ${s.delay_unit})`);
            });
        }

        // 3. Check Enrollments
        const { count, error: countErr } = await supabase
            .from('drip_enrollments')
            .select('*', { count: 'exact', head: true })
            .eq('drip_campaign_id', camp.id);

        if (countErr) console.error('- Enrollment Count Error:', countErr);
        else console.log(`- Total Enrollments: ${count}`);
    }
}

debugCampaign();
