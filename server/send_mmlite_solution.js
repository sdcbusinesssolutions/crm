
const axios = require('axios');

async function sendMMLite() {
    const phone_number_id = '712851615243145';
    const meta_access_token = 'EAAO4J3qeOYUBQULZBn4HNithiWfjp0X4qjwaC04xV9hmwq9AOAG4XSQnxuAvyiQ11eVkCosPVRp5VzUvMVNoOH3sVUP1ucGGJsUKIQCZAZBa6xSr6FGWMAfITzCCARQHVP01mtnL14om8Y1CmiJlPZAPv6AcY1yVN4pch9dWLnRGMSPSGLKSrQ29QNS2';
    const meta_app_id = '1046904630557061'; // Used as solution_id
    const to = '910000000000';
    const templateName = 'devk'; 
    const templateLang = 'en_US'; 

    console.log(`--- SENDING VIA MM LITE (marketing_messages endpoint) ---`);
    console.log(`From Phone ID: ${phone_number_id}`);
    console.log(`To: ${to}`);
    console.log(`Template: ${templateName} (${templateLang})`);
    console.log(`Solution ID: ${meta_app_id}`);

    // MM Lite uses the /marketing_messages endpoint
    const baseUrl = 'https://graph.facebook.com/v21.0'; 
    const url = `${baseUrl}/${phone_number_id}/marketing_messages`;

    const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to,
        type: 'template',
        template: {
            name: templateName,
            language: { code: templateLang }
        },
        solution_id: meta_app_id // Partner attribution
    };

    try {
        const response = await axios.post(url, payload, {
            headers: { 
                'Authorization': `Bearer ${meta_access_token}`, 
                'Content-Type': 'application/json' 
            }
        });
        console.log('✅ Message Sent Successfully via MM Lite with Solution ID!');
        console.log('Response:', JSON.stringify(response.data, null, 2));
    } catch (err) {
        console.error('❌ Failed to send via MM Lite:', err.response?.data?.error?.message || err.message);
        if (err.response?.data) {
            console.error('Full Error Details:', JSON.stringify(err.response.data, null, 2));
        }
    }
}

sendMMLite();
