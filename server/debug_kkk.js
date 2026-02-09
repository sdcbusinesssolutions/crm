const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkTaskKKK() {
    console.log('Searching for task "kkk"...');
    const { data: tasks, error } = await supabase
        .from('tasks')
        .select(`
            id, 
            title, 
            lead_id,
            leads (
                id,
                name,
                pipeline_id,
                pipelines (
                    id,
                    name
                )
            )
        `)
        .ilike('title', '%kkk%');

    if (error) {
        console.error('Error:', error);
    } else {
        console.log(JSON.stringify(tasks, null, 2));
    }
}

checkTaskKKK();
