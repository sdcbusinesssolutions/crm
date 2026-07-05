const axios = require('axios');

async function testCampaign() {
    const accessToken = 'EAAialqCpZCtoBR4apZBo0hiPscszflZAyLBxjsHXLBtQcFzXZC3pNxfEC47oCRvvbbNBOn3CY53deNYLd1y62dEKtcQSI2TF74QGx5QfvqffmHXa9TwxPvoePvCLvbq2d0bcMDF6n6C4ius02ZBaJczZCnuJVjKsF9WimeloVoX9DSREqubOlruet6KTNcJzpYewZDZD';
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
