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
    
    const callyzerUrl = `${baseUrl.replace(/\/+$/, '')}/api/v2.2/call-log/history`;

    try {
        const response = await fetch(callyzerUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                client_numbers: ["8149168923"] // without call_from and call_to
            })
        });

        const text = await response.text();
        console.log("Status:", response.status);
        console.log("Response:", text.substring(0, 500));
    } catch(e) {
        console.error(e);
    }
}
test();
