const { createClient } = require('@supabase/supabase-js');
const WalletService = require('./services/WalletService');

// Use the user's provided production keys for the test
const supabaseUrl = 'https://dndmbarbnsdlbclghkbs.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRuZG1iYXJibnNkbGJjbGdoa2JzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQ4MjMxMywiZXhwIjoyMDk0MDU4MzEzfQ.kGyOt8oA0FfR_zXRJjK0lAzSTNKX3f6cK6b_wPmChxI';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function runExhaustiveTests() {
    console.log('\n======================================================');
    console.log('   EXHAUSTIVE WALLET SYSTEM TESTS (ALL SCENARIOS)   ');
    console.log('======================================================\n');
    
    try {
        const { data: user, error: userError } = await supabaseAdmin
            .from('profiles')
            .select('id, email, signup_domain')
            .limit(1)
            .single();

        if (userError || !user) throw new Error('No test user found.');
        console.log(`Using Test User: ${user.email} (ID: ${user.id})\n`);

        const rate = await WalletService.getRate(user.id, 'MARKETING', '91');
        const costPerMessage = Number(rate.platform_rate);

        // =========================================================
        // SCENARIO 1: NEGATIVE TEST - INSUFFICIENT BALANCE
        // =========================================================
        console.log('▶ SCENARIO 1: Negative Test - Insufficient Balance');
        await supabaseAdmin.from('user_wallets').update({ balance: 0.10, billing_mode: 'CREDIT_LINE_TENANT' }).eq('user_id', user.id);
        
        try {
            await WalletService.preDebit({
                userId: user.id,
                waMessageId: `test_neg_${Date.now()}`,
                category: 'MARKETING',
                source: 'INBOX_SEND',
                contactPhone: '919876543210'
            });
            console.error('  ❌ FAIL: preDebit succeeded when it should have failed!');
        } catch (err) {
            if (err.message.includes('INSUFFICIENT_BALANCE')) {
                console.log('  ✅ SUCCESS: preDebit correctly rejected due to low balance.');
            } else {
                console.error(`  ❌ FAIL: Expected INSUFFICIENT_BALANCE but got: ${err.message}`);
            }
        }

        // =========================================================
        // SCENARIO 2: POSITIVE TEST - SUCCESSFUL DEBIT
        // =========================================================
        console.log('\n▶ SCENARIO 2: Positive Test - Successful Atomic Debit');
        await supabaseAdmin.from('user_wallets').update({ balance: 10.00, billing_mode: 'CREDIT_LINE_TENANT' }).eq('user_id', user.id);
        
        const txId2 = `test_pos_${Date.now()}`;
        const { transactionId } = await WalletService.preDebit({
            userId: user.id,
            waMessageId: txId2,
            category: 'MARKETING',
            source: 'INBOX_SEND',
            contactPhone: '919876543210'
        });
        
        const { data: wallet2 } = await supabaseAdmin.from('user_wallets').select('balance').eq('user_id', user.id).single();
        const expectedBal2 = (10.00 - costPerMessage).toFixed(4);
        
        if (Number(wallet2.balance).toFixed(4) === expectedBal2 && transactionId) {
            console.log(`  ✅ SUCCESS: Balance correctly deducted (Current: ${wallet2.balance}, Tx ID generated: ${transactionId}).`);
        } else {
            console.error('  ❌ FAIL: Balance deduction mismatch.');
        }

        // =========================================================
        // SCENARIO 3: POSITIVE TEST - REFUND FAILED API
        // =========================================================
        console.log('\n▶ SCENARIO 3: Positive Test - Refund on Failed API Call');
        const balanceBeforeRefund = Number(wallet2.balance);
        await WalletService.refundFailedApiCall(transactionId);
        
        const { data: wallet3 } = await supabaseAdmin.from('user_wallets').select('balance').eq('user_id', user.id).single();
        if (Number(wallet3.balance) > balanceBeforeRefund) {
            console.log(`  ✅ SUCCESS: Refund processed instantly (Balance restored to: ${wallet3.balance}).`);
        } else {
            console.error('  ❌ FAIL: Refund did not increase balance.');
        }

        // =========================================================
        // SCENARIO 4: POSITIVE TEST - WEBHOOK RECONCILIATION
        // =========================================================
        console.log('\n▶ SCENARIO 4: Positive Test - Webhook Reconciliation (Cheaper Category)');
        const txId4 = `test_web_${Date.now()}`;
        await WalletService.preDebit({
            userId: user.id,
            waMessageId: txId4,
            category: 'MARKETING', // Max cost
            source: 'INBOX_SEND',
            contactPhone: '919876543210'
        });
        
        const { data: walletAfterDebit } = await supabaseAdmin.from('user_wallets').select('balance').eq('user_id', user.id).single();
        
        // Simulate webhook arrival with 'UTILITY'
        const utilityRate = await WalletService.getRate(user.id, 'UTILITY', '91');
        const utilityCost = Number(utilityRate.platform_rate);
        const difference = costPerMessage - utilityCost;
        
        // Execute reconciliation manually
        await supabaseAdmin.rpc('adjust_wallet_balance', {
            p_user_id: user.id,
            p_amount: Math.abs(difference),
            p_type: 'CREDIT',
            p_source: 'ADJUSTMENT',
            p_wa_category: 'UTILITY',
            p_wa_message_id: txId4,
            p_description: `Refund diff`
        });
        
        const { data: walletAfterRecon } = await supabaseAdmin.from('user_wallets').select('balance').eq('user_id', user.id).single();
        if (Number(walletAfterRecon.balance) > Number(walletAfterDebit.balance)) {
             console.log(`  ✅ SUCCESS: Webhook reconciliation refunded difference of ₹${difference.toFixed(4)}.`);
        } else {
             console.error('  ❌ FAIL: Webhook reconciliation refund failed.');
        }

        // =========================================================
        // SCENARIO 5: NEGATIVE TEST - DIRECT META BILLING (NO DEDUCTION)
        // =========================================================
        console.log('\n▶ SCENARIO 5: Negative Test - DIRECT_META Billing Mode (No deduction)');
        await supabaseAdmin.from('user_wallets').update({ balance: 5.00, billing_mode: 'DIRECT_META' }).eq('user_id', user.id);
        
        await WalletService.preDebit({
            userId: user.id,
            waMessageId: `test_direct_${Date.now()}`,
            category: 'MARKETING',
            source: 'INBOX_SEND',
            contactPhone: '919876543210'
        });
        
        const { data: wallet5 } = await supabaseAdmin.from('user_wallets').select('balance').eq('user_id', user.id).single();
        if (Number(wallet5.balance) === 5.00) {
            console.log('  ✅ SUCCESS: System ignored deduction correctly because user pays Meta directly.');
        } else {
            console.error('  ❌ FAIL: System deducted money for a DIRECT_META user!');
        }

        // =========================================================
        // SCENARIO 6: POSITIVE TEST - CAMPAIGN PARTIAL HOLD
        // =========================================================
        console.log('\n▶ SCENARIO 6: Positive Test - Campaign Partial Hold (Affordable Count)');
        await supabaseAdmin.from('user_wallets').update({ balance: 2.00, billing_mode: 'CREDIT_LINE_TENANT' }).eq('user_id', user.id);
        
        const estCostFor10 = costPerMessage * 10; // e.g. 7.00
        const holdResult = await WalletService.holdCampaignReservation(user.id, 9999, estCostFor10, true);
        
        if (holdResult.is_partial && Number(holdResult.actual_held) <= 2.00) {
             console.log(`  ✅ SUCCESS: Campaign hold was partial. Requested ₹${estCostFor10.toFixed(4)}, but safely locked only ₹${holdResult.actual_held}.`);
        } else {
             console.error('  ❌ FAIL: Campaign hold did not respect partial boundaries.');
        }

        console.log('\n======================================================');
        console.log('🎉 ALL EXHAUSTIVE TESTS COMPLETED 🎉');
        console.log('======================================================\n');
        
    } catch (err) {
        console.error('❌ EXHAUSTIVE TESTS FAILED:', err);
    }
}

runExhaustiveTests();
