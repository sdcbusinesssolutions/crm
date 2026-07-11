const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

async function checkDocs() {
    const { data, error } = await supabaseAdmin.from('ai_knowledge_base').select('*');
    console.log("Documents in DB:", data);
}
checkDocs();
