const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'server/.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function testDownload() {
    const mediaId = '1468225058050104';
    const userId = '77009036-af89-49f7-a16b-de652950a7d1';

    console.log(`Testing download for MediaId: ${mediaId}, User: ${userId}`);

    // 1. Get Access Token
    const { data: config } = await supabase.rpc('get_whatsapp_config', {
        p_user_id: userId,
        p_phone_number_id: '850356761502552'
    });

    if (!config || !config.access_token) {
        console.error('Failed to get access token');
        return;
    }
    const accessToken = config.access_token;

    // 2. Fetch Metadata
    console.log('Step 1: Fetching Metadata URL...');
    let urlData;
    try {
        const urlResponse = await axios.get(`https://graph.facebook.com/v21.0/${mediaId}`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        urlData = urlResponse.data;
        console.log('Metadata URL found:', urlData.url ? urlData.url.substring(0, 60) + '...' : 'NONE');
    } catch (e) {
        console.error('Metadata Fetch Failed:', e.message);
        return;
    }

    if (!urlData.url) return;

    // 3. Test Binary Download with various configurations
    const configs = [
        { name: 'Standard (with Auth)', headers: { 'Authorization': `Bearer ${accessToken}`, 'User-Agent': 'Mozilla/5.0' } },
        { name: 'No Auth Header', headers: { 'User-Agent': 'Mozilla/5.0' } },
        {
            name: 'Browser-like', headers: {
                'Authorization': `Bearer ${accessToken}`,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Accept': '*/*'
            }
        }
    ];

    for (const conf of configs) {
        console.log(`\n--- Testing Config: ${conf.name} ---`);
        try {
            const res = await axios.get(urlData.url, {
                headers: conf.headers,
                responseType: 'arraybuffer',
                timeout: 10000,
                proxy: false
            });
            console.log(`SUCCESS! Status: ${res.status}, Size: ${res.data.byteLength} bytes`);
        } catch (e) {
            console.error(`FAILED: ${e.message}`);
            if (e.response) {
                console.log(`Status: ${e.response.status}, Data: ${e.response.data.toString().substring(0, 100)}`);
            }
        }
    }
}

testDownload();
