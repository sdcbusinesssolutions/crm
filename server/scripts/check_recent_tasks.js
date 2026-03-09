
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkTasks() {
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: tasks } = await supabase.from('tasks').select('*').gte('updated_at', fifteenMinsAgo);
    console.log(`Tasks in last 15 mins: ${tasks?.length || 0}`);
    if (tasks) tasks.forEach(t => console.log(`  - Task ${t.id} Contact: ${t.contact_id} Title: ${t.title}`));
}
checkTasks();
