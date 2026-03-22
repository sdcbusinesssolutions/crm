
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

async function testAll() {
    const supabaseUrl = "https://ssckorsnhjhzqxyukexm.supabase.co";
    const supabaseServiceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzY2tvcnNuaGpoenF4eXVrZXhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODM5OTcwOSwiZXhwIjoyMDgzOTc1NzA5fQ.aNUZx09EwkA4tEmHRK-LL4l-J6ySioqTY3c9PcQCJHc";
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: configs } = await supabase.from('whatsapp_config').select('*').limit(3);

    for (const c of configs) {
        console.log(`Checking ${c.phone_number}...`);
        try {
            const res = await axios.get(`https://graph.facebook.com/v21.0/me?access_token=${c.meta_access_token}`);
            console.log(`✅ Success for ${c.phone_number}: ${res.data.id}`);
        } catch (err) {
            console.error(`❌ Fail for ${c.phone_number}:`, err.response?.data?.error?.message || err.message);
        }
    }
}

testAll();
