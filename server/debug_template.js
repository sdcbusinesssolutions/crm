require('dotenv').config();
const axios = require('axios');

async function debug() {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

    if (!token || !phoneId) {
        console.error('Missing Env Vars');
        return;
    }

    const TEMPLATE_NAME = 'testwhatform';

    console.log('--- FETCHING TEMPLATE DEFINITION FROM META ---');
    try {
        const res = await axios.get(`https://graph.facebook.com/v17.0/${wabaId}/message_templates`, {
            params: { name: TEMPLATE_NAME },
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const tmpl = res.data.data.find(t => t.name === TEMPLATE_NAME && t.language === 'en_US');
        if (tmpl) {
            console.log(JSON.stringify(tmpl, null, 2));

            console.log('\n--- ANALYZING STRUCTURE ---');
            tmpl.components.forEach((c, i) => {
                console.log(`Index ${i}: TYPE=${c.type}, FORMAT=${c.format || 'N/A'}`);
            });
        } else {
            console.log('Template not found via API');
        }

    } catch (e) {
        console.error('Fetch Error:', e.message);
        if (e.response) console.error(JSON.stringify(e.response.data, null, 2));
    }
}

debug();
