const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://ssckorsnhjhzqxyukexm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzY2tvcnNuaGpoenF4eXVrZXhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODM5OTcwOSwiZXhwIjoyMDgzOTc1NzA5fQ.aNUZx09EwkA4tEmHRK-LL4l-J6ySioqTY3c9PcQCJHc';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data: users, error: userErr } = await supabase.from('profiles').select('id, email').eq('email', 'user3.compnet@gmail.com');
    if (userErr) console.error(userErr);
    if (!users || users.length === 0) { console.log('User not found in DB'); return; }
    console.log('User:', users[0]);
    const { data: wallet, error: walletErr } = await supabase.from('user_wallets').select('*').eq('user_id', users[0].id);
    if (walletErr) console.error(walletErr);
    console.log('Wallet:', wallet);
}
run();
