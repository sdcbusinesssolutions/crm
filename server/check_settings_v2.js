
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSettings() {
    console.log('Checking onboarding_settings for user_id = system...');
    const { data, error } = await supabase
        .from('onboarding_settings')
        .select('*')
        .eq('user_id', 'system')
        .single();

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Embedded Enabled:', data.embedded_enabled);
        console.log('App ID:', data.embedded_app_id);
    }
}

checkSettings();
