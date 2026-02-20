const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'server/.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testDownload() {
    const mediaId = '1468225058050104';
    const userId = '77009036-af89-49f7-a16b-de652950a7d1';

    // Get Access Token directly from DB
    const { data: configs } = await supabase
        .from('whatsapp_config')
        .select('access_token')
        .eq('user_id', userId)
        .eq('phone_number_id', '850356761502552');

    if (!configs || configs.length === 0 || !configs[0].access_token) {
        console.error('Failed to get access token');
        return;
    }
    const accessToken = configs[0].access_token;
    console.log('Got Access Token:', accessToken.slice(0, 15) + '...');

    const https = require('https');

    let urlData;
    try {
        const urlResponse = await axios.get(`https://graph.facebook.com/v21.0/${mediaId}`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        urlData = urlResponse.data;
        console.log('Metadata URL found:', urlData.url ? urlData.url.substring(0, 80) + '...' : 'NONE');
    } catch (e) {
        console.error('Metadata Fetch Failed:', e.message);
        return;
    }

    if (!urlData.url) return;

    // Test different configs
    const configsToTest = [
        {
            name: 'Standard (Just Auth)',
            headers: { 'Authorization': `Bearer ${accessToken}` }
        },
        {
            name: 'No Auth, KeepAlive False',
            headers: { 'User-Agent': 'curl/7.81.0' },
            httpsAgent: new https.Agent({ keepAlive: false })
        },
        {
            name: 'Auth, UserAgent, Accept, KeepAlive False',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'User-Agent': 'curl/7.81.0',
                'Accept': '*/*'
            },
            httpsAgent: new https.Agent({ keepAlive: false })
        },
        {
            name: 'Auth, UserAgent, KeepAlive True',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'User-Agent': 'Mozilla/5.0'
            },
            httpsAgent: new https.Agent({ keepAlive: true })
        }
    ];

    for (const conf of configsToTest) {
        console.log(`\n--- Testing Config: ${conf.name} ---`);
        try {
            const reqConfig = {
                headers: conf.headers,
                responseType: 'arraybuffer',
                timeout: 10000,
                maxBodyLength: Infinity,
                maxContentLength: Infinity
            };
            if (conf.httpsAgent) reqConfig.httpsAgent = conf.httpsAgent;

            const res = await axios.get(urlData.url, reqConfig);
            console.log(`SUCCESS! Status: ${res.status}, Size: ${res.data.byteLength} bytes`);
        } catch (e) {
            console.error(`FAILED: ${e.message}`);
            if (e.response) {
                console.log(`Status: ${e.response.status}`);
            }
        }
    }
}
testDownload();
