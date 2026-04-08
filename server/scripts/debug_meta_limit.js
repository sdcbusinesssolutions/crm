/**
 * debug_meta_limit.js — Test correct API version for whatsapp_business_manager_messaging_limit
 * Run: node server/scripts/debug_meta_limit.js
 */
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function testAccount(c) {
    console.log(`\n--- ${c.name} | ${c.phone_number} ---`);
    console.log(`Phone ID: ${c.phone_number_id}`);
    const h = { Authorization: `Bearer ${c.meta_access_token}` };

    for (const ver of ['v25.0', 'v21.0', 'v20.0']) {
        try {
            const url = `https://graph.facebook.com/${ver}/${c.phone_number_id}?fields=quality_rating,whatsapp_business_manager_messaging_limit,status`;
            const { data } = await axios.get(url, { headers: h, timeout: 8000 });
            console.log(`${ver}: quality=${data.quality_rating} | limit=${data.whatsapp_business_manager_messaging_limit} | status=${data.status}`);
        } catch (e) {
            console.log(`${ver}: ERROR - ${e.response?.data?.error?.message || e.message}`);
        }
    }
}

async function run() {
    console.log('\n=== META LIMIT API VERSION TEST ===\n');
    const { data: configs } = await supabase
        .from('whatsapp_config')
        .select('id, name, phone_number, phone_number_id, meta_access_token')
        .limit(3);

    if (!configs?.length) { console.log('No configs.'); return; }
    for (const c of configs) await testAccount(c);
    console.log('\n=== DONE ===\n');
}
run().catch(console.error);
