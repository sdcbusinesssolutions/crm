
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function checkIds() {
    const { data, error } = await supabaseAdmin
        .from('onboarding_settings')
        .select('embedded_enabled, embedded_app_id, embedded_config_id')
        .eq('user_id', 'system')
        .single();

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Settings:', JSON.stringify(data, null, 2));
    }
}

checkIds();
