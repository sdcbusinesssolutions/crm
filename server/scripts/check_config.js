const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkConfigDetails() {
    const dupId = '712851615243145';
    const { data: configs } = await supabase
        .from('whatsapp_config')
        .select('*')
        .eq('phone_number_id', dupId);

    console.log('Configs for 712851615243145:');
    console.log(JSON.stringify(configs, null, 2));
}

checkConfigDetails();
