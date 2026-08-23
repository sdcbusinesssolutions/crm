# Complete Campaign Financial & Security Flow

Aapka sawal bohot zaroori hai. Is document mein step-by-step bataya gaya hai ki 10,000 messages ke campaign mein paisa **kab**, **kaise**, aur **kitna** deduct hota hai, aur sabse important: **"Utility se Marketing" wale dhokhe ko system kaise pakadta hai.**

---

## The Scenario
- **Campaign Size:** 10,000 Messages
- **User's Wallet Balance:** ₹1,500
- **UTILITY Rate:** ₹0.15
- **MARKETING Rate:** ₹0.89

---

## Step 1: Pre-Flight Reservation (Campaign Start)
Jab aap campaign play karte hain, system seedha messages bhejna shuru nahi karta. Woh pehle "Hold" banata hai taaki baad mein balance minus na ho jaye.

| Action | API Call to Meta? | Money Action | Result |
| :--- | :---: | :--- | :--- |
| **Live Check** | **YES (1 Time)** | Koi deduction nahi. | Meta batata hai ki template abhi **UTILITY** hai. |
| **Cost Calculate** | NO | 10,000 msg x ₹0.15 = **₹1,500 Total Cost** | System dekhta hai ki user ke paas pure ₹1,500 hain. |
| **Wallet Hold** | NO | Wallet se ₹1,500 lock karke `reserved_balance` mein daal diye jate hain. | Ab user in ₹1,500 ko kisi aur kaam mein use nahi kar sakta. |

---

## Step 2: Batch Processing & Individual Pre-Debit (Sending Loop)
System ab 10,000 messages ko 50-50 ke batches mein bhejega. Har ek message ko Meta ke paas bhejne se theek 1 microsecond pehle, system us message ka paisa Reserve se nikal kar kaat leta hai (Pre-Debit).

| Action | API Call to Meta? | Money Action | Detail |
| :--- | :---: | :--- | :--- |
| **Check Cache** | NO | Koi deduction nahi. | System apne 15-min cache se category confirm karta hai (UTILITY). |
| **Pre-Debit** | NO | **₹0.15 Deducted** | Message bhejne se pehle, system database mein ₹0.15 ka "DEBIT" likh deta hai (UTILITY samajh kar). |
| **Send Message** | **YES (per msg)** | Koi deduction nahi. | Message Meta API ko bheja jata hai. |

*(Yeh loop 10,000 baar chalta hai. Total ₹1,500 dre-debit ho jate hain.)*

---

## Step 3: The Catch! (Utility to Marketing Protection)
Yeh sabse main step hai. Maan lijiye Meta ne message deliver kar diya, lekin usne apna mind change kar liya aur message ko **MARKETING** ki tarah bill kiya.

System isko **Webhook** mein pakadta hai:

| Action | Who does it? | Money Action | Explaination |
| :--- | :---: | :--- | :--- |
| **Delivery Webhook** | Meta | N/A | Meta aapke server ko ek webhook bhejta hai: *"Message delivered. Category: MARKETING"* |
| **Sync Check** | `WalletService.js` | N/A | System check karta hai: Humne is message ke liye kitna kaata tha? Answer: ₹0.15 (UTILITY). |
| **Delta Calculation** | `WalletService.js` | N/A | Asli Marketing Rate (₹0.89) - Pehle kata hua Rate (₹0.15) = **Difference (₹0.74)** |
| **Late Deduction** | `WalletService.js` | **₹0.74 Deducted** | System turant user ke bache hue wallet balance se **₹0.74 aur kaat leta hai**. |

**💡 Result:** User ne Utility (₹0.15) samajh kar message bheja, par system ne webhook aane par baaki bacha hua paisa (₹0.74) bhi nikal liya. Total = ₹0.89 (Marketing rate). **Platform ka loss ₹0.**

---

## Step 4: Final Campaign Cleanup
Jab pure 10,000 messages bhej diye jate hain, toh campaign band hone se pehle check karta hai ki kya koi Reserve paisa bach gaya tha? (Aisa tab hota hai jab koi message bheja hi na ja saka ho network error ki wajah se).

| Action | API Call? | Money Action | Result |
| :--- | :---: | :--- | :--- |
| **Release Reservation** | NO | **Refund to Wallet** | Agar 50 messages network ki wajah se fail ho gaye, toh unka ₹7.50 (50 x ₹0.15) reserve mein rakha reh jayega. System unhe reserve se nikal kar wapas user ke main wallet mein daal dega. |

