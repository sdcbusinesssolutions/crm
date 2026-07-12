require('dotenv').config();
const axios = require('axios');
async function test() {
    const accessToken = process.env.META_ACCESS_TOKEN;
    const adAccountId = '4044804002323250';
    try {
        const campaignRes = await axios.post(`https://graph.facebook.com/v20.0/act_${adAccountId}/campaigns`, null, {
            params: {
                name: 'Test Campaign Final',
                objective: 'OUTCOME_LEADS',
                status: 'PAUSED',
                special_ad_categories: '["NONE"]',
                is_adset_budget_sharing_enabled: false,
                access_token: accessToken
            }
        });
        const campaignId = campaignRes.data.id;
        console.log('Campaign created:', campaignId);

        const adSetRes = await axios.post(`https://graph.facebook.com/v20.0/act_${adAccountId}/adsets`, null, {
            params: {
                name: 'Test Ad Set Final',
                campaign_id: campaignId,
                daily_budget: 10000,
                billing_event: 'IMPRESSIONS',
                optimization_goal: 'CONVERSATIONS',
                bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
                is_adset_budget_sharing_enabled: false,
                destination_type: 'WHATSAPP',
                promoted_object: JSON.stringify({ page_id: '123' }), // dummy
                targeting: JSON.stringify({ geo_locations: { countries: ['US'] }, age_min: 18, age_max: 65 }),
                status: 'PAUSED',
                access_token: accessToken
            }
        });
        console.log('AdSet created:', adSetRes.data.id);
    } catch (err) {
        console.error('Error:', JSON.stringify(err.response?.data, null, 2));
    }
}
test();
