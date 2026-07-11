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
        // Step 1: Get Businesses
        const bizRes = await axios.get(`https://graph.facebook.com/v20.0/me/businesses?access_token=${token}`);
        const businesses = bizRes.data.data;
        console.log("Businesses:", JSON.stringify(businesses, null, 2));
        
        if (businesses.length > 0) {
            const bizId = businesses[0].id;
            // Step 2: Get WABAs
            const wabaRes = await axios.get(`https://graph.facebook.com/v20.0/${bizId}/owned_whatsapp_business_accounts?access_token=${token}`);
            const wabas = wabaRes.data.data;
            console.log("WABAs:", JSON.stringify(wabas, null, 2));
            
            if (wabas.length > 0) {
                // Step 3: Get Phone Numbers
                const wabaId = wabas[0].id;
                const phoneRes = await axios.get(`https://graph.facebook.com/v20.0/${wabaId}/phone_numbers?access_token=${token}`);
                console.log("Phone Numbers:", JSON.stringify(phoneRes.data.data, null, 2));
            }
        }
    } catch (e) {
        console.error(e.response ? e.response.data : e.message);
    }
}
test();
