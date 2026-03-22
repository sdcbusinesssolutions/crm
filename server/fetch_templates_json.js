
const axios = require('axios');

async function fetchTemplates() {
    const waba_id = '1259751162341004';
    const meta_access_token = 'EAAO4J3qeOYUBQULZBn4HNithiWfjp0X4qjwaC04xV9hmwq9AOAG4XSQnxuAvyiQ11eVkCosPVRp5VzUvMVNoOH3sVUP1ucGGJsUKIQCZAZBa6xSr6FGWMAfITzCCARQHVP01mtnL14om8Y1CmiJlPZAPv6AcY1yVN4pch9dWLnRGMSPSGLKSrQ29QNS2';

    const url = `https://graph.facebook.com/v21.0/${waba_id}/message_templates`;

    try {
        const response = await axios.get(url, {
            headers: { 'Authorization': `Bearer ${meta_access_token}` },
            params: { limit: 100 }
        });
        const templateNames = response.data.data.map(t => t.name);
        console.log('TEMPLATES_START');
        console.log(JSON.stringify(templateNames));
        console.log('TEMPLATES_END');
    } catch (err) {
        console.error('ERROR:', err.response?.data || err.message);
    }
}

fetchTemplates();
