const { supabaseAdmin } = require('./lib/supabaseClient');
const WalletService = require('./services/WalletService');

async function runRaceConditionTest() {
    console.log('--- STARTING WALLET RACE CONDITION (DOUBLE SPEND) TEST ---');
    try {
        // 1. Find a test user
        const { data: user, error: userError } = await supabaseAdmin
            .from('profiles')
            .select('id, email')
            .limit(1)
            .single();

        if (userError || !user) throw new Error('No user found to test with.');
        console.log(`Testing with user: ${user.email} (${user.id})`);

        // 2. Set Balance to ₹5.00
        const STARTING_BALANCE = 5.00;
        console.log(`\n[1] Setting initial balance to ₹${STARTING_BALANCE} for testing...`);
        
        await supabaseAdmin.from('user_wallets').update({
            balance: STARTING_BALANCE,
            reserved_balance: 0,
            billing_mode: 'CREDIT_LINE_TENANT'
        }).eq('user_id', user.id);

        // 3. Clear previous test transactions for clean counting
        const TEST_PREFIX = `race_test_${Date.now()}`;

        // 4. Fire 50 concurrent preDebit requests (Race Condition)
        const CONCURRENT_REQUESTS = 50;
        console.log(`\n[2] Firing ${CONCURRENT_REQUESTS} concurrent preDebit requests (0ms delay between them)...`);
        
        const rate = await WalletService.getRate(user.id, 'MARKETING', '91');
        const costPerMessage = Number(rate.platform_rate);
        
        console.log(`Cost per MARKETING message: ₹${costPerMessage}`);
        const expectedSuccesses = Math.floor(STARTING_BALANCE / costPerMessage);
        console.log(`Mathematical Maximum Affordable Messages: ${expectedSuccesses}`);

        const promises = [];
        for (let i = 0; i < CONCURRENT_REQUESTS; i++) {
            promises.push(WalletService.preDebit({
                userId: user.id,
                waMessageId: `${TEST_PREFIX}_${i}`,
                category: 'MARKETING',
                source: 'INBOX_SEND',
                contactPhone: '919876543210'
            }));
        }

        const results = await Promise.allSettled(promises);

        const successes = results.filter(r => r.status === 'fulfilled').length;
        const failures = results.filter(r => r.status === 'rejected').length;

        console.log(`\n--- TEST RESULTS ---`);
        console.log(`Total Requests Sent: ${CONCURRENT_REQUESTS}`);
        console.log(`✅ Successful Debits: ${successes}`);
        console.log(`❌ Rejected Debits (INSUFFICIENT_BALANCE): ${failures}`);

        if (successes !== expectedSuccesses) {
            console.error(`🚨 FAIL: Expected ${expectedSuccesses} successes, but got ${successes}! Double-spend occurred!`);
        } else {
            console.log(`🏆 SUCCESS: System correctly limited to exactly ${expectedSuccesses} messages! ATOMIC LOCK WORKED!`);
        }

        // 5. Verify Final Balance
        const { data: finalWallet } = await supabaseAdmin.from('user_wallets').select('balance').eq('user_id', user.id).single();
        const expectedFinalBalance = (STARTING_BALANCE - (successes * costPerMessage)).toFixed(4);
        
        console.log(`\nFinal Wallet Balance: ₹${finalWallet.balance}`);
        console.log(`Expected Wallet Balance: ₹${expectedFinalBalance}`);
        
        if (Number(finalWallet.balance).toFixed(4) === expectedFinalBalance) {
            console.log('✅ Final balance matches perfectly. No money leaked!');
        } else {
            console.error('🚨 Final balance mismatch!');
        }

        // 6. Verify Transaction Ledger
        const { data: txList } = await supabaseAdmin.from('wallet_transactions').select('id, amount').eq('user_id', user.id).like('wa_message_id', `${TEST_PREFIX}%`);
        console.log(`\nLedger Check: Found ${txList.length} transaction rows in database.`);
        if (txList.length === successes) {
             console.log('✅ Ledger row count matches successful debits. System is bullet-proof.');
        } else {
             console.error('🚨 Ledger count mismatch!');
        }

    } catch (err) {
        console.error('❌ TEST SCRIPT FAILED:', err);
    }
}

runRaceConditionTest();
