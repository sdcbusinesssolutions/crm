
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkSchema() {
    try {
        const { data } = await supabase.from('drip_enrollments').select('*').limit(1);
        if (data && data[0]) {
            console.log('Columns in drip_enrollments:', Object.keys(data[0]));
        } else {
            console.log('No data in drip_enrollments');
        }
    } catch (e) {
        console.error(e);
    }
}
checkSchema();
