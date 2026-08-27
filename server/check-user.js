require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:8000';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-key';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data: users } = await supabase.from('profiles').select('id, email').eq('email', 'user3.compnet@gmail.com');
    if (!users || users.length === 0) { console.log('User not found'); return; }
    const { data: wallet } = await supabase.from('user_wallets').select('*').eq('user_id', users[0].id);
    console.log('Wallet:', wallet);
}
run();
