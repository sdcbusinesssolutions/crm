require('dotenv').config({ path: './server/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("Checking columns...");

    // Check components
    const { data: cData, error: cError } = await supabase
        .from('whatsapp_templates')
        .select('components')
        .limit(1);

    if (cError) {
        console.log("Column 'components' MISSING or Error:", cError.message);
    } else {
        console.log("Column 'components' EXISTS.");
    }

    // Check variable_samples
    const { data: vData, error: vError } = await supabase
        .from('whatsapp_templates')
        .select('variable_samples')
        .limit(1);

    if (vError) {
        console.log("Column 'variable_samples' MISSING or Error:", vError.message);
    } else {
        console.log("Column 'variable_samples' EXISTS.");
    }
}

check();
