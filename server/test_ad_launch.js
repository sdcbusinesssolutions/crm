require('dotenv').config();
const axios = require('axios');

async function testLaunch() {
    const accessToken = process.env.META_ACCESS_TOKEN;
    const adAccountId = '4044804002323250';
    const imageUrl = 'https://cloudospire.in/logo.png'; // dummy url

    try {
        const apiVersion = 'v20.0';
        const baseUrl = `https://graph.facebook.com/${apiVersion}`;
        const res = await axios.post(`${baseUrl}/act_${adAccountId}/adimages`, null, {
            params: {
                url: imageUrl,
                access_token: accessToken
            }
        });
        console.log('Success:', res.data);
    } catch (error) {
        console.log('Error:', error.response?.data);
    }
}

testLaunch();
