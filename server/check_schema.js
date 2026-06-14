require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function tryInsert() {
    const { data, error } = await supabase
        .from('tenant_notification_settings')
        .upsert({
            domain: 'dummy.com',
            welcome_template_media_url: 'test',
            admin_whatsapp_media_url: 'test'
        }, { onConflict: 'domain' });
    console.log(error);
}
tryInsert();
