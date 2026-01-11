require('dotenv').config({ path: './server/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("Checking if quality_score column exists...");
    const { data, error } = await supabase
        .from('whatsapp_templates')
        .select('quality_score')
        .limit(1);

    if (error) {
        console.error("Error/Column Missing:", error.message);
    } else {
        console.log("Column exists! Data:", data);
    }
}

check();
