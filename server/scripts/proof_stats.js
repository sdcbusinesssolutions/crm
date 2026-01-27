const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
// Try ANON KEY first, else fallback to Key (which might be service env var in some setups, but we need anon/public key for client auth)
// In server env, SUPABASE_KEY might be anon key.
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

console.log('Using URL:', supabaseUrl);
// console.log('Using Key:', supabaseKey); // Don't log full key

const supabase = createClient(supabaseUrl, supabaseKey);

async function proveStats() {
    console.log(`🔍 Proving Stats as Authenticated User (local@local.com)`);
    console.log('--------------------------------------------------');

    // 1. Login
    const { data: { session }, error: loginError } = await supabase.auth.signInWithPassword({
        email: 'local@local.com',
        password: 'test123'
    });

    if (loginError) {
        console.error('❌ Login Failed:', loginError.message);
        return;
    }

    const userId = session.user.id;
    console.log(`✅ Logged in Success. User ID: ${userId}`);

    // 2. Fetch Contacts with User Token
    // Create a client equivalent to what the Frontend/Server uses with Auth Token
    const userClient = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: `Bearer ${session.access_token}` } }
    });

    const { data: rawContacts, error } = await userClient
        .from('contacts')
        .select('id') // minimized select
        .eq('user_id', userId)
        .range(0, 9999);

    if (error) {
        console.error('❌ Fetch Error:', error);
    } else {
        console.log(`✅ [USER TOKEN FETCH] Total Records Returned: ${rawContacts.length}`);

        if (rawContacts.length === 1000) {
            console.log("\n⚠️⚠️⚠️  WARNING: HIT EXACTLY 1000 RECORDS  ⚠️⚠️⚠️");
            console.log("This confirms Supabase/API is capping the result at 1000 for Authenticated Users.");
            console.log("Likely 'max_rows' setting in Supabase API settings.");
        } else {
            console.log("\n✅ Result > 1000. No API Limit detected for User.");
        }
    }
}

proveStats();
