require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
    const { error } = await supabase.rpc('execute_sql', { sql: "ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS error_message TEXT;" });
    if (error) {
        console.error("RPC failed, trying raw insert to see if we can trigger error to check if column exists:", error);
        // Let's just try to update a campaign with error_message to see if it exists
        const { error: updateErr } = await supabase.from('campaigns').update({ error_message: null }).eq('id', '00000000-0000-0000-0000-000000000000');
        if (updateErr) {
            console.error("Column likely doesn't exist:", updateErr);
            // We need to add the column. 
        } else {
            console.log("Column exists!");
        }
    } else {
        console.log("Success");
    }
}
run();
