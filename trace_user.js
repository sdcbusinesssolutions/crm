const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'server/.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
    const { data: msg, error } = await supabaseAdmin
        .from('messages')
        .select('conversation_id, created_at')
        .eq('type', 'image')
        .order('created_at', { ascending: false })
        .limit(1);

    if (msg && msg[0]) {
        const { data: conv } = await supabaseAdmin
            .from('conversations')
            .select('user_id, contact_phone')
            .eq('id', msg[0].conversation_id)
            .single();

        console.log('Last image message stats:');
        console.log(`Phone: ${conv.contact_phone}`);
        console.log(`User ID: ${conv.user_id}`);
        console.log(`Time: ${msg[0].created_at}`);

        // Now check if this user has a valid meta_access_token
        const { data: configs } = await supabaseAdmin
            .from('whatsapp_config')
            .select('meta_access_token, phone_number_id')
            .eq('user_id', conv.user_id);

        console.log(`Found ${configs.length} configs for this user.`);
        configs.forEach((c, i) => {
            console.log(`Config ${i + 1}: PhoneID ${c.phone_number_id}, Token: ${c.meta_access_token ? 'PRESENT' : 'MISSING'}`);
        });
    }
}

check();
