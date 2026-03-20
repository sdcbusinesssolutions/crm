require('dotenv').config();
const { supabaseAdmin } = require('./lib/supabaseClient');
const whatsappService = require('./services/whatsappService');

async function testSend() {
    const phoneNumber = '917559410321';
    console.log(`Searching for config for ${phoneNumber}...`);
    
    const { data: configs, error } = await supabaseAdmin
        .from('whatsapp_config')
        .select('*')
        .ilike('phone_number', `%${phoneNumber}%`);

    if (error || !configs || configs.length === 0) {
        console.error('Config not found:', error || 'No matching record');
        return;
    }

    const config = configs[0];
    const userId = config.user_id;
    const fromPhoneId = config.phone_number_id;

    console.log(`Found config. User: ${userId}, Phone ID: ${fromPhoneId}`);

    const to = phoneNumber;
    const templateName = 'devk';
    
    console.log(`Sending template '${templateName}' to ${to}...`);

    try {
        const result = await whatsappService.sendMessage(userId, to, 'template', {
            name: templateName,
            language: { code: 'en' }, // Adjust if needed
            category: 'MARKETING'     // Force MM Lite logic
        }, fromPhoneId);

        console.log('✅ Success! Result:', JSON.stringify(result, null, 2));
    } catch (err) {
        console.error('❌ Failed:', err.message);
        if (err.response) console.error('Response:', JSON.stringify(err.response.data, null, 2));
    }
}

testSend();
