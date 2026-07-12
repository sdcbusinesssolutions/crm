require('dotenv').config();
const axios = require('axios');

async function testCampaign() {
    const accessToken = process.env.META_ACCESS_TOKEN;
    const adAccountId = '4044804002323250';

    try {
        const apiVersion = 'v20.0';
        const baseUrl = `https://graph.facebook.com/${apiVersion}`;
        const res = await axios.post(`${baseUrl}/act_${adAccountId}/campaigns`, null, {
            params: {
                name: 'Test Campaign',
                objective: 'OUTCOME_ENGAGEMENT',
                status: 'PAUSED',
                special_ad_categories: '[]',
                is_adset_budget_sharing_enabled: false,
                access_token: accessToken
            }
        });
        console.log('Success:', res.data);
    } catch (error) {
        console.log('Error:', JSON.stringify(error.response?.data, null, 2));
    }
}

testCampaign();
