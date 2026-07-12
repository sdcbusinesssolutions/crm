require('dotenv').config();
const axios = require('axios');

async function test() {
    const accessToken = process.env.META_ACCESS_TOKEN;
    try {
        const apiVersion = 'v20.0';
        const baseUrl = `https://graph.facebook.com/${apiVersion}`;
        const res = await axios.get(`${baseUrl}/me/adaccounts`, {
            params: {
                fields: 'id,name,account_id,currency',
                access_token: accessToken
            }
        });
        console.log('Success:', res.data.data);
    } catch (error) {
        console.log('Error:', error.response?.data);
    }
}

test();
