
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const MetaOnboardingService = require('./services/MetaOnboardingService');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const USER_ID = '5ae5999e-1eb2-4425-adf4-858156709d2d';

async function run() {
    console.log('Fetching config...');
    const { data: config, error } = await supabase
        .from('whatsapp_config')
        .select('*')
        .eq('user_id', USER_ID)
        .single();

    if (error || !config) {
        console.error('Config not found:', error);
        return;
    }

    console.log(`Found Config. WABA: ${config.whatsapp_business_account_id}`);

    try {
        console.log('Attempting to override webhook...');
        await MetaOnboardingService.overrideCallbackUrl(
            config.whatsapp_business_account_id,
            config.meta_access_token
        );
        console.log('SUCCESS: Webhook URL updated successfully!');
    } catch (err) {
        console.error('FAILED to update webhook:', err.response?.data || err.message);
    }
}

run();
