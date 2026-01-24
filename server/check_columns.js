const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkColumns() {
    const { data, error } = await supabase
        .from('contact_group_members')
        .select('*')
        .limit(1);

    if (error) {
        console.error(error);
    } else if (data && data.length > 0) {
        console.log('Columns:', Object.keys(data[0]));
    } else {
        console.log('Table empty, cannot infer columns from data. Using empty insert test? No.');
    }
}

checkColumns();
