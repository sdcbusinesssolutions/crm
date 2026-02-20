const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, 'server/.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
    const phone = '919217928949';
    console.log(`Checking messages for ${phone}...`);

    const { data: conv } = await supabaseAdmin
        .from('conversations')
        .select('id')
        .eq('contact_phone', phone)
        .single();

    if (!conv) {
        console.log('No conversation found.');
        return;
    }

    const { data: messages } = await supabaseAdmin
        .from('messages')
        .select('*')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: false })
        .limit(10);

    fs.writeFileSync('final_check_output.json', JSON.stringify(messages, null, 2));
    console.log(`Done. Saved ${messages.length} messages to final_check_output.json`);
}

check();
