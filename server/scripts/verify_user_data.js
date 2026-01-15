const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
    console.log('--- Checking Profiles for api@gmail.com ---');
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', 'api@gmail.com');

    if (error) {
        console.error('Error:', error);
        return;
    }

    if (data.length === 0) {
        console.log('No profile found for api@gmail.com');
    } else {
        console.log('Profile Found:');
        console.log(JSON.stringify(data[0], null, 2));

        const domain = data[0].signup_domain;
        console.log(`signup_domain value: '${domain}'`);
        console.log(`signup_domain type: ${typeof domain}`);
        console.log(`Length: ${domain ? domain.length : 'N/A'}`);

        if (domain === 'apiautomation.in') {
            console.log('MATCH CHECK: Exact match verified.');
        } else {
            console.log('MATCH CHECK: FAIL. Value is not exactly "apiautomation.in"');
        }
    }
}

check();
