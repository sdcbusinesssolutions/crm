const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkLastWebhookLog() {
    const phoneToFind = '8920800756';

    // Fetch LAST 5
    const { data, error } = await supabase
        .from('webhook_logs')
        .select('*')
        .ilike('sender_phone', `%${phoneToFind}%`)
        .order('created_at', { ascending: false })
        .limit(5);

    let output = '';

    if (error) {
        output += `Error: ${JSON.stringify(error)}`;
    } else if (data && data.length > 0) {
        output += `Found ${data.length} entries for ${phoneToFind}\n\n`;
        data.forEach((log, i) => {
            output += `--- Log #${i + 1} ---\n`;
            output += `ID: ${log.id}\n`;
            output += `Time: ${log.created_at}\n`;
            output += `Type: ${log.message_type}\n`;
            output += `Status: ${log.processed_status}\n`;
            output += `Error: ${log.error_message || 'None'}\n`;
            output += `Payload: ${JSON.stringify(log.raw_payload).substring(0, 300)}...\n\n`;
        });
    } else {
        output += 'No logs found.';
    }

    fs.writeFileSync('server/webhook_logs_result.txt', output);
    console.log('Done writing to server/webhook_logs_result.txt');
}

checkLastWebhookLog();
