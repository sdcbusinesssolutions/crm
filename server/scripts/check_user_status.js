const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dndmbarbnsdlbclghkbs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRuZG1iYXJibnNkbGJjbGdoa2JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0ODIzMTMsImV4cCI6MjA5NDA1ODMxM30.zhSXFd4U-atQCjNWMP8Y1eGI756iblDyvgG5tgv7S70';

const client = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
});

async function inspectUser(email, password) {
    console.log(`\n🔍 Inspecting user: ${email}...`);
    
    // 1. Sign In
    const { data: authData, error: authError } = await client.auth.signInWithPassword({
        email,
        password
    });
    
    if (authError) {
        console.error(`❌ Authentication failed:`, authError.message);
        return;
    }
    
    const userId = authData.user.id;
    console.log(`✅ Authenticated. User ID: ${userId}`);
    
    // 2. Fetch Profile
    const { data: profile, error: profileError } = await client
        .from('profiles')
        .select('signup_domain, role')
        .eq('id', userId)
        .single();
        
    if (profileError) {
        console.error(`❌ Profile fetch failed:`, profileError.message);
    } else {
        console.log(`📋 Profile signup_domain: "${profile?.signup_domain}", role: "${profile?.role}"`);
    }
    
    // 3. Run Plan Check RPC
    try {
        const { data: planStatus, error: planError } = await client.rpc('check_user_plan_status', {
            target_user_id: userId
        });
        
        if (planError) {
            console.error(`❌ RPC check_user_plan_status failed:`, planError.message);
        } else {
            console.log(`📊 RPC check_user_plan_status response:`, JSON.stringify(planStatus));
        }
    } catch (err) {
        console.error(`❌ RPC check_user_plan_status threw error:`, err.message);
    }
}

async function run() {
    // Force IPv4 first to bypass local network IPv6 blocks
    require('dns').setDefaultResultOrder('ipv4first');
    
    await inspectUser('user3@gmail.com', 'test1234');
    await inspectUser('kumar@gmail.com', 'sonudev@2211');
}

run().catch(console.error);
