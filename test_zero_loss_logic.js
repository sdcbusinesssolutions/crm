/**
 * Zero-Loss Architecture Simulation Tests
 * Run with: node test_zero_loss_logic.js
 */

const CampaignWalletService = require('./server/services/CampaignWalletService');

// Mock Rates
const RATES = {
    'AUTHENTICATION': 0.11,
    'UTILITY': 0.32,
    'MARKETING': 0.89
};

function runSimulation(scenarioName, initialBalance, totalContacts, initialCategory, metaChangesCategoryAtMessage) {
    console.log(`\n======================================================`);
    console.log(`🧪 TEST SCENARIO: ${scenarioName}`);
    console.log(`======================================================`);
    console.log(`Initial Balance: ₹${initialBalance}`);
    console.log(`Total Contacts: ${totalContacts}`);
    console.log(`Initial Category: ${initialCategory} (₹${RATES[initialCategory]})`);
    
    let balance = initialBalance;
    let messagesSent = 0;
    let currentCategory = initialCategory;
    let platformLoss = 0;
    
    while (messagesSent < totalContacts) {
        // 1. Calculate Safe Batch
        const safeBatch = CampaignWalletService.calculateSafeBatchSize(balance, RATES['MARKETING'], 500);
        
        if (safeBatch <= 0) {
            console.log(`❌ INSUFFICIENT BALANCE: Cannot afford even 1 message at Marketing Rate.`);
            break;
        }

        const batchToSend = Math.min(safeBatch, totalContacts - messagesSent);
        console.log(`\n📦 STARTING BATCH: ${batchToSend} messages (Safe Capacity: ${safeBatch})`);
        
        // 2. Reserve at Marketing Rate
        const reservedAmount = batchToSend * RATES['MARKETING'];
        balance -= reservedAmount;
        console.log(`   🔒 Reserved ₹${reservedAmount.toFixed(2)} at Marketing Rate. (Available Balance: ₹${balance.toFixed(2)})`);
        
        // 3. Simulate Sending Batch
        let batchActualCost = 0;
        let batchMessagesSent = 0;

        for (let i = 0; i < batchToSend; i++) {
            // Did Meta change the category mid-flight?
            if (messagesSent + i === metaChangesCategoryAtMessage) {
                console.log(`   🚨 META CHANGED CATEGORY TO MARKETING AT MESSAGE ${messagesSent + i}!`);
                currentCategory = 'MARKETING';
            }
            
            // Webhook deducts the ACTUAL cost
            batchActualCost += RATES[currentCategory];
            batchMessagesSent++;
        }
        
        messagesSent += batchMessagesSent;
        
        // 4. Webhook Finalization (Release unused reserve)
        const amountToRefund = reservedAmount - batchActualCost;
        balance += amountToRefund;
        
        console.log(`   ✅ Batch Complete. Actual Cost: ₹${batchActualCost.toFixed(2)}`);
        console.log(`   💸 Webhook Refunded: ₹${amountToRefund.toFixed(2)}`);
        console.log(`   💰 Current Balance: ₹${balance.toFixed(2)}`);
        
        // Check if platform lost money
        if (balance < 0) {
            platformLoss += Math.abs(balance);
            console.error(`   💀 FATAL: WALLET WENT NEGATIVE! Platform lost ₹${Math.abs(balance).toFixed(2)}`);
            break; // Stop simulation on failure
        }
        
        // 5. Live Check triggers if batch finishes and category changed
        if (currentCategory !== initialCategory) {
            console.log(`   🛑 LIVE CHECK DETECTED CATEGORY CHANGE! Pausing campaign.`);
            break;
        }
    }
    
    console.log(`\n📊 SUMMARY FOR: ${scenarioName}`);
    console.log(`Total Messages Sent: ${messagesSent} / ${totalContacts}`);
    console.log(`Final Wallet Balance: ₹${balance.toFixed(2)}`);
    console.log(`Platform Loss: ₹${platformLoss.toFixed(2)}`);
    console.log(`Result: ${platformLoss === 0 && balance >= 0 ? '✅ PASSED (0-Loss Verified)' : '❌ FAILED'}`);
}

// --- TEST CASES ---

// Test 1: All Utility, No Changes (Normal Flow)
runSimulation("All Utility (Standard Happy Path)", 500, 1000, 'UTILITY', -1);

// Test 2: All Marketing (Most Expensive)
runSimulation("All Marketing", 500, 1000, 'MARKETING', -1);

// Test 3: Utility upgrades to Marketing mid-batch (The Ultimate Test)
runSimulation("Utility Upgrades to Marketing Mid-Batch (Loophole 3 Fix)", 500, 1000, 'UTILITY', 200);

// Test 4: Authentication upgrades to Marketing instantly
runSimulation("Auth Upgrades to Marketing on 1st Message", 200, 1000, 'AUTHENTICATION', 1);

// Test 5: Insufficient Balance Upfront
runSimulation("Insufficient Balance Upfront", 0.50, 1000, 'UTILITY', -1);

// Test 6: Rich User (Live Check Safety Cap)
runSimulation("Rich User Cap (Max 500 messages)", 10000, 2000, 'UTILITY', 700);

