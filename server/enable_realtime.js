const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
    console.log("Enabling realtime for messages and conversations...");
    const { data, error } = await supabase.rpc('execute_sql', { 
        query: `
            ALTER PUBLICATION supabase_realtime ADD TABLE "public"."messages";
            ALTER PUBLICATION supabase_realtime ADD TABLE "public"."conversations";
        `
    });
    console.log(error ? "Error: " + JSON.stringify(error) : "Success!");
}
run();
