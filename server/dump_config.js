
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function findConfig() {
    const supabaseUrl = "https://ssckorsnhjhzqxyukexm.supabase.co";
    const supabaseServiceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzY2tvcnNuaGpoenF4eXVrZXhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODM5OTcwOSwiZXhwIjoyMDgzOTc1NzA5fQ.aNUZx09EwkA4tEmHRK-LL4l-J6ySioqTY3c9PcQCJHc";
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const targetNumber = '9429793144';

    const { data: configs } = await supabase.from('whatsapp_config').select('*');
    const found = configs.find(c => (c.phone_number || '').replace(/\D/g, '').includes(targetNumber));

    if (found) {
        fs.writeFileSync('config_dump.json', JSON.stringify({
            phone_number_id: found.phone_number_id,
            waba_id: found.whatsapp_business_account_id,
            meta_app_id: found.meta_app_id,
            token: found.meta_access_token
        }, null, 2));
        console.log('✅ Config dumped to config_dump.json');
    } else {
        console.log('❌ Not found');
    }
}

findConfig();
