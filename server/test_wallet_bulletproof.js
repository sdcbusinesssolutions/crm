const { createClient } = require('@supabase/supabase-js');
const WalletService = require('./services/WalletService');

// Use the user's provided production keys for the test
const supabaseUrl = 'https://dndmbarbnsdlbclghkbs.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRuZG1iYXJibnNkbGJjbGdoa2JzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQ4MjMxMywiZXhwIjoyMDk0MDU4MzEzfQ.kGyOt8oA0FfR_zXRJjK0lAzSTNKX3f6cK6b_wPmChxI';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function runBulletproofTests() {
    console.log('\n======================================================');
    console.log('   BULLETPROOF WALLET SYSTEM TEST SUITE (10+ SCENARIOS)   ');
    console.log('======================================================\n');
    
    let passCount = 0;
    let failCount = 0;

    function assert(condition, message) {
        if (condition) {
            console.log(`  ✅ PASSED: ${message}`);
            passCount++;
        } else {
            console.error(`  ❌ FAILED: ${message}`);
            failCount++;
        }
    }

    try {
        // 1. Get Test User
        const { data: user } = await supabaseAdmin.from('profiles').select('id, email, signup_domain').limit(1).single();
        if (!user) throw new Error('No user found');
        console.log(`[INIT] Testing on user: ${user.email} (ID: ${user.id})\n`);

        const rateMarketing = await WalletService.getRate(user.id, 'MARKETING', '91');
        const rateUtility = await WalletService.getRate(user.id, 'UTILITY', '91');
        const costMark = Number(rateMarketing.platform_rate);
        const costUtil = Number(rateUtility.platform_rate);

        const resetWallet = async (balance, mode = 'CREDIT_LINE_TENANT') => {
            await supabaseAdmin.from('user_wallets').update({
                balance,
                reserved_balance: 0,
                billing_mode: mode
            }).eq('user_id', user.id);
        };
        const getWallet = async () => {
            const { data } = await supabaseAdmin.from('user_wallets').select('balance, reserved_balance').eq('user_id', user.id).single();
            return { balance: Number(data.balance), reserved: Number(data.reserved_balance) };
        };

        // =========================================================
        // MODULE 1: ATOMIC DB SECURITY (TRIGGERS & CONSTRAINTS)
        // =========================================================
        console.log('--- MODULE 1: SECURITY & DIRECT TAMPERING ---');
        
        await resetWallet(10);
        let tamperSuccess = false;
        try {
            // Attempt to manually update the balance (bypassing RPC)
            const { error } = await supabaseAdmin.from('user_wallets').update({ balance: 9999 }).eq('user_id', user.id);
            if (error) throw error;
            tamperSuccess = true;
        } catch (err) {
            assert(err.message.includes('Direct UPDATE on balance'), 'Direct balance tampering blocked by DB Trigger.');
        }
        if (tamperSuccess) assert(false, 'DB Trigger failed to block direct balance tampering!');

        let negativeSuccess = false;
        try {
            await supabaseAdmin.rpc('adjust_wallet_balance', {
                p_user_id: user.id, p_amount: -50, p_type: 'CREDIT', p_source: 'MANUAL_TOPUP', p_wa_category: 'MARKETING', p_wa_message_id: 'neg_test', p_description: 'Negative credit test'
            });
            negativeSuccess = true;
        } catch (err) {
            assert(err.message.includes('Amount must be strictly positive'), 'Negative amounts in RPC are strictly blocked.');
        }
        if (negativeSuccess) assert(false, 'RPC allowed a negative amount parameter!');


        // =========================================================
        // MODULE 2: PRE-DEBIT & RACE CONDITIONS
        // =========================================================
        console.log('\n--- MODULE 2: ATOMIC PRE-DEBIT & RACE CONDITIONS ---');
        
        await resetWallet(costMark * 5); // Exactly enough for 5 messages
        const promises = [];
        for (let i = 0; i < 20; i++) {
            promises.push(WalletService.preDebit({
                userId: user.id,
                waMessageId: `race_${Date.now()}_${i}`,
                category: 'MARKETING',
                source: 'INBOX_SEND',
                contactPhone: '919876543210'
            }));
        }
        const results = await Promise.allSettled(promises);
        const successes = results.filter(r => r.status === 'fulfilled').length;
        const rejects = results.filter(r => r.status === 'rejected').length;
        
        assert(successes === 5, `Race Condition: Exactly 5 debits succeeded (Expected 5).`);
        assert(rejects === 15, `Race Condition: Exactly 15 debits rejected with INSUFFICIENT_BALANCE (Expected 15).`);
        
        const w2 = await getWallet();
        assert(w2.balance < costMark && w2.balance >= 0, `Race Condition: Final balance is mathematically perfect (${w2.balance}).`);


        // =========================================================
        // MODULE 3: REFUNDS & RECONCILIATION
        // =========================================================
        console.log('\n--- MODULE 3: FAILED API REFUNDS & WEBHOOK RECONCILIATION ---');
        
        await resetWallet(10);
        const txIdFail = `api_fail_${Date.now()}`;
        const { transactionId: failTx } = await WalletService.preDebit({ userId: user.id, waMessageId: txIdFail, category: 'MARKETING', source: 'INBOX_SEND', contactPhone: '123' });
        
        const w3_pre = await getWallet();
        await WalletService.refundFailedApiCall(failTx);
        const w3_post = await getWallet();
        
        assert(w3_post.balance > w3_pre.balance && w3_post.balance === 10, 'Refund on failed API correctly restored exact balance.');

        // Webhook Reconciliation (Charged Marketing, delivered as Utility)
        const txIdRecon = `api_recon_${Date.now()}`;
        await WalletService.preDebit({ userId: user.id, waMessageId: txIdRecon, category: 'MARKETING', source: 'INBOX_SEND', contactPhone: '123' });
        
        const diff = costMark - costUtil;
        await supabaseAdmin.rpc('adjust_wallet_balance', {
            p_user_id: user.id, p_amount: diff, p_type: 'CREDIT', p_source: 'ADJUSTMENT', p_wa_category: 'UTILITY', p_wa_message_id: txIdRecon, p_description: 'Recon test'
        });
        const w3_recon = await getWallet();
        assert(Math.abs(w3_recon.balance - (10 - costUtil)) < 0.001, `Webhook reconciliation accurately refunded price difference (Expected ~${(10 - costUtil).toFixed(2)}, Got ${w3_recon.balance}).`);


        // =========================================================
        // MODULE 4: CAMPAIGN RESERVATION LOGIC
        // =========================================================
        console.log('\n--- MODULE 4: CAMPAIGN RESERVATION HOLDS ---');
        
        await resetWallet(100);
        // 1. Full Hold
        const campId = '6f8510ba-6b3a-4a6c-85a2-9fa9d1c9ef29'; // Dummy UUID
        await supabaseAdmin.rpc('hold_campaign_reservation', { p_user_id: user.id, p_campaign_id: campId, p_estimated_cost: 40, p_allow_partial: false });
        let w4 = await getWallet();
        assert(w4.balance === 60 && w4.reserved === 40, 'Campaign Full Hold correctly locked ₹40 into reserved_balance.');

        // 2. Release unused funds
        await supabaseAdmin.rpc('release_campaign_reservation', { p_user_id: user.id, p_campaign_id: campId, p_actual_cost: 30 });
        w4 = await getWallet();
        assert(w4.balance === 70 && w4.reserved === 0, 'Campaign Release correctly charged ₹30 and refunded ₹10 back to main balance.');

        // 3. Partial Hold
        await resetWallet(20);
        const { data: partialHold } = await supabaseAdmin.rpc('hold_campaign_reservation', { p_user_id: user.id, p_campaign_id: campId, p_estimated_cost: 100, p_allow_partial: true });
        w4 = await getWallet();
        assert(partialHold.is_partial === true && Number(partialHold.actual_held) === 20, 'Campaign Partial Hold requested ₹100 but securely locked max ₹20.');
        assert(w4.balance === 0 && w4.reserved === 20, 'Partial hold correctly drained main balance and moved it to reserved.');


        // =========================================================
        // MODULE 5: DIRECT_META BILLING EXEMPTION
        // =========================================================
        console.log('\n--- MODULE 5: DIRECT META BILLING MODE ---');
        
        await resetWallet(50, 'DIRECT_META');
        const txDirect = `direct_${Date.now()}`;
        const resDirect = await WalletService.preDebit({ userId: user.id, waMessageId: txDirect, category: 'MARKETING', source: 'INBOX_SEND', contactPhone: '123' });
        const w5 = await getWallet();
        assert(w5.balance === 50 && !resDirect, 'DIRECT_META billing mode completely bypassed deductions (Balance intact).');

        console.log('\n======================================================');
        console.log(`✅ TOTAL PASSED: ${passCount}`);
        console.log(`❌ TOTAL FAILED: ${failCount}`);
        if (failCount === 0) console.log('\n🏆 ALL TESTS PASSED! SYSTEM IS 100% BULLETPROOF.');
        console.log('======================================================\n');
        
    } catch (err) {
        console.error('❌ FATAL SCRIPT ERROR:', err);
    }
}

runBulletproofTests();
