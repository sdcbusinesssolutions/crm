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
    const templateId = '0a827d66-b334-4f7f-bf9e-04cdbd21c673';
    console.log(`Fetching template ${templateId}...`);
    const { data: template, error } = await supabase
        .from('whatsapp_templates')
        .select('*')
        .eq('id', templateId)
        .single(); // Use single()

    if (error) {
        console.error('Error fetching template:', error);
        return;
    }

    const fs = require('fs');
    fs.writeFileSync('debug_template_output.json', JSON.stringify(template, null, 2));
    console.log('Output written to debug_template_output.json');
}

run();
