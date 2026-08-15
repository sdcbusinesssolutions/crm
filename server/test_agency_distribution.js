const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dndmbarbnsdlbclghkbs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRuZG1iYXJibnNkbGJjbGdoa2JzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQ4MjMxMywiZXhwIjoyMDk0MDU4MzEzfQ.kGyOt8oA0FfR_zXRJjK0lAzSTNKX3f6cK6b_wPmChxI';
const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

async function runTest() {
    console.log("🚀 Starting Agency Distribution Test Case...");

    const domain = 'test-agency.com';
    const tenantAdminId = '11111111-1111-1111-1111-111111111111';

    // 1. Setup Tenant Admin Profile
    const { error: pErr } = await supabase.from('profiles').upsert({
        id: tenantAdminId,
        email: 'admin@test-agency.com',
        name: 'Test Tenant Admin',
        role: 'admin',
        signup_domain: domain,
        plan_status: 'active'
    });
    if (pErr) console.error("Profile Error:", pErr);
    
    // 2. Setup Tenant Master Wallet and set balance to 0 first
    const { error: mwErr } = await supabase.rpc('ensure_tenant_master_wallet', { p_tenant_admin_user_id: tenantAdminId });
    if (mwErr) console.error("MW Ensure Error:", mwErr);
    
    await supabase.from('user_wallets').update({ balance: 0 }).eq('user_id', tenantAdminId).eq('is_tenant_master', true);

    // 3. Super Admin adds 10,000 to Tenant Admin Master Wallet
    console.log("💰 Super Admin adding ₹10,000 to Tenant Admin's Master Wallet...");
    const { error: addErr } = await supabase.rpc('adjust_wallet_balance', {
        p_user_id: tenantAdminId,
        p_amount: 10000,
        p_type: 'CREDIT',
        p_source: 'ADMIN_TOPUP',
        p_wa_category: null,
        p_wa_message_id: null,
        p_wa_conversation_id: null,
        p_conversation_expiry: null,
        p_description: 'Super Admin wholesale credit test',
        p_contact_phone: null,
        p_campaign_id: null,
        p_drip_campaign_id: null,
        p_flow_id: null,
        p_whatsapp_account_id: null,
        p_meta_cost: 0,
        p_created_by: null,
        p_ip_address: null
    });
    if (addErr) console.error("Add Credit Error:", addErr);

    const { data: masterWallet, error: mwGetErr } = await supabase.from('user_wallets').select('balance').eq('user_id', tenantAdminId).eq('is_tenant_master', true).single();
    if (mwGetErr) console.error("Get Master Wallet Error:", mwGetErr);
    console.log(`✅ Tenant Master Wallet Balance: ₹${masterWallet ? masterWallet.balance : 'ERROR'}`);

    // 4. Create 10 Users (5 Direct Meta, 5 Wallet)
    const directMetaUsers = [];
    const walletUsers = [];
    
    for (let i = 1; i <= 10; i++) {
        const userId = `22222222-2222-2222-2222-22222222220${i === 10 ? '0' : i}`;
        const mode = i <= 5 ? 'DIRECT_META' : 'CREDIT_LINE_TENANT';
        
        await supabase.from('profiles').upsert({
            id: userId,
            email: `user${i}@test-agency.com`,
            name: `Test User ${i}`,
            role: 'user',
            signup_domain: domain,
            plan_status: 'active'
        });
        
        await supabase.from('user_wallets').upsert({
            user_id: userId,
            balance: 0,
            billing_mode: mode
        });
        
        if (mode === 'DIRECT_META') directMetaUsers.push(userId);
        else walletUsers.push(userId);
    }
    console.log(`👥 Created 10 users: 5 on DIRECT_META, 5 on CREDIT_LINE_TENANT.`);

    // 5. Tenant Admin distributes 500 to each user
    console.log("💸 Tenant Admin attempting to distribute ₹500 to each of the 10 users...");
    let successfulTransfers = 0;
    
    for (let i = 1; i <= 10; i++) {
        const userId = `22222222-2222-2222-2222-22222222220${i === 10 ? '0' : i}`;
        const { error } = await supabase.rpc('transfer_reseller_balance', {
            p_tenant_admin_user_id: tenantAdminId,
            p_target_user_id: userId,
            p_amount: 500,
            p_description: 'Test distribution'
        });
        
        if (!error) successfulTransfers++;
        else console.error(`Failed transfer to user${i}:`, error.message);
    }

    // 6. Check Final Balances
    const { data: finalMasterWallet } = await supabase.from('user_wallets').select('balance').eq('user_id', tenantAdminId).eq('is_tenant_master', true).single();
    
    console.log(`\n📊 --- RESULTS ---`);
    console.log(`✅ Total successful transfers: ${successfulTransfers} / 10`);
    console.log(`✅ Agency Master Wallet Remaining Balance: ₹${finalMasterWallet ? finalMasterWallet.balance : 'ERROR'}`);
    
    // Check one Direct Meta and one Wallet user
    const { data: dmUser } = await supabase.from('user_wallets').select('balance, billing_mode').eq('user_id', directMetaUsers[0]).single();
    const { data: wlUser } = await supabase.from('user_wallets').select('balance, billing_mode').eq('user_id', walletUsers[0]).single();
    
    console.log(`\n🔍 User Sample (Direct Meta): Balance = ₹${dmUser.balance}, Mode = ${dmUser.billing_mode}`);
    console.log(`🔍 User Sample (Wallet System): Balance = ₹${wlUser.balance}, Mode = ${wlUser.billing_mode}`);
    
    // Cleanup
    await supabase.from('profiles').delete().eq('signup_domain', domain);
}

runTest().catch(console.error);
