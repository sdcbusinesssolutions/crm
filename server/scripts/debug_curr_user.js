
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUser() {
    const email = 'ap1@gmail.com';
    console.log(`Checking profile for: ${email}`);

    // 1. Get User ID from Auth
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
        console.error('Auth Error:', authError);
        return;
    }

    const user = users.find(u => u.email === email);

    if (!user) {
        console.log('User not found in Auth');
        return;
    }

    console.log('User found in Auth:', user.id);
    console.log('Auth Metadata:', user.user_metadata);

    // 2. Get Profile
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (profileError) {
        console.error('Profile Error:', profileError);
    } else {
        console.log('Profile found:');
        console.log(JSON.stringify(profile, null, 2));
        console.log(`signup_domain (raw): "${profile.signup_domain}"`);
        console.log(`Length: ${profile.signup_domain ? profile.signup_domain.length : 'N/A'}`);
    }
}

checkUser();
