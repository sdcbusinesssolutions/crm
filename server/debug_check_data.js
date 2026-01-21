
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    console.log('--- Debugging Data ---');

    const myNumber = '917559410321';
    const contactNumber = '917857836481';

    // 1. Check Config (My Number)
    const { data: configs, error: configError } = await supabase
        .from('whatsapp_config')
        .select('user_id, phone_number')
        .ilike('phone_number', `%${myNumber}%`); // ilike for case-insensitive/partial

    if (configError) console.error('Config Error:', configError);
    console.log('Configs Found:', configs);

    if (!configs || configs.length === 0) {
        console.log('CRITICAL: No Whatsapp Config found for', myNumber);
        return;
    }
    const userId = configs[0].user_id;
    console.log('User ID:', userId);

    // 2. Check Conversation (Contact Number)
    const { data: convs, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', userId)
        .ilike('contact_phone', `%${contactNumber}%`);

    if (convError) console.error('Conversation Error:', convError);
    console.log('Conversations Found:', JSON.stringify(convs, null, 2));

    if (!convs || convs.length === 0) {
        console.log('CRITICAL: No Conversation found for contact', contactNumber);
        return;
    }

    const conversationId = convs[0].id;
    console.log('Conversation ID:', conversationId);

    // 3. Check Messages
    const { data: msgs, error: msgError } = await supabase
        .from('messages')
        .select('id, direction, text, created_at, status')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(5);

    if (msgError) console.error('Message Error:', msgError);
    console.log('Recent Messages:', JSON.stringify(msgs, null, 2));
}

checkData();
