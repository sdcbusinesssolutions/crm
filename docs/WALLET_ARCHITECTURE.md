# Wallet & Billing Architecture (Zero-Loss System)

## 1. Overview
The billing architecture is designed to be a **Zero-Loss, Enterprise-Grade System**. It ensures that the platform never loses money due to sudden Meta price changes, lack of user funds, or concurrent campaign processing.

### Key Pillars
1. **Atomic Upfront Holds**: Reserving funds before a campaign starts.
2. **Strict Currency Matching**: Billing strictly based on the user's wallet currency (INR or USD).
3. **Webhook Reconciliation (True-Up)**: Catching mid-flight Meta price changes and adjusting balances automatically.
4. **Direct Meta Bypass**: Fully bypassing wallet checks for users who pay Meta directly.
5. **Campaign-Level Locking**: Preventing duplicate sends using a Row-Level Lock mechanism.

---

## 2. Billing Modes

### A. Prepaid Wallet Mode (`wallet_enforced = true`)
- Users must recharge their wallet.
- The system prevents the balance from going negative.
- If funds run out mid-campaign, the campaign stops instantly and remaining messages fail with `INSUFFICIENT_BALANCE`.

### B. Direct Meta Mode (`billing_mode = DIRECT_META`)
- The user has linked their own credit card directly to Meta.
- **Action**: The entire Wallet System (Atomic Holds, Pre-debits, Auto-Refunds) is completely bypassed.
- **Log Output**: `[Worker X] Started campaign Y [DIRECT_META / Zero Cost] - No upfront wallet hold required.`

---

## 3. The Campaign Flow (Bulk Sending)

When a user schedules a bulk campaign (e.g., 10,000 messages), the system follows this secure pipeline:

### Step 1: Upfront Atomic Hold (`processScheduledCampaigns`)
- The system checks the local cache (`template_components_cache`) to estimate the cost (e.g., Utility = ₹0.12).
- Calculation: `Estimated Cost = 10,000 * ₹0.12 = ₹1200`.
- The system calls the PostgreSQL RPC `hold_campaign_reservation`.
- If the user has `< ₹1200`, the hold fails, and the campaign instantly goes to `FAILED`.
- If the hold succeeds, ₹1200 is moved from `balance` to `reserved_balance`.

### Step 2: Batch Processing & Campaign Locking (`_processCampaignBatchInternal`)
- Workers claim exclusive ownership of the campaign using the `campaign_worker_claims` table (Unique Constraint). This guarantees **zero duplicate messages**.
- Messages are processed in batches of **500** (`DEFAULT_BATCH_SIZE`).

### Step 3: Pre-Tick Live Meta Check
- Before pulling the 500 messages, the worker forces a cache update:
  ```javascript
  await whatsappService.fetchLiveTemplateCategoryFromMeta(..., bypassCache = true)
  ```
- This ensures the worker knows the exact Meta category before the batch starts.

### Step 4: Pre-Debit per Message
- For each message, `WalletService.preDebit` is called.
- It parses the recipient's phone number to extract the precise **ISO-2 Country Code** (e.g., `US`, `IN`).
- It debits the exact platform rate from the `reserved_balance`.
- *Example*: If the batch has US numbers, it will debit the US rate (e.g., ₹2.00) instead of the Indian rate, draining the `reserved_balance` faster.

### Step 5: Auto-Release
- When the campaign finishes, any unspent money left in `reserved_balance` is automatically released back to `main_balance`.

---

## 4. Single Message Flow (Inbox / API)

For single messages sent via the Inbox or API:
- The system does **not** use the Campaign Worker.
- It calls `whatsappService.sendMessage` directly.
- **Instant Live Check**: Right before sending, the system makes a live API call to Meta to verify the exact category.
- It fails instantly with `LIVE_CATEGORY_FETCH_FAILED` if the check fails, ensuring no financial risk on single sends.

---

## 5. Webhook Reconciliation (True-Up Adjustments)

This is the ultimate safety net for mid-flight Meta price changes.

**Scenario**: 
- The worker pre-debits **₹0.12 (Utility)** and sends the message.
- Meta decides the message is actually **Marketing** and charges **₹0.86**.

**Resolution**:
1. Meta sends a Webhook Delivery Report containing the true category (Marketing).
2. The Webhook handler detects the discrepancy (₹0.86 - ₹0.12 = ₹0.74).
3. The system calls `adjust_wallet_balance` with `p_source = 'ADJUSTMENT'`.
4. The database instantly deducts the **₹0.74 difference** directly from the user's `main_balance`.
5. The Webhook updates the `template_components_cache` so the next batch uses the new Marketing rate.

---

## 6. Test Scenarios (Manual & Unit Test Guide)

Below are the critical scenarios to test to ensure the Zero-Loss Architecture is fully functional.

### Test Case 1: Insufficient Upfront Balance
- **Setup**: User balance is ₹500. Campaign requires ₹1200.
- **Action**: Start Campaign.
- **Expected Result**: Campaign fails immediately. UI/DB shows error `INSUFFICIENT_BALANCE: ₹1200 needed to start this campaign. Please top-up.` 0 messages sent.

### Test Case 2: Direct Meta Bypass
- **Setup**: Set user's `billing_mode` to `DIRECT_META`. Campaign cost is ₹5000. Wallet balance is ₹0.
- **Action**: Start Campaign.
- **Expected Result**: Campaign processes successfully. PM2 logs show `[DIRECT_META / Zero Cost] - No upfront wallet hold required`. Wallet balance remains ₹0.

### Test Case 3: Mixed Country Campaign (Fast Drain)
- **Setup**: User balance is ₹1200. Campaign has 6,000 IN numbers (₹0.12) and 4,000 US numbers (₹2.00). Upfront hold estimates 10,000 IN numbers = ₹1200.
- **Action**: Start Campaign.
- **Expected Result**: Campaign starts. As US numbers are processed, ₹2.00 is debited per message. The ₹1200 runs out after ~600 US messages. Campaign stops, remaining queue items marked `FAILED` (`INSUFFICIENT_BALANCE`).

### Test Case 4: Currency Isolation
- **Setup**: Set US rate to ₹2.00 in INR Tab, and $0.02 in USD Tab. User wallet is in `USD`.
- **Action**: User sends a message to a US number.
- **Expected Result**: System debits exactly `$0.02` from the wallet, not `2.00`.

### Test Case 5: Webhook True-Up (Category Change)
- **Setup**: Worker debits ₹0.12 (Utility).
- **Action**: Simulate a Meta Webhook payload marking the message as Marketing (₹0.86).
- **Expected Result**: Database creates a new transaction for `₹0.74` with source `ADJUSTMENT`. User's `main_balance` decreases by ₹0.74.

### Test Case 6: Duplicate Processing Prevention
- **Setup**: Run two instances of `campaign-worker` simultaneously.
- **Action**: Start a single campaign.
- **Expected Result**: Only one worker logs `Processing chunk`. The other worker silently skips due to `campaign_worker_claims` Unique Constraint (Lock).
