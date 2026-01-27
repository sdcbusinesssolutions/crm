
require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function inspect() {
    const { data, error } = await supabase.from('leads').select('*').limit(1);
    console.log(JSON.stringify(data[0] ? Object.keys(data[0]) : [], null, 2));
}
inspect();
