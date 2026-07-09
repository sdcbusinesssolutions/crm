const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function test() {
    const { data } = await supabase.from('whatsapp_config').select('meta_access_token').not('meta_access_token', 'is', null).limit(1);
    const token = data[0].meta_access_token;
    
    try {
        console.log("Testing type=adTargetingCategory&class=behaviors:");
        let res = await axios.get(`https://graph.facebook.com/v20.0/search?type=adTargetingCategory&class=behaviors`, {
            params: { access_token: token }
        });
        console.log(res.data.data.slice(0, 3)); // Just print a few to see what it returns
    } catch(e) {
        console.log(e.response ? e.response.data : e.message);
    }
}
test();
