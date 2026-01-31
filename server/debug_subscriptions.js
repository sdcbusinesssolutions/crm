
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use Service Role Key for Admin

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkData() {
    console.log('Checking Subscriptions...');
    const { data: subs, error: subError } = await supabase
        .from('user_subscriptions')
        .select('*');

    if (subError) {
        console.error('Error fetching subscriptions:', subError);
    } else {
        console.log(`Found ${subs.length} subscriptions.`);
        console.log(subs);
    }

    console.log('\nChecking Profiles for Plan Data...');
    const { data: profiles, error: profError } = await supabase
        .from('profiles')
        .select('id, email, plan_name, plan_expires_at');

    if (profError) {
        console.error('Error fetching profiles:', profError);
    } else {
        console.log(`Found ${profiles.length} profiles.`);
        profiles.forEach(p => {
            console.log(`User: ${p.email} | Plan: ${p.plan_name} | Expires: ${p.plan_expires_at}`);
        });
    }
}

checkData();
