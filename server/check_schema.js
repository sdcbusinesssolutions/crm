require('dotenv').config({ path: __dirname + '/.env' });
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
    // try to fetch a single row from a non-existent table just to see the error or what. 
    // actually we cannot easily get all tables via REST without querying `information_schema`.
    // Wait, let's see if we can just store the OTP in `profiles` table as a new column, or `user_integrations`, or maybe there's a JSON field we can use.
    // Let's check `profiles` columns.
    const { data, error } = await supabaseAdmin.from('profiles').select('*').limit(1);
    if (error) console.error(error);
    else console.log(Object.keys(data[0] || {}));
}
run();
