const { supabaseAdmin } = require('./lib/supabaseClient');

async function printUserDetails() {
    const userId = '9e9ffbac-eef2-4f9c-9aa1-8a365a4b85d7';
    
    const { data: userRecord } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
        
    console.log('User Record:', userRecord);
    
    // Let's also check if there is a 'domain' or something in system_settings
    const { data: sysSettings } = await supabaseAdmin
        .from('system_settings')
        .select('*')
        .eq('user_id', userId)
        .single();
        
    console.log('System Settings:', sysSettings);
}

printUserDetails();
