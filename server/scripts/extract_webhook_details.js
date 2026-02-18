const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkWebhookDetails() {
    const phoneToFind = '918076657985';

    const { data, error } = await supabase
        .from('webhook_logs')
        .select('id, created_at, raw_payload, processed_status')
        .ilike('sender_phone', `%${phoneToFind}%`)
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log(`✅ Webhook details for ${phoneToFind} (Last 5):\n`);

        data.forEach((log, index) => {
            const payload = log.raw_payload;

            // Navigate the standard WhatsApp Webhook JSON structure
            // payload.entry[0].changes[0].value...
            let fromNumber = 'N/A';
            let toNumber = 'N/A';
            let toId = 'N/A';
            let messageBody = 'N/A';

            try {
                if (payload.entry && payload.entry[0].changes && payload.entry[0].changes[0].value) {
                    const value = payload.entry[0].changes[0].value;

                    // Metadata (Business / Receiver info)
                    if (value.metadata) {
                        toNumber = value.metadata.display_phone_number;
                        toId = value.metadata.phone_number_id;
                    }

                    // Messages (Sender info)
                    if (value.messages && value.messages[0]) {
                        fromNumber = value.messages[0].from;
                        messageBody = value.messages[0].text ? value.messages[0].text.body : `[${value.messages[0].type}]`;
                    }
                }
            } catch (e) {
                console.error('Error parsing payload:', e);
            }

            console.log(`--- Message #${index + 1} ---`);
            console.log(`Time: ${new Date(log.created_at).toLocaleString()}`);
            console.log(`FROM (User):     ${fromNumber}`);
            console.log(`TO (Business):   ${toNumber} (ID: ${toId})`);
            console.log(`Content:         "${messageBody.substring(0, 50)}..."`);
            console.log(`Status:          ${log.processed_status}`);
            console.log('-----------------------------\n');
        });
    } else {
        console.log('No logs found.');
    }
}

checkWebhookDetails();
