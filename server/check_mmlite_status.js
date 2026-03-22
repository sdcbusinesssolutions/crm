
const axios = require('axios');

async function checkStatus() {
    const waba_id = '1259751162341004';
    const phone_id = '712851615243145';
    const meta_access_token = 'EAAO4J3qeOYUBQULZBn4HNithiWfjp0X4qjwaC04xV9hmwq9AOAG4XSQnxuAvyiQ11eVkCosPVRp5VzUvMVNoOH3sVUP1ucGGJsUKIQCZAZBa6xSr6FGWMAfITzCCARQHVP01mtnL14om8Y1CmiJlPZAPv6AcY1yVN4pch9dWLnRGMSPSGLKSrQ29QNS2';

    const url = `https://graph.facebook.com/v25.0/${waba_id}`;

    try {
        const response = await axios.get(url, {
            params: {
                access_token: meta_access_token,
                fields: 'id,marketing_messages_onboarding_status,marketing_messages_lite_api_status'
            }
        });
        console.log('--- MM LITE STATUS ---');
        console.log(JSON.stringify(response.data, null, 2));

        const phoneUrl = `https://graph.facebook.com/v25.0/${phone_id}`;
        const phoneRes = await axios.get(phoneUrl, {
            params: {
                access_token: meta_access_token,
                fields: 'id,marketing_messages_onboarding_status,marketing_messages_lite_api_status'
            }
        });
        console.log('--- PHONE STATUS ---');
        console.log(JSON.stringify(phoneRes.data, null, 2));
    } catch (err) {
        console.error('ERROR:', err.response?.data || err.message);
    }
}

checkStatus();
