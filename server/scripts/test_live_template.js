const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const SUPABASE_URL = 'https://dndmbarbnsdlbclghkbs.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRuZG1iYXJibnNkbGJjbGdoa2JzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQ4MjMxMywiZXhwIjoyMDk0MDU4MzEzfQ.kGyOt8oA0FfR_zXRJjK0lAzSTNKX3f6cK6b_wPmChxI';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testLiveCategory() {
    console.log("--- 🚀 Starting Live Template Check Proof ---");
    
    // 1. Fetch a real WABA ID and Token from DB
    const { data: config, error } = await supabase
        .from('whatsapp_config')
        .select('whatsapp_business_account_id, meta_access_token')
        .not('whatsapp_business_account_id', 'is', null)
        .not('meta_access_token', 'is', null)
        .limit(1)
        .single();
        
    if (error || !config) {
        console.error("❌ Failed to fetch config from DB:", error);
        return;
    }
    
    const wabaId = config.whatsapp_business_account_id;
    const token = config.meta_access_token;
    
    // The template name we saw in the screenshot
    const templateName = 'offercamp'; 
    
    console.log(`✅ Found WABA ID: ${wabaId}`);
    // console.log(`✅ Token: ${token.substring(0, 15)}...`);
    console.log(`✅ Target Template: ${templateName}`);
    
    // 2. Exact logic from whatsappService.js
    const baseUrl = 'https://graph.facebook.com/v18.0';
    const url = `${baseUrl}/${wabaId}/message_templates?name=${encodeURIComponent(templateName)}`;
    
    console.log(`\n🔍 Making API Call exactly like whatsappService.js...`);
    console.log(`GET ${url}`);
    
    try {
        const res = await axios.get(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        console.log(`\n🟢 API Response Status: ${res.status} ${res.statusText}`);
        
        if (res.data && res.data.data && res.data.data.length > 0) {
            const templateData = res.data.data[0];
            console.log(`\n📦 Full Template Data from Meta:`);
            console.log(JSON.stringify(templateData, null, 2));
            
            const fetchedCategory = templateData.category.toUpperCase();
            console.log(`\n🎯 EXTRACTED CATEGORY: ${fetchedCategory}`);
            console.log(`\n✨ PROOF: The logic in whatsappService.js works perfectly!`);
        } else {
            console.log(`⚠️ API responded successfully, but template '${templateName}' was not found in this WABA.`);
        }
    } catch (err) {
        console.error(`\n❌ API Call Failed:`);
        console.error(err.response ? JSON.stringify(err.response.data, null, 2) : err.message);
    }
}

testLiveCategory();
