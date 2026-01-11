
require('dotenv').config({ path: 'server/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
    console.log('Fetching Forms...');
    const { data: forms, error: formsError } = await supabase
        .from('forms') // Table name from schema
        .select('id, name, default_group_ids');

    if (formsError) {
        console.error('Error fetching forms:', formsError);
        return;
    }

    console.log('Forms:', JSON.stringify(forms, null, 2));

    console.log('Fetching Groups...');
    const { data: groups, error: groupsError } = await supabase
        .from('contact_groups')
        .select('*');

    if (groupsError) {
        console.error('Error fetching groups:', groupsError);
        return;
    }

    console.log('Groups:', JSON.stringify(groups, null, 2));
}

debug();
