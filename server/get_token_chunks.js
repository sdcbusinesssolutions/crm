
const { createClient } = require('@supabase/supabase-js');

async function findConfig() {
    const supabaseUrl = "https://ssckorsnhjhzqxyukexm.supabase.co";
    const supabaseServiceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzY2tvcnNuaGpoenF4eXVrZXhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODM5OTcwOSwiZXhwIjoyMDgzOTc1NzA5fQ.aNUZx09EwkA4tEmHRK-LL4l-J6ySioqTY3c9PcQCJHc";
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const targetNumber = '9429793144';

    const { data: configs } = await supabase.from('whatsapp_config').select('*');
    const found = configs.find(c => (c.phone_number || '').replace(/\D/g, '').includes(targetNumber));

    if (found) {
        console.log('CONFIG_ID=' + found.id);
        console.log('PHONE_ID=' + found.phone_number_id);
        console.log('WABA_ID=' + found.whatsapp_business_account_id);
        console.log('APP_ID=' + found.meta_app_id);
        
        const token = found.meta_access_token;
        for (let i = 0; i < token.length; i += 100) {
            console.log('TOKEN_CHUNK=' + token.substring(i, i + 100));
        }
    } else {
        console.log('NOT_FOUND');
    }
}

findConfig();
