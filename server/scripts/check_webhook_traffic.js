
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTraffic() {
    console.log('Checking Webhook Logs for Phone ID: 712851615243145');

    // We need to find logs where phone_number_id is 712851615243145
    // formatting might vary, so let's query raw if possible or use the log table columns

    const { data: logs, error } = await supabase
        .from('webhook_logs')
        .select('*')
        .eq('phone_number_id', '712851615243145')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`Found ${logs.length} recent logs.`);

    if (logs.length > 0) {
        logs.forEach(l => {
            console.log(`\nLog ID: ${l.id} | User: ${l.user_id} | Status: ${l.processed_status}`);
            console.log(`Payload Snippet: ${JSON.stringify(l.raw_payload).substring(0, 200)}...`);
            // Check metadata display phone number
            try {
                const payload = typeof l.raw_payload === 'string' ? JSON.parse(l.raw_payload) : l.raw_payload;
                const metadata = payload.entry?.[0]?.changes?.[0]?.value?.metadata;
                console.log(`Metadata Phone: ${metadata?.display_phone_number} (ID: ${metadata?.phone_number_id})`);

                const messages = payload.entry?.[0]?.changes?.[0]?.value?.messages;
                if (messages) {
                    messages.forEach(m => console.log(`  Msg From: ${m.from} | Body: ${m.text?.body || '[Media]'}`));
                }
            } catch (e) { console.log('Parsed partial payload error'); }
        });
    }
}

checkTraffic();
