const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Service key bypasses RLS

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTasks() {
    console.log('Fetching tasks with SERVICE KEY (Bypassing RLS)...');
    const { data, error } = await supabase
        .from('tasks')
        .select('id, title, user_id, lead_id, created_at, leads ( user_id )')
        .limit(10);

    if (error) {
        console.error('Error fetching tasks:', error);
    } else {
        console.log(`Found ${data.length} tasks in the database.`);
        console.log(JSON.stringify(data, null, 2));
    }
}

checkTasks();
