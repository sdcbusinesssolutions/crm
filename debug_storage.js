const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'server/.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing ENV');
    process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
    console.log('Checking project:', supabaseUrl);

    // 1. Check Bucket
    const { data: bucket, error: bucketErr } = await supabaseAdmin.storage.getBucket('campaign-media');
    if (bucketErr) {
        console.error('Bucket Error:', bucketErr.message);
    } else {
        console.log('Bucket Info:', { name: bucket.id, public: bucket.public });
    }

    // 2. Check latest image messages
    const { data: messages, error: msgErr } = await supabaseAdmin
        .from('messages')
        .select('id, type, media_url, created_at, whatsapp_message_id')
        .eq('type', 'image')
        .order('created_at', { ascending: false })
        .limit(5);

    if (msgErr) {
        console.error('Messages Error:', msgErr.message);
    } else {
        console.log('Latest Image Messages:');
        messages.forEach(m => {
            console.log(`ID: ${m.id}, URL: ${m.media_url ? 'PRESENT' : 'NULL'}, Time: ${m.created_at}, WA_ID: ${m.whatsapp_message_id}`);
            if (m.media_url) console.log(`   URL: ${m.media_url}`);
        });
    }
}

check();
