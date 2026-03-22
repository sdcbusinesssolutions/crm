
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

async function testTarget() {
    const supabaseUrl = "https://ssckorsnhjhzqxyukexm.supabase.co";
    const supabaseServiceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzY2tvcnNuaGpoenF4eXVrZXhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODM5OTcwOSwiZXhwIjoyMDgzOTc1NzA5fQ.aNUZx09EwkA4tEmHRK-LL4l-J6ySioqTY3c9PcQCJHc";
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: configs } = await supabase.from('whatsapp_config').select('*');
    
    const targetConfig = configs.find(c => (c.phone_number || '').replace(/\D/g, '').includes('9429793144'));
    
    if (targetConfig) {
        console.log(`Checking TARGET: ${targetConfig.phone_number}...`);
        try {
            const res = await axios.get(`https://graph.facebook.com/v21.0/me?access_token=${targetConfig.meta_access_token}`);
            console.log(`✅ Success: ${res.data.id} (${res.data.name})`);
        } catch (err) {
            console.error(`❌ Fail:`, err.response?.data?.error?.message || err.message);
        }
    } else {
        console.log('TARGET NOT FOUND IN DB');
    }
}

testTarget();
