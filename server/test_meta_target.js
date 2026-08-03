const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function test() {
    const { data } = await supabase.from('whatsapp_config').select('meta_access_token').not('meta_access_token', 'is', null).limit(1);
    const token = data[0].meta_access_token;
    
    try {
        console.log("\nTesting type=adinterest with q=engaged");
        let res = await axios.get(`https://graph.facebook.com/v20.0/search`, {
            params: { type: 'adinterest', q: 'engaged', access_token: token }
        });
        console.log("Success! Found:", res.data.data.length, "items");
        console.log(res.data.data.slice(0, 5));
    } catch(e) {
        console.log("Failed:", e.response ? e.response.data : e.message);
    }
}
test();
