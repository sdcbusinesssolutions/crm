const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data, error } = await supabase.rpc('update_message_status', {
        p_whatsapp_message_id: 'fake_id',
        p_status: 'read'
    });
    console.log('RPC result:', data, 'Error:', error);
}
check();
