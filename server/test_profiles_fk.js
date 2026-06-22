const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
    const { data, error } = await supabaseAdmin
        .from('wallet_transactions')
        .select(`*, profiles:user_id ( id, name, email, signup_domain )`)
        .limit(1);
    console.log("Error:", error);
}
run();
