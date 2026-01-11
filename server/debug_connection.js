const axios = require('axios');

const ACCESS_TOKEN = 'EAAO4J3qeOYUBQUxV1p1UVztUylfN8EYDZCLIRVWprFpFwnqSCwbZC91ncLZCqnJZAsc5wVat4QxpZC8QnfdHBfYUieKnM2xLuqKpAAo8KYiInIiAVxr6EuUq8ZBuwu9jrXdRYcmCBDWA6hbBfyOitrYPNOosjlvLoDZCZAbnSQMslsEZAQbroJIrTrY5cQUVrd2Mms4wTJlbSIwiHl051';
const WEBHOOK_URL = 'https://unbronzed-parotic-sage.ngrok-free.dev/api/29770ec6-85a3-46d7-9f66-22027a14f2b7/878113728726536/webhook';
const VERIFY_TOKEN = '29770ec6-85a3-46d7-9f66-22027a14f2b7';
const PHONE_NUMBER_ID = '878113728726536';
const WABA_ID = '2266990200492928';

async function runTests() {
    console.log('=== STARTING DEBUG TESTS ===');

    // 1. Test Webhook Connectivity (GET Verification)
    console.log('\n1. Testing Webhook Verification (GET)...');
    try {
        const response = await axios.get(WEBHOOK_URL, {
            params: {
                'hub.mode': 'subscribe',
                'hub.verify_token': VERIFY_TOKEN,
                'hub.challenge': 'CHALLENGE_ACCEPTED'
            }
        });
        if (response.data == 'CHALLENGE_ACCEPTED') {
            console.log('✅ Webhook Verification SUCCESS');
        } else {
            console.error('❌ Webhook Verification FAILED. Expected challenge response, got:', response.data);
        }
    } catch (error) {
        console.error('❌ Webhook Verification ERROR:', error.message);
        if (error.response) console.error('   Status:', error.response.status, error.response.data);
    }

    // 2. Validate Access Token (Fetch Phone Numbers)
    console.log('\n2. Validating Access Token (Fetching Phone Numbers)...');
    try {
        const url = `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}`;
        const response = await axios.get(url, {
            params: {
                access_token: ACCESS_TOKEN,
                fields: 'display_phone_number,name_status,quality_rating'
            }
        });
        console.log('✅ Token is VALID. Phone Details:', response.data);
    } catch (error) {
        console.error('❌ Token Validation ERROR:', error.message);
        if (error.response) console.error('   Status:', error.response.status, error.response.data);
    }

    // 3. Check Subscribed Apps (Webhook configuration on Meta Side)
    console.log('\n3. Checking Subscribed Apps (Meta Webhook Config)...');
    try {
        const response = await axios.get(`https://graph.facebook.com/v21.0/${WABA_ID}/subscribed_apps`, {
            params: { access_token: ACCESS_TOKEN }
        });
        const apps = response.data.data;
        console.log('✅ Subscribed Apps RAW:', JSON.stringify(apps, null, 2));

        const myApp = apps.find(a => a.link || a.override_callback_uri || a.callback_url);
        // Note: Field names can vary slightly in different API versions or doc references, but usually it's just a list of apps.
        // The override URL might not be explicitly listed in GET /subscribed_apps for security, but seeing the app listed is step 1.
    } catch (error) {
        console.error('❌ Check Subscribed Apps ERROR:', error.message);
        if (error.response) console.error('   Status:', error.response.status, error.response.data);
    }

    // 4. Simulate Incoming Message (POST Webhook)
    console.log('\n4. Simulating Incoming Message (POST Webhook)...');
    try {
        const payload = {
            object: 'whatsapp_business_account',
            entry: [{
                id: WABA_ID,
                changes: [{
                    value: {
                        messaging_product: 'whatsapp',
                        metadata: {
                            display_phone_number: '1234567890',
                            phone_number_id: PHONE_NUMBER_ID
                        },
                        contacts: [{
                            profile: { name: 'Test User' },
                            wa_id: '919999999999'
                        }],
                        messages: [{
                            from: '919999999999',
                            id: 'wamid.TEST_MESSAGE_ID',
                            timestamp: Math.floor(Date.now() / 1000),
                            text: { body: 'Test Message from Debug Script' },
                            type: 'text'
                        }]
                    },
                    field: 'messages'
                }]
            }]
        };

        const response = await axios.post(WEBHOOK_URL, payload);
        console.log('✅ Webhook POST Simulation SUCCESS. Response:', response.data);
        console.log('   (Check server logs to see if it triggered Flow Engine)');
    } catch (error) {
        console.error('❌ Webhook POST Simulation ERROR:', error.message);
        if (error.response) console.error('   Status:', error.response.status, error.response.data);
    }

    console.log('\n=== TESTS COMPLETE ===');
}

runTests();
