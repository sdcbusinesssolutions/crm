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
        console.log('Template Data Keys:', Object.keys(data));
        console.log('Template Data (structure):', JSON.stringify(data.structure, null, 2)); // Check if structure exists
        console.log('Template Data (meta_json):', JSON.stringify(data.meta_json, null, 2)); // Check if meta_json exists
        console.log('Template Data (body_text):', data.body_text); // Check if body_text exists directly
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
