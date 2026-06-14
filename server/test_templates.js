require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
    const { data: configData } = await supabaseAdmin
        .from('whatsapp_config')
        .select('user_id')
        .eq('whatsapp_business_account_id', '1259751162341004')
        .limit(1)
        .maybeSingle();
    
    if (configData) {
        const { data: template } = await supabaseAdmin
            .from('whatsapp_templates')
            .select('*')
            .eq('user_id', configData.user_id)
            .eq('name', 'tescaro4')
            .limit(1)
            .maybeSingle();
        
        console.log("Template tescaro4:", JSON.stringify(template, null, 2));
    }
}
check();
