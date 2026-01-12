
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function inspect() {
    const { data, error } = await supabase.from('campaigns').select('*').limit(1);
    if (error) console.error(error);
    else console.log(Object.keys(data[0]));
}
inspect();
