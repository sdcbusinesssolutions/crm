
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    const { data, error } = await supabase
        .from('pipelines')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error:', error);
    } else {
        if (data && data.length > 0) {
            console.log('Pipeline Keys:', Object.keys(data[0]));
        } else {
            console.log('No pipelines found to check schema. Attempting to insert a dummy one to check...');
            // Try to insert with just required fields from what we know
            const { data: inserted, error: insertError } = await supabase
                .from('pipelines')
                .insert([{ user_id: '00000000-0000-0000-0000-000000000000', name: 'Schema Check' }]) // might fail on user_id fk
                .select();

            if (insertError) {
                console.log('Could not insert dummy:', insertError.message);
            } else {
                console.log('Inserted dummy keys:', Object.keys(inserted[0]));
            }
        }
    }
}

checkSchema();
