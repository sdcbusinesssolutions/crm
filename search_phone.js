const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'server/.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
    console.log('Searching for messages from 918408907516...');

    // First find the conversation(s)
    const { data: convs, error: convErr } = await supabaseAdmin
        .from('conversations')
        .select('id, contact_phone, contact_name')
        .eq('contact_phone', '918408907516');

    if (convErr) {
        console.error('Conv Error:', convErr.message);
        return;
    }

    if (!convs || convs.length === 0) {
        console.log('No conversation found for 918408907516');
        return;
    }

    for (const conv of convs) {
        console.log(`Checking Conversation ID: ${conv.id} (${conv.contact_name})`);

        const { data: messages, error: msgErr } = await supabaseAdmin
            .from('messages')
            .select('id, type, text, media_url, created_at')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(10);

        if (msgErr) {
            console.error('Msg Error:', msgErr.message);
            continue;
        }

        messages.forEach(m => {
            console.log(`[${m.created_at}] Type: ${m.type}, Text: ${m.text}, MediaURL: ${m.media_url ? m.media_url.substring(0, 50) + '...' : 'NULL'}`);
        });
    }
}

check();
