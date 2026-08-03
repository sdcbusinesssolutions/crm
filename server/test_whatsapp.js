const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dndmbarbnsdlbclghkbs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRuZG1iYXJibnNkbGJjbGdoa2JzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQ4MjMxMywiZXhwIjoyMDk0MDU4MzEzfQ.kGyOt8oA0FfR_zXRJjK0lAzSTNKX3f6cK6b_wPmChxI';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    const { data } = await supabase.from('whatsapp_config').select('meta_access_token').not('meta_access_token', 'is', null).limit(1);
    if (!data || data.length === 0) return console.log('No token');
    const token = data[0].meta_access_token;
    
    try {
        const pagesRes = await axios.get(`https://graph.facebook.com/v20.0/me/accounts?fields=id,name,whatsapp_number,has_whatsapp_number,whatsapp_business_account&access_token=${token}`);
        console.log(JSON.stringify(pagesRes.data, null, 2));
    } catch (e) {
        console.error(e.response ? e.response.data : e.message);
    }
}
test();
