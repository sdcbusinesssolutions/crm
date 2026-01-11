require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Error: SUPABASE_URL or SUPABASE_SERVICE_KEY not set in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const GRAPH_API_VERSION = 'v18.0';
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

async function main() {
    console.log('--- Meta Configuration Debugger ---');

    try {
        // 1. Fetch Any User Config from DB (Since we don't know the exact UUID for 'system' or the active user)
        console.log('1. Fetching Configuration...');
        const { data: config, error } = await supabase
            .from('whatsapp_config')
            .select('*')
            .not('meta_access_token', 'is', null)
            .limit(1)
            .maybeSingle();

        if (error) throw error;

        let accessToken = config?.meta_access_token;

        // Fallback: Check if there's *any* config if system is not found (for dev/local setups)
        if (!accessToken) {
            console.log('   "system" user config not found. Checking for ANY configured user...');
            const { data: anyConfig } = await supabase
                .from('whatsapp_config')
                .select('*')
                .limit(1)
                .maybeSingle();

            if (anyConfig) {
                console.log(`   Found config for user: ${anyConfig.user_id}`);
                accessToken = anyConfig.meta_access_token;
            }
        }

        if (!accessToken) {
            console.error('❌ No Access Token found in database.');
            process.exit(1);
        }

        console.log('   ✅ Access Token retrieved.');

        // 1b. Fetch App Credentials for Debugging
        const { data: appSettings } = await supabase
            .from('onboarding_settings')
            .select('embedded_app_id, embedded_app_secret')
            .limit(1)
            .maybeSingle();

        let debugAccessToken = accessToken; // Default to self-debug
        if (appSettings && appSettings.embedded_app_id && appSettings.embedded_app_secret) {
            console.log('   ✅ App Credentials found. Using App Token for debugging.');
            debugAccessToken = `${appSettings.embedded_app_id}|${appSettings.embedded_app_secret}`;
        } else {
            console.warn('   ⚠️ App Credentials not found. Trying self-debug (might fail).');
        }

        // 2. Debug Token (Get App ID and Scopes)
        console.log('\n2. Debugging Access Token...');
        const debugResponse = await axios.get(`${GRAPH_URL}/debug_token`, {
            params: {
                input_token: accessToken,
                access_token: debugAccessToken
            }
        });

        const debugData = debugResponse.data.data;
        console.log(`   App ID: ${debugData.app_id}`);
        console.log(`   Type: ${debugData.type}`);
        console.log(`   Valid: ${debugData.is_valid}`);
        console.log(`   Expires At: ${debugData.expires_at === 0 ? 'Never (Permanent)' : new Date(debugData.expires_at * 1000).toLocaleString()}`);
        console.log(`   Scopes: ${JSON.stringify(debugData.scopes)}`);

        // 3. Fetch WABA Information
        console.log('\n3. Fetching WABAs...');
        const meResponse = await axios.get(`${GRAPH_URL}/me`, {
            params: {
                fields: 'id,name,whatsapp_business_accounts{id,name,currency,timezone_id,message_templates}',
                access_token: accessToken
            }
        });

        const userData = meResponse.data;
        console.log(`   User Name: ${userData.name} (ID: ${userData.id})`);

        const wabas = userData.whatsapp_business_accounts?.data || [];
        console.log(`   Found ${wabas.length} WABA(s).`);

        if (wabas.length === 0) {
            console.warn('   ⚠️ No WABAs found linked to this account.');
        }

        // 4. Fetch Phone Numbers for each WABA
        for (const waba of wabas) {
            console.log(`\n   ------------------------------------------------`);
            console.log(`   WABA Name: ${waba.name}`);
            console.log(`   WABA ID: ${waba.id}`);
            console.log(`   Currency: ${waba.currency}`);
            console.log(`   Timezone: ${waba.timezone_id}`);

            console.log(`   Fetching Phone Numbers...`);
            try {
                const phoneResponse = await axios.get(`${GRAPH_URL}/${waba.id}/phone_numbers`, {
                    params: {
                        access_token: accessToken,
                        fields: 'id,display_phone_number,verified_name,code_verification_status,quality_rating,platform_type'
                    }
                });

                const phones = phoneResponse.data.data || [];
                if (phones.length === 0) {
                    console.log('      No phone numbers found.');
                }

                for (const phone of phones) {
                    console.log(`      > Phone Number: ${phone.display_phone_number}`);
                    console.log(`        Phone ID: ${phone.id}`);
                    console.log(`        Verified Name: ${phone.verified_name}`);
                    console.log(`        Status: ${phone.code_verification_status}`);
                    console.log(`        Quality: ${phone.quality_rating}`);
                    console.log(`        Platform: ${phone.platform_type}`);
                }

            } catch (err) {
                console.error(`      ❌ Failed to fetch phone numbers: ${err.message}`);
                // console.error(err.response?.data);
            }
        }
        console.log(`\n   ------------------------------------------------`);

    } catch (err) {
        console.error('\n❌ Error:', err.message);
        if (err.response) {
            console.error('Response Data:', JSON.stringify(err.response.data, null, 2));
        }
    }
}

main();
