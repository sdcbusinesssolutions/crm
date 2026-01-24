require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkSchema() {
    const { data, error } = await supabase
        .from('onboarding_settings')
        .select('*')
        .limit(1);

    if (error) {
        console.log("Error selecting:", error);
    } else {
        console.log("Row keys:", data.length ? Object.keys(data[0]) : "No rows found");
    }
}

checkSchema();
