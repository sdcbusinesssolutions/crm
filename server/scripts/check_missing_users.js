const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkDiff() {
    console.log('--- Checking for Missing Profiles ---');

    // 1. Fetch Auth Users
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (authError) {
        console.error('Auth Error:', authError);
        return;
    }
    console.log(`Total Auth Users: ${users.length}`);

    // 2. Fetch Profiles
    const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('email, signup_domain');

    if (profileError) {
        console.error('Profile Error:', profileError);
        return;
    }
    console.log(`Total Profiles: ${profiles.length}`);

    // 3. Find Missing
    const profileEmails = new Set(profiles.map(p => p.email));
    const missingUsers = users.filter(u => !profileEmails.has(u.email));

    if (missingUsers.length > 0) {
        console.log(`\nFound ${missingUsers.length} users missing from 'profiles' table:`);
        missingUsers.forEach(u => {
            console.log(`- ${u.email} (Created: ${u.created_at})`);
        });
    } else {
        console.log('\nAll auth users have profile records.');
    }

    // 4. Check for apiautomation admins
    console.log('\n--- Checking apiautomation.in users in Auth ---');
    const apiUsers = users.filter(u => u.email.includes('admin') || u.email.includes('quia')); // filtering blindly for now
    // Actually let's just show any admin-like emails
    users.filter(u => u.email.includes('admin')).forEach(u => {
        // check profile domain
        const prof = profiles.find(p => p.email === u.email);
        console.log(`Admin User: ${u.email} -> Profile Domain: ${prof ? prof.signup_domain : 'MISSING'}`);
    });

}

checkDiff();
