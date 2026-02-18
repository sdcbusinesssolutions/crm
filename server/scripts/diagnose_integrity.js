const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function diagnoseIntegrity() {
    console.log('--- DIAGNOSIS START ---');

    // 1. Check for Duplicate WhatsApp Configs
    console.log('\nChecking for duplicate phone_number_ids in whatsapp_config...');
    const { data: configs, error: configError } = await supabase
        .from('whatsapp_config')
        .select('phone_number_id, user_id');

    if (configs) {
        const counts = {};
        configs.forEach(c => {
            counts[c.phone_number_id] = (counts[c.phone_number_id] || 0) + 1;
        });
        const duplicates = Object.entries(counts).filter(([k, v]) => v > 1);
        if (duplicates.length > 0) {
            console.error('🚨 DUPLICATE CONFIGS FOUND:', duplicates);

            // Get user details for duplicates
            const dupId = duplicates[0][0];
            const { data: dupUsers } = await supabase
                .from('whatsapp_config')
                .select('user_id, phone_number_id, created_at')
                .eq('phone_number_id', dupId);

            console.log('Duplicate Details:', JSON.stringify(dupUsers, null, 2));
        } else {
            console.log('✅ No duplicate phone_number_ids found.');
        }
    }

    // 2. Check Conversation Integrity for the reported "Other User"
    const phoneC = '917559410321';
    console.log(`\nChecking messages for conversation with ${phoneC}...`);

    // Find conversation ID(s) for this phone
    const { data: convs, error: convError } = await supabase
        .from('conversations')
        .select('id, user_id, contact_phone')
        .eq('contact_phone', phoneC);

    if (convs && convs.length > 0) {
        console.log(`Found ${convs.length} conversation(s) for ${phoneC}:`);
        for (const conv of convs) {
            console.log(`- Conv ID: ${conv.id}, User ID: ${conv.user_id}`);

            // Fetch recent messages
            const { data: msgs } = await supabase
                .from('messages')
                .select('text, created_at, direction')
                .eq('conversation_id', conv.id)
                .order('created_at', { ascending: false })
                .limit(5);

            console.log('  Recent Messages:');
            msgs.forEach(m => console.log(`    [${m.direction}] ${m.text.substring(0, 30)}...`));
        }
    } else {
        console.log('No conversation found for this number.');
    }

    console.log('\n--- DIAGNOSIS END ---');
}

diagnoseIntegrity();
