
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL; // Using SUPABASE_URL instead of VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY; // Using SUPABASE_SERVICE_KEY instead of SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkProfiles() {
    console.log('Checking Profiles and Domains...');

    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, email, signup_domain');

    if (error) {
        console.error('Error fetching profiles:', error);
        return;
    }

    console.log(`Found ${profiles.length} profiles.`);

    // Group by signup_domain
    const domainCounts = {};
    profiles.forEach(p => {
        const d = p.signup_domain || 'NULL';
        if (!domainCounts[d]) domainCounts[d] = 0;
        domainCounts[d]++;
    });

    console.log('User counts by signup_domain:', domainCounts);

    console.log('Sample profiles:', profiles.slice(0, 5));
}

checkProfiles();
