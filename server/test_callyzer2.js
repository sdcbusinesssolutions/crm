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
        let allResults = [];
        let page = 1;
        let hasMore = true;

        while(hasMore && page < 10) { // arbitrary limit just in case
            const response = await fetch(callyzerUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    call_from: callFrom,
                    call_to: callTo,
                    call_method: "PhoneCall",
                    call_mode: "Voice",
                    // Adding client_number directly to API if supported, or just testing pagination
                    page: page
                })
            });

            if(!response.ok) {
                console.log("Error:", response.status, response.statusText);
                break;
            }

            const resultData = await response.json();
            const results = resultData.result || [];
            allResults = allResults.concat(results);

            console.log(`Page ${page}: fetched ${results.length} results.`);
            
            if (results.length < 100) {
                hasMore = false;
            } else {
                page++;
            }
        }
        console.log(`Total results fetched: ${allResults.length}`);

        const phoneNumber = '918149168923';
        const target10 = phoneNumber.slice(-10);
        
        const filtered = allResults.filter(call => call.client_number && call.client_number.slice(-10) === target10);
        console.log(`Found ${filtered.length} matches for ${target10}`);
        
        if (filtered.length > 0) {
            console.log(filtered);
        }

    } catch(e) {
        console.error(e);
    }
}
test();
