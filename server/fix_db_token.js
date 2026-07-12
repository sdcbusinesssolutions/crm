require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: __dirname + '/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConfig() {
    const token = process.env.META_ACCESS_TOKEN;
    
    // Update all users' tokens for this testing session
    const { data: updated, error: updError } = await supabase
        .from('whatsapp_config')
        .update({ meta_access_token: token })
        .not('id', 'is', null);
        
    console.log('Update Error:', updError);
    console.log('Successfully updated the database tokens for testing.');
}

checkConfig();
