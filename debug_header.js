const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
    console.log('Fetching header_type...');
    const { data, error } = await supabase
        .from('whatsapp_templates')
        .select('*')
        .eq('id', 'e428fe87-179a-45f2-a580-e953ba5c6954')
        .single();

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Keys:', JSON.stringify(Object.keys(data)));
    }
}

run();
