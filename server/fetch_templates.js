
const axios = require('axios');

async function fetchTemplates() {
    const waba_id = '1259751162341004';
    const meta_access_token = 'EAAO4J3qeOYUBQULZBn4HNithiWfjp0X4qjwaC04xV9hmwq9AOAG4XSQnxuAvyiQ11eVkCosPVRp5VzUvMVNoOH3sVUP1ucGGJsUKIQCZAZBa6xSr6FGWMAfITzCCARQHVP01mtnL14om8Y1CmiJlPZAPv6AcY1yVN4pch9dWLnRGMSPSGLKSrQ29QNS2';

    console.log(`--- FETCHING TEMPLATES FOR WABA: ${waba_id} ---`);

    const url = `https://graph.facebook.com/v21.0/${waba_id}/message_templates`;

    try {
        const response = await axios.get(url, {
            headers: { 'Authorization': `Bearer ${meta_access_token}` },
            params: { limit: 10 }
        });
        console.log('✅ Templates fetched successfully:');
        response.data.data.forEach(t => {
            console.log(`- ${t.name} (${t.language}, ${t.status}) [${t.category}]`);
        });
    } catch (err) {
        console.error('❌ Failed to fetch templates:', err.response?.data?.error?.message || err.message);
    }
}

fetchTemplates();
