const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, 'server/.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
    const userId = '9b3cc952-c1c7-4990-8202-a3db93f697f0';
    console.log(`Checking image messages for User ${userId}...`);

    // Find all messages for this user (via conversations)
    const { data: convs } = await supabaseAdmin
        .from('conversations')
        .select('id, contact_phone')
        .eq('user_id', userId);

    if (!convs || convs.length === 0) {
        console.log('No conversations found for this user.');
        return;
    }

    const convIds = convs.map(c => c.id);

    const { data: messages } = await supabaseAdmin
        .from('messages')
        .select('*')
        .in('conversation_id', convIds)
        .eq('type', 'image')
        .order('created_at', { ascending: false })
        .limit(10);

    fs.writeFileSync('user_images_output.json', JSON.stringify(messages, null, 2));
    console.log(`Done. Saved ${messages.length} image messages to user_images_output.json`);
}

check();
