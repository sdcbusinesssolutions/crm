const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

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
    
    if(error) return console.error(error);
    const { baseUrl, apiToken } = data.credentials;

    const callTo = Math.floor(Date.now() / 1000);
    const callFrom = callTo - (30 * 24 * 60 * 60);
    
    const callyzerUrl = `${baseUrl.replace(/\/+$/, '')}/api/v2.2/call-log/history`;

    try {
        const response = await fetch(callyzerUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                call_from: callFrom,
                call_to: callTo,
                call_types: ["Incoming", "Outgoing", "Missed", "Rejected"],
                call_method: "PhoneCall",
                call_mode: "Voice",
                client_numbers: ["8149168923", "918149168923"]
            })
        });

        const text = await response.text();
        console.log("Status:", response.status);
        console.log("Response:", text.substring(0, 500));
        
        try {
            const json = JSON.parse(text);
            if (json.result) {
                console.log(`Total records: ${json.total_records}, returned: ${json.result.length}`);
            }
        } catch(e) {}
    } catch(e) {
        console.error(e);
    }
}
test();
