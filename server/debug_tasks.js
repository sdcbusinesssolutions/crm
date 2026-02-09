const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTasks() {
    try {
        const { data, error } = await supabase
            .from('tasks')
            .select('id, title, leads ( name, pipelines ( name ) )')
            .limit(5);

        if (error) {
            console.log(JSON.stringify({ error }));
        } else {
            console.log(JSON.stringify(data, null, 2));
        }
    } catch (e) {
        console.log(JSON.stringify({ error: e.message }));
    }
}

checkTasks();
