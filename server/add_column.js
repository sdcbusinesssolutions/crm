const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
    const { data, error } = await supabase.rpc('execute_sql', { 
        query: `
            ALTER TABLE conversations ADD COLUMN IF NOT EXISTS lead_status VARCHAR(50);
            ALTER TABLE conversations ADD COLUMN IF NOT EXISTS lead_summary TEXT;
        `
    });
    console.log(error ? error : "Success!");
}
run();
