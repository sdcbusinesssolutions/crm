
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkLimits() {
    console.log('Checking Tenant Limits...');
    const { data, error } = await supabase.from('tenant_limits').select('*');
    if (error) console.error(error);
    else console.log(data);
}

checkLimits();
