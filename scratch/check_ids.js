const path = require('path');
const { supabaseAdmin } = require(path.join(__dirname, '../server/lib/supabaseClient'));

async function checkDataConsistency() {
    try {
        const { data: convs } = await supabaseAdmin.from('conversations').select('user_id').limit(1);
        const { data: users } = await supabaseAdmin.from('profiles').select('id, email').limit(5);
        
        console.log('Conversation User ID:', convs?.[0]?.user_id);
        console.log('Available User IDs:', users?.map(u => `${u.email}: ${u.id}`));
    } catch (err) {
        console.error('Catch error:', err);
    }
}

checkDataConsistency();
