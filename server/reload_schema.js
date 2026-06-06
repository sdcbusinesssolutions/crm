const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function reload() {
    const { data, error } = await supabaseAdmin.rpc('reload_schema_cache', {}); // Often doesn't exist by default.
    console.log("RPC result:", error || data);
}
reload();
