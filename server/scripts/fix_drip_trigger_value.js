
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

async function fixCampaign() {
    console.log('--- FIXING DRIP TRIGGER VALUE ---');

    // 1. Find Campaign
    const { data: campaigns, error } = await supabase
        .from('drip_campaigns')
        .select('*')
        .ilike('name', '%Tag drip check%');

    if (error || !campaigns || campaigns.length === 0) {
        console.error('Campaign not found', error);
        return;
    }

    const campaign = campaigns[0];
    console.log(`Found Campaign: "${campaign.name}" (ID: ${campaign.id})`);
    console.log(`Current Trigger Value: "${campaign.trigger_value}"`);

    // 2. Update to 'abc'
    const { data: updated, error: updateErr } = await supabase
        .from('drip_campaigns')
        .update({ trigger_value: 'abc' }) // Setting to 'abc' as requested
        .eq('id', campaign.id)
        .select()
        .single();

    if (updateErr) {
        console.error('Update Failed:', updateErr);
    } else {
        console.log(`✅ Success! Updated trigger_value to: "${updated.trigger_value}"`);
    }
}

fixCampaign();
