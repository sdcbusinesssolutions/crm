const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testRoundRobin() {
    const userId = "c656e1bc-ab2d-4cc8-aa6c-0dfce933dd78"; // user 1
    const { data: authData } = await supabaseAdmin.auth.admin.getUserById(userId);
    console.log("Current Auto Assign Settings:", authData.user.user_metadata?.team_settings?.auto_assign);
}
testRoundRobin();
