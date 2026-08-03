const { createClient } = require('@supabase/supabase-js');
const WalletService = require('./services/WalletService');

// Use the user's provided production keys for the test
const supabaseUrl = 'https://dndmbarbnsdlbclghkbs.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRuZG1iYXJibnNkbGJjbGdoa2JzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQ4MjMxMywiZXhwIjoyMDk0MDU4MzEzfQ.kGyOt8oA0FfR_zXRJjK0lAzSTNKX3f6cK6b_wPmChxI';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function testWebhookRaceCondition() {
    console.log('\n======================================================');
    console.log('   TESTING WEBHOOK IDEMPOTENCY RACE CONDITION   ');
    console.log('======================================================\n');
    
    try {
        const { data: user } = await supabaseAdmin.from('profiles').select('id').limit(1).single();
        
        // 1. Reset balance to exactly ₹10
        await supabaseAdmin.from('user_wallets').update({ balance: 10, billing_mode: 'CREDIT_LINE_TENANT' }).eq('user_id', user.id);
        
        // 2. Perform a pre-debit at MARKETING rate (e.g., ₹0.70)
        const waMsgId = `webhook_race_${Date.now()}`;
        await WalletService.preDebit({
            userId: user.id,
            waMessageId: waMsgId,
            category: 'MARKETING',
            source: 'INBOX_SEND',
            contactPhone: '919876543210'
        });
        
        const { data: balAfterDebit } = await supabaseAdmin.from('user_wallets').select('balance').eq('user_id', user.id).single();
        console.log(`Balance after preDebit (MARKETING): ₹${balAfterDebit.balance}`);
        
        // 3. Simulate an attacker bombarding the webhook endpoint with 10 identical webhook payloads AT THE EXACT SAME TIME
        // Telling the system the message was actually UTILITY (e.g. ₹0.22) to trigger a refund of ~₹0.48.
        const promises = [];
        const mockPricing = { category: 'UTILITY', billable: true };
        
        for (let i = 0; i < 10; i++) {
            // Trigger 10 parallel webhook reconciliation calls
            promises.push(WalletService.handleWebhookPricing(user.id, waMsgId, mockPricing));
        }
        
        await Promise.all(promises);
        
        // 4. Check the final balance
        const { data: balAfterWebhook } = await supabaseAdmin.from('user_wallets').select('balance').eq('user_id', user.id).single();
        console.log(`\nFinal Balance after 10 parallel Webhooks: ₹${balAfterWebhook.balance}`);
        
        // 5. Count how many REFUND rows were actually inserted for this single message
        const { data: txs } = await supabaseAdmin
            .from('wallet_transactions')
            .select('*')
            .eq('wa_message_id', waMsgId)
            .eq('source', 'ADJUSTMENT');
            
        console.log(`Total ADJUSTMENT/REFUND rows created: ${txs.length}`);
        
        if (txs.length > 1) {
            console.error('\n🚨 VULNERABILITY FOUND: The system processed multiple refunds for the SAME message!');
        } else {
            console.log('\n✅ SYSTEM SECURE: Only one refund was processed.');
        }

    } catch (err) {
        console.error(err);
    }
}

testWebhookRaceCondition();
