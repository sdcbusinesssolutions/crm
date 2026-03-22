
const { createClient } = require('@supabase/supabase-js');

async function findConfig() {
    const supabaseUrl = "https://ssckorsnhjhzqxyukexm.supabase.co";
    const supabaseServiceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzY2tvcnNuaGpoenF4eXVrZXhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODM5OTcwOSwiZXhwIjoyMDgzOTc1NzA5fQ.aNUZx09EwkA4tEmHRK-LL4l-J6ySioqTY3c9PcQCJHc";
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const targetNumber = '9429793144';

    console.log(`Searching for config for: ${targetNumber}...`);

    const { data: configs, error } = await supabase
        .from('whatsapp_config')
        .select('*');

    if (error) {
        console.error('Error fetching configs:', error.message);
        return;
    }

    const found = configs.find(c => {
        const cleanPhone = (c.phone_number || '').replace(/\D/g, '');
        return cleanPhone.includes(targetNumber);
    });

    if (found) {
        console.log('✅ Found Configuration:');
        console.log(JSON.stringify({
            id: found.id,
            phone_number: found.phone_number,
            phone_number_id: found.phone_number_id,
            whatsapp_business_account_id: found.whatsapp_business_account_id,
            meta_app_id: found.meta_app_id,
            meta_access_token: found.meta_access_token ? found.meta_access_token.substring(0, 15) + '...' : 'MISSING'
        }, null, 2));
        
        // Output full token for internal use
        console.log('\n--- FULL TOKEN ---');
        console.log(found.meta_access_token);
    } else {
        console.log('❌ No configuration found for this number.');
    }
}

findConfig();
