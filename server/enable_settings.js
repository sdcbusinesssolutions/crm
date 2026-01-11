
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function enableSettings() {
    const { data, error } = await supabaseAdmin
        .from('onboarding_settings')
        .update({ embedded_enabled: true })
        .eq('user_id', 'system')
        .select();

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Updated Settings:', JSON.stringify(data, null, 2));
    }
}

enableSettings();
