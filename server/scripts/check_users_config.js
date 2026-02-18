const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase URL or Key');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const logFile = path.join(__dirname, 'debug_users.log');
const log = (msg) => {
    fs.appendFileSync(logFile, msg + '\n');
    console.log(msg);
};

fs.writeFileSync(logFile, ''); // Clear file

async function checkSystemState() {
    log('--- 1. Checking WhatsApp Configs ---');
    const { data: configs, error } = await supabase
        .from('whatsapp_config')
        .select('user_id, phone_number_id, phone_number, created_at');

    if (error) {
        log('Error fetching configs: ' + error.message);
        return;
    }

    const phoneIdMap = {};

    for (const config of configs) {
        // Fetch User Email
        const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(config.user_id);
        const email = user ? user.email : 'Unknown/Deleted User';

        log(`User: ${email}`);
        log(`  ID: ${config.user_id}`);
        log(`  Phone ID: ${config.phone_number_id}`);
        log(`  Number: ${config.phone_number}`);
        log('-----------------------------------');

        // Check for duplicates in memory
        if (phoneIdMap[config.phone_number_id]) {
            log(`🚨 DUPLICATE DETECTED: Phone ID ${config.phone_number_id} is used by:`);
            log(`  1. ${phoneIdMap[config.phone_number_id]}`);
            log(`  2. ${email}`);
        }
        phoneIdMap[config.phone_number_id] = email;
    }

    log('\n--- 2. Checking Recent Conversations per User ---');
    for (const config of configs) {
        const { data: convs, error: convError } = await supabase
            .from('conversations')
            .select('id, contact_phone, last_message, updated_at')
            .eq('user_id', config.user_id)
            .order('updated_at', { ascending: false })
            .limit(5);

        if (convs && convs.length > 0) {
            log(`\nConversations for ${config.user_id} (Phone ID: ${config.phone_number_id}):`);
            convs.forEach(c => {
                log(`  - Contact: ${c.contact_phone} | Last: ${c.last_message ? c.last_message.substring(0, 30).replace(/\n/g, ' ') : ''}... | At: ${c.updated_at}`);
            });
        }
    }
}

checkSystemState();
