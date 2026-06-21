const { supabaseAdmin } = require('../server/lib/supabaseClient');

async function findMaster(domain) {
    const { data: admins } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('signup_domain', domain)
        .eq('role', 'admin');
    
    if (!admins || admins.length === 0) return null;
    
    const adminIds = admins.map(a => a.id);
    const { data: wallets } = await supabaseAdmin
        .from('user_wallets')
        .select('*')
        .in('user_id', adminIds)
        .eq('is_tenant_master', true);
    
    console.log(wallets);
}

findMaster('cloudospire.in');
