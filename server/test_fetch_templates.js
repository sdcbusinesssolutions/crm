require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const GRAPH_API_URL = 'https://graph.facebook.com/v18.0';

async function testFetch() {
    // get first whatsapp config
    const { data: config, error } = await supabase
        .from('whatsapp_config')
        .select('*')
        .limit(1)
        .single();
        
    if (error || !config) {
        console.error("No whatsapp config found", error);
        return;
    }
    
    console.log("Found config for user:", config.user_id);
    const { whatsapp_business_account_id: wabaId, meta_access_token: accessToken } = config;
    
    let nextUrl = `${GRAPH_API_URL}/${wabaId}/message_templates?fields=name,language,status,id,category,components,quality_score&limit=200`;

    try {
        console.log("Fetching from:", nextUrl);
        const metaRes = await axios.get(nextUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        console.log("Success! Fetched", metaRes.data.data.length, "templates");
    } catch (err) {
        console.error('Error fetching template page:', err.message);
        if (err.response) {
            console.error(JSON.stringify(err.response.data, null, 2));
        }
    }
}

testFetch();
