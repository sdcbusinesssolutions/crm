
require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function inspect() {
    console.log('--- Inspecting Form "jkl" ---');
    // 1. Get Form
    const { data: form } = await supabase.from('forms').select('*').eq('name', 'jkl').single();
    if (!form) { console.log('Form jkl not found'); return; }

    console.log(`Form ID: ${form.id}`);
    console.log(`Pipeline ID: ${form.pipeline_id}`);
    console.log(`Stage ID: ${form.stage_id}`);
    console.log(`User ID: ${form.user_id}`);

    // 2. Get Pipeline Stages
    console.log('\n--- Pipeline Stages ---');
    const { data: stages } = await supabase.from('pipeline_stages').select('id, name, pipeline_id').eq('pipeline_id', form.pipeline_id);
    console.log(stages);

    // Verify Stage ID matches one of them
    const validStage = stages.find(s => s.id === form.stage_id);
    console.log(`\nIs Stage Valid? ${validStage ? 'YES (' + validStage.name + ')' : 'NO'}`);

    // 3. Get Leads in this Pipeline
    console.log('\n--- Leads in Pipeline ---');
    const { data: leads } = await supabase.from('leads').select('id, name, stage_id, contact_id').eq('pipeline_id', form.pipeline_id);
    console.log(`Total Leads: ${leads ? leads.length : 0}`);
    if (leads) {
        leads.forEach(l => {
            console.log(`Lead: ${l.name} | Stage: ${l.stage_id} | Contact: ${l.contact_id}`);
        });
    }

    // 4. Check Contacts created recently
    console.log('\n--- Recent Contacts ---');
    const { data: contacts } = await supabase.from('contacts').select('id, name, email, phone, created_at').order('created_at', { ascending: false }).limit(5);
    console.log(contacts);

}

inspect();
