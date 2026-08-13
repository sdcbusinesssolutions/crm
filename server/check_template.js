const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
    const { data, error } = await supabase
        .from('whatsapp_templates')
        .select('id, name, language, user_id')
        .eq('name', 'testmsg1');
        
    console.log("Found:", JSON.stringify(data, null, 2));
    if (error) console.error("Error:", error);
}
check();
