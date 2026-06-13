require('dotenv').config({ path: '/home/devendra/proj/wpcode/server/.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function check() {
    const { data, error } = await supabase.auth.signUp({
        email: 'devendrakumar1007@gmail.com',
        password: 'Password123!',
    });
    console.log("Signup Result:", data);
    console.log("Signup Error:", error);
    process.exit(0);
}
check();
