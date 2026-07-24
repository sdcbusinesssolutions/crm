const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') }); // try parent if not in server

const supabaseUrl = process.env.SUPABASE_URL ? process.env.SUPABASE_URL.trim() : '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY ? process.env.SUPABASE_SERVICE_KEY.trim() : '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function test() {
    const { data, error } = await supabaseAdmin
        .from('user_integrations')
        .select('*')
        .eq('provider', 'callyzer')
        .limit(1)
        .single();
    
    if(error) {
        console.error("DB Error:", error);
        return;
    }
    
    console.log("Credentials:", data.credentials);
    const { baseUrl, apiToken } = data.credentials;

    const callTo = Math.floor(Date.now() / 1000);
    const callFrom = callTo - (30 * 24 * 60 * 60);
    console.log(`From: ${callFrom}, To: ${callTo}`);
    
    const callyzerUrl = `${baseUrl.replace(/\/+$/, '')}/api/v2.2/call-log/history`;
    console.log("URL:", callyzerUrl);

    try {
        const response = await fetch(callyzerUrl, {
            method: 'POST', // The code says POST
            headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                call_from: callFrom,
                call_to: callTo,
                call_method: "PhoneCall",
                call_mode: "Voice"
            })
        });

        console.log("Status:", response.status);
        if(!response.ok) {
            console.log("Status Text:", response.statusText);
            const text = await response.text();
            console.log("Response text:", text);
            return;
        }

        const resultData = await response.json();
        console.log("Total Results returned from API:", resultData.result ? resultData.result.length : 0);
        
        if (resultData.result && resultData.result.length > 0) {
            console.log("Sample result:");
            console.log(resultData.result[0]);
        } else {
            console.log(resultData);
        }

    } catch(e) {
        console.error("Fetch error:", e);
    }
}
test();
