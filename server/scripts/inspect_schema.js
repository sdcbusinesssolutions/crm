
require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function inspect() {
    const { data, error } = await supabase.from('forms').select('*').eq('name', 'tes12').single();
    if (data) {
        console.log('Form:', { id: data.id, name: data.name, pipeline: data.pipeline_id, stage: data.stage_id });
    } else {
        // try exact match or ilike
        const { data: data2 } = await supabase.from('forms').select('*').ilike('name', 'tes12').single();
        if (data2) {
            console.log('Form (ilike):', { id: data2.id, name: data2.name, pipeline: data2.pipeline_id, stage: data2.stage_id });
        } else {
            console.log('Form not found or error:', error);
        }
    }
}

inspect();
