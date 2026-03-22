const { supabaseAdmin } = require('./lib/supabaseClient');

async function check() {
    console.log('Checking onboarding_settings...');
    const { data, error } = await supabaseAdmin
        .from('onboarding_settings')
        .select('*');
    
    if (error) {
        console.error('Error fetching settings:', error);
        return;
    }
    
    if (data.length === 0) {
        console.log('No onboarding settings found in database.');
    } else {
        console.log('Found Settings:');
        console.log(JSON.stringify(data, null, 2));
    }
}

check();
