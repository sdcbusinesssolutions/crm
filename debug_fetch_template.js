const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Supabase credentials missing in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
    console.log('Fetching template...');
    const { data, error } = await supabase
        .from('whatsapp_templates')
        .select('*')
        .eq('id', 'e428fe87-179a-45f2-a580-e953ba5c6954')
        .single();

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('FULL DATA:', JSON.stringify(data, null, 2));
        if (data.components) {
            const body = data.components.find(c => c.type === 'BODY');
            if (body) {
                console.log('Body Text:', body.text);
            } else {
                console.log('No BODY component found.');
            }
        }
    }
}

run();
