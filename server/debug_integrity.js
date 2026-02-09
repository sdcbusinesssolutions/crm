const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function debug() {
    // 1. Get tasks
    const { data: tasks } = await supabase.from('tasks').select('id, title, lead_id').limit(3);
    console.log('Tasks:', JSON.stringify(tasks, null, 2));

    if (tasks && tasks.length > 0) {
        const leadIds = tasks.map(t => t.lead_id);
        // 2. Get leads
        const { data: leads } = await supabase.from('leads').select('id, name, pipeline_id').in('id', leadIds);
        console.log('Leads:', JSON.stringify(leads, null, 2));

        // 3. Get pipelines for those leads
        const pipelineIds = leads.map(l => l.pipeline_id).filter(id => id);
        if (pipelineIds.length > 0) {
            const { data: pipelines } = await supabase.from('pipelines').select('id, name').in('id', pipelineIds);
            console.log('Pipelines:', JSON.stringify(pipelines, null, 2));
        } else {
            console.log('No pipeline_ids found in leads');
        }
    }
}

debug();
