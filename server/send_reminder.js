
const axios = require('axios');
const dbConfig = require('./config_dump.json');

async function sendReminder() {
    const phone_number_id = dbConfig.phone_number_id;
    const access_token = dbConfig.token;
    const meta_app_id = dbConfig.meta_app_id;
    const to = '918408907516';
    const templateName = 'reminder';
    const templateLang = 'en';

    console.log(`--- SENDING REMINDER VIA MM LITE (DB TOKEN) ---`);
    console.log(`To: ${to}`);

    const url = `https://graph.facebook.com/v21.0/${phone_number_id}/marketing_messages`;

    const payload = {
        messaging_product: 'whatsapp',
        to: to,
        type: 'template',
        template: {
            name: templateName,
            language: { code: templateLang },
            components: [
                {
                    type: "body",
                    parameters: [
                        { type: "text", text: "TestUser" }
                    ]
                }
            ]
        },
        solution_id: meta_app_id
    };

    try {
        const response = await axios.post(url, payload, {
            headers: { 'Authorization': `Bearer ${access_token}` }
        });
        console.log('✅ Send Success via MM Lite!');
        console.log('Response:', JSON.stringify(response.data, null, 2));
    } catch (err) {
        console.error('❌ Fail:', err.response?.data?.error?.message || err.message);
        if (err.response?.data) {
             console.error('Full Error:', JSON.stringify(err.response.data, null, 2));
        }
    }
}

sendReminder();
