const axios = require('axios');
async function test() {
    const accessToken = 'EAAialqCpZCtoBR4apZBo0hiPscszflZAyLBxjsHXLBtQcFzXZC3pNxfEC47oCRvvbbNBOn3CY53deNYLd1y62dEKtcQSI2TF74QGx5QfvqffmHXa9TwxPvoePvCLvbq2d0bcMDF6n6C4ius02ZBaJczZCnuJVjKsF9WimeloVoX9DSREqubOlruet6KTNcJzpYewZDZD';
    const adAccountId = '4044804002323250';
    try {
        const campaignRes = await axios.post(`https://graph.facebook.com/v20.0/act_${adAccountId}/campaigns`, null, {
            params: {
                name: 'Test Campaign 123',
                objective: 'OUTCOME_LEADS',
                status: 'PAUSED',
                special_ad_categories: '["NONE"]',
                access_token: accessToken
            }
        });
        const campaignId = campaignRes.data.id;
        console.log('Campaign ID:', campaignId);

        const adSetRes = await axios.post(`https://graph.facebook.com/v20.0/act_${adAccountId}/adsets`, null, {
            params: {
                name: 'Test Ad Set 123',
                campaign_id: campaignId,
                daily_budget: 10000,
                billing_event: 'IMPRESSIONS',
                optimization_goal: 'CONVERSATIONS',
                bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
                is_adset_budget_sharing_enabled: false,
                destination_type: 'WHATSAPP',
                promoted_object: JSON.stringify({ page_id: '123' }), // dummy page
                targeting: JSON.stringify({ geo_locations: { countries: ['US'] }, age_min: 18, age_max: 65 }),
                status: 'PAUSED',
                access_token: accessToken
            }
        });
        console.log('AdSet ID:', adSetRes.data.id);
    } catch (err) {
        console.error('Error:', JSON.stringify(err.response?.data, null, 2));
    }
}
test();
