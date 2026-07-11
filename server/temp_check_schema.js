const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

async function checkSchema() {
    const { data, error } = await supabaseAdmin.from('ai_knowledge_base').insert({
        agent_id: 'test',
        user_id: 'test',
        file_name: 'test.txt',
        file_path: 'test',
        file_type: '.txt',
        file_size: 0
    }).select();
    
    console.log("INSERT RES:", data, error);
    
    if (data && data.length) {
        await supabaseAdmin.from('ai_knowledge_base').delete().eq('id', data[0].id);
    }
}
checkSchema();
