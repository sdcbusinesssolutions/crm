const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTable() {
    console.log('Checking tasks table...');
    const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error accessing tasks table:', error);
    } else {
        console.log('Tasks table checked. Now checking appointments...');

        const { data: colData, error: colError } = await supabase
            .from('appointments')
            .select('status')
            .limit(1);

        if (colError) {
            console.error('Appointments column check failed:', colError);
        } else {
            console.log('Appointments status column verification:', colData);
        }
    }
}

checkTable();
