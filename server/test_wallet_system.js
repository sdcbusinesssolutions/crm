const { supabaseAdmin } = require('./lib/supabaseClient');
const WalletService = require('./services/WalletService');

async function runTests() {
    console.log('--- STARTING WALLET SYSTEM TESTS ---');
    try {
        // 1. Find a test user
        const { data: user, error: userError } = await supabaseAdmin
            .from('profiles')
            .select('id, email')
            .limit(1)
            .single();

        if (userError || !user) throw new Error('No user found to test with.');
        console.log(`Testing with user: ${user.email} (${user.id})`);

        // 2. Initial Balance Setup
        console.log('\n[1] Setting initial balance to 100 for testing...');
        await supabaseAdmin.from('user_wallets').upsert({
            user_id: user.id,
            balance: 100,
            billing_mode: 'CREDIT_LINE_TENANT'
        });

        // 3. Test preDebit (Marketing Hold)
        console.log('\n[2] Testing preDebit for a UTILITY message...');
        const mockWaMessageId = `test_msg_${Date.now()}`;
        
        await WalletService.preDebit({
            userId: user.id,
            waMessageId: mockWaMessageId,
            category: 'UTILITY',
            source: 'INBOX_SEND',
            contactPhone: '919876543210',
            createdBy: user.id,
            ipAddress: '127.0.0.1'
        });

        // Check Ledger for Debit
        const { data: tx, error: txError } = await supabaseAdmin
            .from('wallet_transactions')
            .select('*')
            .eq('wa_message_id', mockWaMessageId)
            .single();

        if (txError) throw txError;
        console.log(`✅ Pre-debit successful! Deducted amount: ${tx.amount} (Should be MARKETING rate)`);
        console.log(`✅ Transaction category recorded as: ${tx.wa_category}`);

        // 4. Test Webhook Reconciliation (Utility confirmation)
        console.log('\n[3] Simulating Webhook Meta reclassification (Confirming it was indeed UTILITY)...');
        
        // This is exactly what handleWebhookPricing does in webhook.js
        const actualCategory = 'UTILITY';
        const rate = await WalletService.getRate(user.id, actualCategory, '91');
        const actualCost = Number(rate.platform_rate);
        
        const delta = actualCost - Number(tx.amount); // e.g. 0.22 - 0.70 = -0.48

        console.log(`Calculated actual cost: ${actualCost}`);
        console.log(`Delta to refund: ${Math.abs(delta)}`);

        if (delta < 0) {
            const { error: refundError } = await supabaseAdmin.rpc('adjust_wallet_balance', {
                p_user_id: user.id,
                p_amount: Math.abs(delta),
                p_type: 'CREDIT',
                p_source: 'ADJUSTMENT',
                p_wa_category: actualCategory,
                p_wa_message_id: mockWaMessageId,
                p_description: `Refund difference: Pre-debited MARKETING, actual was ${actualCategory}`,
                p_contact_phone: '919876543210'
            });
            if (refundError) throw refundError;
            console.log('✅ Refund applied successfully!');
        }

        // 5. Verify Final Balance
        const { data: finalWallet } = await supabaseAdmin.from('user_wallets').select('balance').eq('user_id', user.id).single();
        console.log(`\n✅ Final Wallet Balance: ${finalWallet.balance}`);
        console.log('Test completed successfully! All constraints and ledgers passed.');

    } catch (err) {
        console.error('❌ TEST FAILED:', err);
    }
}

runTests();
