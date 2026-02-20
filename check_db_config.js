const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'server/.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkConfig() {
    const { data, error } = await supabase
        .from('whatsapp_config')
        .select('*');

    if (error) {
        console.error(error);
        return;
    }

    console.log(`Found ${data.length} configs.`);
    data.forEach(c => {
        console.log(`User: ${c.user_id}, PhoneId: ${c.phone_number_id}, TokenPrefix: ${c.access_token ? c.access_token.substring(0, 10) : 'NONE'}`);
    });
}

checkConfig();
