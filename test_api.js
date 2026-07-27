const axios = require('axios');
require('dotenv').config({path: './server/.env'});
async function run() {
    const params = {
        fields: 'campaign_name,spend,gender',
        level: 'campaign',
        breakdowns: '["gender"]',
        date_preset: 'maximum',
        access_token: process.env.META_ACCESS_TOKEN
    };
    try {
        const res = await axios.get(`https://graph.facebook.com/v20.0/act_4044804002323250/insights`, { params });
        console.log(JSON.stringify(res.data, null, 2));
    } catch(e) {
        console.error(e.response?.data || e.message);
    }
}
run();
