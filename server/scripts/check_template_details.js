const path = require('path');
require('dotenv').config({ path: 'f:/whatsapp/Final-Project-Wp/wpcode/.env' });
const { supabaseAdmin } = require('../lib/supabaseClient');
const axios = require('axios');

const USER_ID = '38edee2f-04c5-4f4c-8ca1-baed6ed84711';

async function run() {
    console.log('--- Checking Template Details ---');
    // 1. Get Config
    const { data: config, error } = await supabaseAdmin
        .from('whatsapp_config')
        .select('*')
        .eq('user_id', USER_ID)
        .maybeSingle();

    if (error || !config) {
        console.log('No WhatsApp config found for user.');
        return;
    }

    const accessToken = config.meta_access_token;
    const phoneId = config.phone_number_id;

    console.log(`Phone ID: ${phoneId}`);

    // 2. Get WABA ID
    let wabaId = config.business_account_id;
    if (!wabaId) {
        console.log('WABA ID missing in DB. Fetching from Meta...');
        try {
            const res = await axios.get(`https://graph.facebook.com/v21.0/${phoneId}?fields=business_account`, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            // Response shape: { id: "...", business_account: { id: "..." } }
            if (res.data.business_account) {
                wabaId = res.data.business_account.id;
                console.log(`Discovered WABA ID: ${wabaId}`);
            } else {
                console.log('Could not find business_account in phone_number_id response.');
            }
        } catch (e) {
            console.error('Error fetching WABA ID:', e.response?.data || e.message);
            return;
        }
    }

    if (!wabaId) {
        console.error('Cannot proceed without WABA ID.');
        return;
    }

    // 3. Search for 'uti' template
    const url = `https://graph.facebook.com/v21.0/${wabaId}/message_templates?name=uti`;
    console.log(`Querying: ${url}`);

    try {
        const tplRes = await axios.get(url, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        const data = tplRes.data.data; // Array of templates
        if (data.length === 0) {
            console.log('No templates found with name "uti" in Meta account.');
        } else {
            console.log(`Found ${data.length} template(s) named "uti":`);
            data.forEach(t => {
                console.log(`- Name: ${t.name}`);
                console.log(`  Language: ${t.language}`);
                console.log(`  Status: ${t.status}`);
                console.log(`  ID: ${t.id}`);
            });
        }

    } catch (e) {
        console.error('Error fetching templates:', JSON.stringify(e.response?.data || e.message, null, 2));
    }
}

run();
