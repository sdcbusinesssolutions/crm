
const axios = require('axios');
require('dotenv').config();

async function proofSend() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    const phoneNumber = '917559410321';
    const templateName = 'devk';

    console.log(`--- PROOF OF SENDING (MM LITE API) ---`);
    console.log(`Using Supabase: ${supabaseUrl}`);
    console.log(`Target Phone: ${phoneNumber}`);
    console.log(`Template: ${templateName}`);

    // Load WhatsApp Config from Database
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log(`Connecting to Supabase...`);
    
    const { data: configs, error } = await supabase
        .from('whatsapp_config')
        .select('*')
        .ilike('phone_number', `%${phoneNumber}%`);

    if (error) {
        console.error('❌ Supabase Query Error:', error.message);
        return;
    }
    if (!configs || configs.length === 0) {
        console.error('❌ Config not found for number:', phoneNumber);
        return;
    }

    const config = configs[0];
    const { phone_number_id, meta_access_token } = config;
    console.log(`✅ Found Phone ID: ${phone_number_id}`);

    // Call WhatsApp API (MM Lite Style - marketing_messages endpoint)
    // Based on the FIX we made in whatsappService.js
    const baseUrl = 'https://graph.facebook.com/v25.0';
    const url = `${baseUrl}/${phone_number_id}/marketing_messages`;
    
    console.log(`Calling Meta API: ${url}...`);

    const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phoneNumber,
        type: 'template',
        template: {
            name: templateName,
            language: { code: 'en' }
        }
    };

    try {
        const response = await axios.post(url, payload, {
            headers: { 'Authorization': `Bearer ${meta_access_token}`, 'Content-Type': 'application/json' }
        });
        console.log('✅ Proof Success! API Response data:', JSON.stringify(response.data, null, 2));
    } catch (err) {
        console.error('❌ Proof Failed:', err.response?.data?.error?.message || err.message);
        if (err.response?.data) console.error('Full Error:', JSON.stringify(err.response.data, null, 2));
    }
}

proofSend();
