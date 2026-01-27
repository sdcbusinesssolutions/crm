
require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function inspect() {
    const { data: form } = await supabase.from('forms').select('*').eq('name', 'jkl').single();
    if (!form) { console.log('Form jkl not found'); return; }

    console.log(`F_PID: ${form.pipeline_id}`);
    console.log(`F_SID: ${form.stage_id}`);

    const { data: stages } = await supabase.from('pipeline_stages').select('id, name').eq('pipeline_id', form.pipeline_id);
    const stage = stages.find(s => s.id === form.stage_id);
    console.log(`Stage Valid: ${stage ? stage.name : 'FALSE'}`);

    const { count } = await supabase.from('leads').select('*', { count: 'exact', head: true }).eq('pipeline_id', form.pipeline_id);
    console.log(`Leads Count: ${count}`);

    const { data: leads } = await supabase.from('leads').select('name, stage_id').eq('pipeline_id', form.pipeline_id);
    console.log('Leads:', JSON.stringify(leads));
}

inspect();
