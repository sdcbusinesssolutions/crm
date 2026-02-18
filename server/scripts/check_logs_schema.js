
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkLogsSchema() {
    console.log('Checking Webhook Logs Schema and Data...');
    const { data: logs, error } = await supabase
        .from('webhook_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(2);

    if (error) {
        console.error('Error:', error);
        return;
    }

    if (logs && logs.length > 0) {
        console.log('Top 2 Logs:');
        logs.forEach(l => {
            console.log(`ID: ${l.id} | User: ${l.user_id} | PhoneID: ${l.phone_number_id}`);
            // Check metadata inside raw_payload
            try {
                const payload = typeof l.raw_payload === 'string' ? JSON.parse(l.raw_payload) : l.raw_payload;
                const metadata = payload.entry?.[0]?.changes?.[0]?.value?.metadata;
                console.log(`  Expected PhoneID: ${metadata?.phone_number_id}`);
            } catch (e) { }
        });
    } else {
        console.log('No logs found.');
    }
}

checkLogsSchema();
