
const axios = require('axios');

async function debugFirstToken() {
    const access_token = 'EAAO4J3qeOYUBQULZBn4HNithiWfjp0X4qjwaC04xV9hmwq9AOAG4XSQnxuAvyiQ11eVkCosPVRp5VzUvMVNoOH3sVUP1ucGGJsUKIQCZAZBa6xSr6FGWMAfITzCCARQHVP01mtnL14om8Y1CmiJlPZAPv6AcY1yVN4pch9dWLnRGMSPSGLKSrQ29QNS2';
    
    try {
        const response = await axios.get(`https://graph.facebook.com/v21.0/app?access_token=${access_token}`);
        console.log('✅ Token App ID:', response.data.id);
        console.log('✅ Token App Name:', response.data.name);
    } catch (err) {
        console.error('❌ Fail:', err.response?.data?.error?.message || err.message);
    }
}

debugFirstToken();
