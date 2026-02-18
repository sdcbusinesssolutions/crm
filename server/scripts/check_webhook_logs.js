const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkLastWebhookLog() {
    const phoneToFind = '8920800756';

    // Fetch only the LAST ONE
    const { data, error } = await supabase
        .from('webhook_logs')
        .select('*')
        .ilike('sender_phone', `%${phoneToFind}%`)
        .order('created_at', { ascending: false })
        .limit(1);

    if (error) {
        console.error('Error:', error);
        return;
    }

    if (data && data.length > 0) {
        const log = data[0];
        console.log('--- LATEST WEBHOOK LOG ---');
        console.log(`ID: ${log.id}`);
        console.log(`Time: ${log.created_at}`);
        console.log(`Sender: ${log.sender_phone}`);
        console.log(`Status: ${log.processed_status}`);
        console.log(`Type: ${log.message_type}`);
        console.log(`Error: ${log.error_message || 'None'}`);
        console.log('--- Payload Snippet ---');
        // Carefully slice payload to not exceed buffer but show content
        const payloadStr = JSON.stringify(log.raw_payload);
        console.log(payloadStr.substring(0, 500));
    } else {
        console.log('No logs found.');
    }
}

checkLastWebhookLog();