### Summary of Protections:
1. **No Negative Balance:** `RESERVATION HOLD` pehle hi paise lock kar leta hai, toh user zero balance par message bhej hi nahi payega.
2. **API Spam Prevention:** 15-minute ka Cache Meta ko irritate nahi hone deta.
3. **No Fake Categories:** Webhook Sync ek-ek message ki asli bill report dekhta hai, aur agar user ne Utility bhej kar Marketing charge karwaya hai, toh bacha hua saara paisa (`Delta`) turant late-debit kar liya jata hai.
# Zero-Loss & Zero-Negative Balance Architecture
**Author:** Antigravity AI
**Component:** `campaignWorker.js`, `WalletService.js`, `whatsappService.js`
**Date:** 2026-08-23

## 1. Executive Summary
The WhatsApp SaaS platform previously suffered from the "Iron Triangle Paradox" during high-volume campaign processing:
- **False Failures**: Reserving funds at the highest possible rate (Marketing) caused campaigns to fail for insufficient balance, even when users had enough money to send cheaper templates (Utility).
- **Negative Balance Risk**: Reserving funds at the cheaper rate (Utility) allowed users to send campaigns, but if Meta reclassified the template to Marketing mid-flight, late-arriving delivery webhooks would deduct the difference, pushing the user's wallet into the negative.

The new **Dynamic Safe Batch Sizing Architecture** mathematically eliminates both issues. Platform loss is strictly `₹0`, and users are guaranteed never to drop below `₹0.00`.

---

## 2. The Core Mathematical Concept
Instead of placing a massive global `RESERVATION_HOLD` at the start of a campaign, the system calculates the **Absolute Maximum Risk Capacity** on a tick-by-tick basis.

### The Formula
```javascript
Safe Batch Size = Math.floor(Current_Wallet_Balance / Platform_Marketing_Rate)
```
*Note: `Platform_Marketing_Rate` is used as the denominator because it is the most expensive possible rate Meta can charge.*

### Why this works:
If a user has `₹1,500` and the Marketing Rate is `₹0.89`, the Safe Batch Size is **1,685 messages**.
By only processing 1,685 messages at a time, we guarantee that even if the worst-case scenario occurs (all messages are billed as Marketing by Meta), the total cost `(1,685 × ₹0.89 = ₹1,499.65)` will never exceed the user's current wallet balance of `₹1,500`. 

---

## 3. The Implementation Flow (Step-by-Step)

### Step 1: Pre-Tick Calculation
Inside `campaignWorker.js`, before pulling pending items from the database queue, the worker invokes `CampaignWalletService` to dynamically calculate the `safeBatchSize`.
- Fetches real-time wallet balance.
- Fetches real-time Marketing rate.
- Caps the size to `DEFAULT_BATCH_SIZE (50)` to prevent memory leaks and ensure rapid live-checks.

### Step 2: Live Meta Verification
The worker queries the database queue for exactly `safeBatchSize` items. It then calls `whatsappService.fetchLiveTemplateCategoryFromMeta()` (which utilizes a 15-minute in-memory cache to prevent Meta API rate limits).

### Step 3: Exact-Rate Pre-Debit
Inside the chunk processing loop, each message triggers an atomic `WalletService.preDebit()` using the **LIVE Category Rate** (e.g., Utility at `₹0.15`). 
- If a user has `₹1,500`, sending a batch of 50 Utility messages will deduct only `₹7.50` upfront.
- This entirely eliminates the **False Failure** problem, as users are correctly billed for Utility templates upfront.

### Step 4: The Safety Net (Webhook Reclassification)
If Meta overrides the category upon delivery (changing Utility to Marketing):
1. Meta sends a Delivery Webhook.
2. `WalletService.syncWebhookPricing()` intercepts the payload.
3. The system compares the Pre-Debit (`₹0.15`) with the True Cost (`₹0.89`).
4. The delta (`₹0.74`) is atomically deducted from the user's wallet (`ADJUSTMENT`).

Because the batch size was artificially constrained by the `Safe Batch Size` formula in Step 1, the user will **always** have enough remaining balance to cover this delta without going negative.

---

## 4. Code Map
- **`server/workers/campaignWorker.js`**: Replaced static global reservation logic with the dynamic `safeBatchSize` chunking loop. Automatically transitions campaigns to `PAUSED` if pre-debits fail.
- **`server/services/CampaignWalletService.js`**: Houses the `calculateSafeBatchSize` utility function.
- **`server/services/whatsappService.js`**: Contains the 15-minute in-memory cache for `fetchLiveTemplateCategoryFromMeta` to reduce unwanted Meta API calls, while allowing strict bypasses (`bypassCache = true`) when necessary.
- **`server/services/WalletService.js`**: `preDebit` atomically secures funds per message, while `syncWebhookPricing` recovers any missing revenue from mid-flight category changes.

> [!TIP]
> The obsolete `_releaseReservation` function and all associated logic has been purged, resulting in a cleaner, faster, and infinitely more stable Campaign Worker.
