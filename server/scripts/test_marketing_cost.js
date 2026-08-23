// Mocking the scenario
const balance = 500; // Total balance in Rupees
const platform_rate = 0.89; // Rate per message (89 paisa)
const total_messages = 10000;

console.log(`--- CAMPAIGN WORKER SIMULATION ---`);
console.log(`Total Messages to Send: ${total_messages}`);
console.log(`Wallet Balance: ₹${balance}`);
console.log(`Cost Per Message: ₹${platform_rate}`);

// 1. Calculate Estimated Cost
const estCost = total_messages * platform_rate;
console.log(`\n[Step 1] Estimated Total Cost: ₹${estCost}`);

// 2. Wallet Hold (Simulated)
let actualHeld = 0;
let isPartial = false;

if (balance >= estCost) {
    actualHeld = estCost;
} else {
    actualHeld = balance;
    isPartial = true;
}
console.log(`[Step 2] Actual Amount Held: ₹${actualHeld} (Partial Hold: ${isPartial})`);

// 3. Calculate Affordable Count
let affordableCount = total_messages;
if (isPartial) {
    affordableCount = Math.floor(actualHeld / platform_rate);
}
console.log(`[Step 3] Affordable Messages Calculated: ${affordableCount} messages`);

// 4. Marking Unaffordable Messages as FAILED (The new logic)
let messagesToFail = total_messages - affordableCount;
console.log(`\n[Step 4] Messages that need to be marked FAILED: ${messagesToFail}`);

let currentOffset = affordableCount;
const BATCH_LIMIT = 1000;
let batchNumber = 1;
let totalFailedInDB = 0;

while (currentOffset < total_messages) {
    // Simulating the DB Range query: .range(currentOffset, currentOffset + BATCH_LIMIT - 1)
    let endRange = Math.min(currentOffset + BATCH_LIMIT, total_messages);
    let itemsInBatch = endRange - currentOffset;
    
    console.log(`  -> Supabase Batch ${batchNumber}: Processing items from index ${currentOffset} to ${endRange - 1} (Total: ${itemsInBatch})`);
    
    totalFailedInDB += itemsInBatch;
    currentOffset += itemsInBatch;
    batchNumber++;
}

console.log(`\n--- FINAL RESULT ---`);
console.log(`✅ Messages successfully sent (PENDING for worker): ${affordableCount}`);
console.log(`❌ Messages correctly marked FAILED due to insufficient balance: ${totalFailedInDB}`);
console.log(`💰 Remaining Balance Used: ₹${affordableCount * platform_rate}`);
