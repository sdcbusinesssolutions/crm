const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'server/.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    console.log(`Checking image messages since ${twoHoursAgo}...`);

    const { data: messages, error } = await supabaseAdmin
        .from('messages')
        .select('id, conversation_id, direction, type, media_url, text, created_at, whatsapp_message_id')
        .eq('type', 'image')
        .gte('created_at', twoHoursAgo)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error:', error.message);
    } else if (messages.length === 0) {
        console.log('No image messages found in the last 2 hours.');
    } else {
        console.log(`Found ${messages.length} image messages:`);
        messages.forEach(m => {
            console.log(`ID: ${m.id}, Dir: ${m.direction}, URL: ${m.media_url ? 'PRESENT' : 'NULL'}, Time: ${m.created_at}`);
            if (m.media_url) console.log(`   Link: ${m.media_url}`);
        });
    }
}

check();
