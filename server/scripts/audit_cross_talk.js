
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkCrossTalk() {
    console.log('Starting Cross-Talk Audit...');

    // 1. Load Config Map (PhoneID -> UserID)
    const { data: configs, error: configError } = await supabase
        .from('whatsapp_config')
        .select('user_id, phone_number_id');

    if (configError) {
        console.error('Error loading config:', configError);
        return;
    }

    const phoneOwnerMap = {};
    configs.forEach(c => {
        phoneOwnerMap[c.phone_number_id] = c.user_id;
    });

    console.log(`Loaded ${configs.length} configs.`);

    // 2. Iterate Webhook Logs
    let offset = 0;
    const limit = 100;
    let anomalies = 0;
    let processed = 0;

    while (true) {
        const { data: logs, error: logError } = await supabase
            .from('webhook_logs')
            .select('id, raw_payload, created_at')
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (logError) {
            console.error('Error fetching logs:', logError);
            break;
        }
        if (!logs || logs.length === 0) break;

        for (const log of logs) {
            try {
                const payload = typeof log.raw_payload === 'string' ? JSON.parse(log.raw_payload) : log.raw_payload;
                const metadata = payload.entry?.[0]?.changes?.[0]?.value?.metadata;
                const phoneId = metadata?.phone_number_id;

                // Get messages in this payload
                const messages = payload.entry?.[0]?.changes?.[0]?.value?.messages;

                if (phoneId && messages && Array.isArray(messages)) {
                    const realOwner = phoneOwnerMap[phoneId];
                    if (!realOwner) continue; // Phone not in config?

                    for (const msg of messages) {
                        const waMsgId = msg.id;

                        // Check DB for this message
                        const { data: dbMsg } = await supabase
                            .from('messages')
                            .select('conversation_id, conversations(user_id, id)')
                            .eq('whatsapp_message_id', waMsgId)
                            .maybeSingle();

                        if (dbMsg && dbMsg.conversations) {
                            const currentOwner = dbMsg.conversations.user_id;
                            if (currentOwner !== realOwner) {
                                console.log(`[ANOMALY] LogID: ${log.id} | MsgID: ${waMsgId}`);
                                console.log(`   PhoneID: ${phoneId} belongs to User: ${realOwner}`);
                                console.log(`   BUT Conversation ${dbMsg.conversations.id} belongs to User: ${currentOwner}`); // mismatch!
                                anomalies++;
                            }
                        }
                    }
                }
            } catch (e) {
                // ignore parse errors
            }
        }

        processed += logs.length;
        if (processed % 100 === 0) console.log(`Processed ${processed} logs... Found ${anomalies} anomalies so far.`);
        offset += limit;

        // Safety break for testing (remove for full run)
        if (processed > 2000) break;
    }

    console.log(`Audit Complete. Processed: ${processed}, Anomalies: ${anomalies}`);
}

checkCrossTalk();
