
const axios = require('axios');
const dbConfig = require('./config_dump.json');

async function sendNew() {
    const phone_number_id = dbConfig.phone_number_id;
    const access_token = dbConfig.token;
    const meta_app_id = dbConfig.meta_app_id;
    const to = '918408907516';
    const templateName = 'testim2';
    const templateLang = 'en_US';

    console.log(`--- SENDING NEW TEST VIA MM LITE (USING DB TOKEN) ---`);
    console.log(`Sender ID: ${phone_number_id}`);
    console.log(`Recipient: ${to}`);
    console.log(`Solution ID: ${meta_app_id}`);

    // MM Lite endpoint
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
                    type: "header",
                    parameters: [
                        {
                            type: "image",
                            image: { link: "https://images.unsplash.com/photo-1563013544-824ae1b704d3?q=80&w=1000&auto=format&fit=crop" }
                        }
                    ]
                },
                {
                    type: "body",
                    parameters: [
                        { type: "text", text: "REAL-DB-TOKEN-TEST" }
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
    }
}

sendNew();
