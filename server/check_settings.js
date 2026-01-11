
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSettings() {
    const { data, error } = await supabase
        .from('onboarding_settings')
        .select('*')
        .eq('user_id', 'system');

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Onboarding Settings:', JSON.stringify(data, null, 2));
    }
}

checkSettings();
