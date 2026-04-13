
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

require('dotenv').config({ path: '../.env' }); // Load from parent or current dir
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function run() {
    console.log('--- Starting Phone Health Debug Script (v21.0) ---');

    // 1. List all configs to find the right one
    const { data: configs, error } = await supabase.from('whatsapp_config').select('phone_number, phone_number_id');

    if (error || !configs) {
        console.error('Error listing configs:', error);
        return;
    }

    // Filter for our target
    const target = configs.find(c => c.phone_number?.includes('7559410321') || c.phone_number?.includes('75594 10321'));

    if (!target) {
        console.error('Target phone not found in list.');
        return;
    }

    // Fetch full config
    const { data: fullConfigs } = await supabase.from('whatsapp_config').select('*').eq('phone_number_id', target.phone_number_id);
    const config = fullConfigs[0];
    const phoneId = config.phone_number_id;
    const accessToken = config.meta_access_token;

    console.log(`Found config for Phone ID: ${phoneId}`);
    console.log(`Using Access Token: ${accessToken.substring(0, 10)}...`);

    // 2. Fetch Phone Health from Meta (v25.0)
    const url = `https://graph.facebook.com/v25.0/${phoneId}?fields=display_phone_number,quality_rating,whatsapp_business_manager_messaging_limit,status,name_status`;

    try {
        const res = await axios.get(url, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        console.log('--- META API RESPONSE ---');
        console.log(JSON.stringify(res.data, null, 2));
        console.log('-------------------------');

    } catch (e) {
        console.error('Error fetching from Meta:', e.response?.data || e.message);
    }
}

run();
