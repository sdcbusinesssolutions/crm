# WhatsApp Wallet & Billing System — Architecture & Implementation Plan

**Current State:** No wallet, no billing, no cost tracking exists in the codebase. The `messages` table has no cost columns. The `plans.pricing` is an unused JSONB blob. This is a greenfield build.

---

## 0. The Two-Mode Design (Most Important Section)

The wallet system operates in exactly **two modes**. The mode is controlled by a single flag `wallet_enforced` set by Super Admin or Tenant Admin per user/workspace.

### Mode A — Report-Only (Default for ALL users)
> `wallet_enforced = false`

- ✅ **Every user can always see their usage report** — message history, cost breakdown by category (Marketing / Utility / Service), totals by date range
- ✅ The system still **logs every message cost** silently in the background (so the report is always populated)
- ❌ **No balance checking.** Messages are never blocked or paused
- ❌ **No deduction from any balance.** Even if the wallet has ₹0, sending is unrestricted
- 💡 This is the default. All your existing 1 lakh users are in this mode by default, so nothing changes for them

### Mode B — Enforced Wallet (Admin must explicitly enable)
> `wallet_enforced = true` AND admin has topped up a balance amount

- ✅ All reporting from Mode A is still available
- ✅ **Before every message send:** system checks if `wallet_balance >= estimated_cost`
- ✅ **After Meta confirms delivery:** system deducts the exact amount from the user's balance
- ✅ **If balance = ₹0:** system blocks sending (Campaigns pause, Flow messages fail gracefully, API returns 402)
- ✅ **Low balance alert** is sent when balance drops below a configurable threshold (e.g., ₹50)
- 🔒 Only Super Admin or Tenant Admin can flip this flag ON and add funds

### Mode Decision Flowchart
```
Message Send Attempted
        │
        ▼
 wallet_enforced = true?
    │           │
   YES          NO
    │           │
    ▼           ▼
Check balance   Skip check → Send directly
    │
 Sufficient?
  │       │
 YES      NO
  │       │
Send    Block → Return error to UI
  │
Log cost (PENDING)
  │
Webhook confirms?
  │
Deduct (CONFIRMED)
```

---

## 0B. Who Can Do What

| Action | Super Admin | Tenant Admin | End User |
|---|---|---|---|
| View cost report | ✅ | ✅ | ✅ Always |
| View wallet balance | ✅ | ✅ | ✅ (read-only) |
| Top-up wallet balance | ✅ | ✅ | ❌ |
| Enable/disable enforcement | ✅ | ✅ (for their own workspace) | ❌ |
| Set per-message rate | ✅ Only | ❌ | ❌ |

---

## 1. How WhatsApp Billing Actually Works (Meta's Model)

Meta charges per **conversation**, not per message. One conversation = 24 hours of messaging after the first message.

| Category | Who Initiates | Example | Charged? |
|---|---|---|---|
| **Marketing** | Business | Campaign blasts, promos | ✅ Yes (highest cost) |
| **Utility** | Business | Order confirmation, OTP | ✅ Yes (medium cost) |
| **Authentication** | Business | Login OTP, 2FA | ✅ Yes |
| **Service** | Customer messages first | Customer sends "Hi" | ✅ Yes (lowest cost, sometimes free) |

**Your Platform Model:**
You are a SaaS provider. You buy conversations from Meta at cost, and charge your users a markup. The wallet system tracks this so you can:
1. Deduct from user's wallet per billable event
2. Show the user a detailed breakdown report
3. Stop sending when wallet hits zero (optional)

---

## 2. Database Schema (New Tables Needed)

### A. Wallet Table (Balance per User)
```sql
CREATE TABLE public.user_wallets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    balance NUMERIC(12, 4) DEFAULT 0.0000 NOT NULL, -- e.g. ₹150.2500
    currency TEXT DEFAULT 'INR' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
```

### B. Wallet Transactions Table (Every Debit/Credit)
```sql
CREATE TABLE public.wallet_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Transaction Type
    type TEXT NOT NULL CHECK (type IN ('CREDIT', 'DEBIT')),
    amount NUMERIC(12, 4) NOT NULL, -- Always positive. Use 'type' for direction.
    balance_after NUMERIC(12, 4) NOT NULL, -- Snapshot of balance after this tx
    
    -- What triggered this transaction?
    source TEXT NOT NULL CHECK (source IN (
        'ADMIN_TOPUP',       -- Super admin manually topped up
        'RECHARGE',          -- User recharged via payment gateway
        'CAMPAIGN_SEND',     -- Campaign batch sent
        'DRIP_SEND',         -- Drip campaign message sent
        'FLOW_SEND',         -- Flow automation message sent
        'INBOX_SEND',        -- Agent manually replied in Inbox
        'API_SEND',          -- External API call
        'REFUND',            -- Refund issued
        'ADJUSTMENT'         -- Manual correction by admin
    )),
    
    -- WhatsApp Billing Details
    wa_category TEXT CHECK (wa_category IN ('MARKETING', 'UTILITY', 'AUTHENTICATION', 'SERVICE')),
    wa_conversation_id TEXT, -- Meta's conversation ID from webhook status
    wa_message_id TEXT,      -- Meta's wamid
    message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
    
    -- Context
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
    drip_campaign_id UUID REFERENCES public.drip_campaigns(id) ON DELETE SET NULL,
    flow_id UUID REFERENCES public.flows(id) ON DELETE SET NULL,
    contact_phone TEXT,
    
    -- Cost Breakdown
    meta_cost NUMERIC(12, 6),    -- What Meta charges you (your cost)
    platform_cost NUMERIC(12, 4), -- What you charge the user (with markup)
    markup_percent NUMERIC(5, 2), -- Markup applied
    
    description TEXT,             -- Human-readable note
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_wallet_tx_user_id ON public.wallet_transactions(user_id, created_at DESC);
CREATE INDEX idx_wallet_tx_source ON public.wallet_transactions(user_id, source, created_at DESC);
CREATE INDEX idx_wallet_tx_wa_category ON public.wallet_transactions(user_id, wa_category, created_at DESC);
```

### C. Message Cost Rates Table (Admin-Configurable Pricing)

This table allows **both Super Admin and Tenant Admin** to set their own rates per category. It uses a **three-level priority system** identical to your existing `FeatureLimitsService` pattern:

```sql
CREATE TABLE public.wa_message_rates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Scope: WHO this rate applies to
    -- GLOBAL = Super Admin default (applies to everyone with no override)
    -- WORKSPACE = Tenant Admin override for a specific user/workspace  
    scope TEXT NOT NULL CHECK (scope IN ('GLOBAL', 'WORKSPACE')),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL if scope=GLOBAL

    -- Rate Type
    category TEXT NOT NULL CHECK (category IN ('MARKETING', 'UTILITY', 'AUTHENTICATION', 'SERVICE')),
    country_code TEXT NOT NULL DEFAULT 'IN',   -- e.g. IN, US, GB, AE

    -- Pricing
    meta_cost NUMERIC(10, 6) NOT NULL,         -- What Meta charges YOU (your cost, in USD)
    platform_rate NUMERIC(10, 4) NOT NULL,     -- What you charge the USER (your currency, e.g. INR)
    currency TEXT DEFAULT 'INR' NOT NULL,

    is_active BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by UUID,                           -- Which admin set this

    UNIQUE(scope, user_id, category, country_code)
);

-- Seed Global Default Rates (Super Admin sets these once)
INSERT INTO public.wa_message_rates (scope, user_id, category, country_code, meta_cost, platform_rate) VALUES
('GLOBAL', NULL, 'MARKETING',       'IN', 0.0128, 0.70),
('GLOBAL', NULL, 'UTILITY',         'IN', 0.0040, 0.22),
('GLOBAL', NULL, 'AUTHENTICATION',  'IN', 0.0040, 0.22),
('GLOBAL', NULL, 'SERVICE',         'IN', 0.0040, 0.20);
```

**Rate Priority Logic (in `WalletService.getRate(userId, category)`):**
```
1. Check if WORKSPACE rate exists for this userId + category → use it (highest priority)
2. Else check GLOBAL rate for category → use it
3. Else use hardcoded fallback
```

**Admin UI:**
- **Super Admin panel:** Set/Edit global rates (e.g., Marketing ₹0.70) for each country + category
- **Tenant Admin panel:** Optionally override rates for their own workspace only (e.g., they negotiated ₹0.60 with you)

---

## 3B. Multi-Number (WABA) Wallet Design

This is the critical design decision for multi-number support:

### Key Fact: WABA = One Billing Entity at Meta
If a workspace has:
- Number A (Sales): +91 90001
- Number B (Support): +91 90002

Both numbers are under the **same WABA ID**. Meta bills at the WABA level — one conversation opened by either number counts against the same WABA quota and is billed once.

### Wallet Balance: Workspace Level (NOT per number)
```
Workspace (User ID: abc123)
    Wallet Balance: ₹500  ← Shared across ALL numbers
    ├── Number A (Sales):    used ₹320  (tracked in report)
    └── Number B (Support):  used ₹180  (tracked in report)
    Total Used: ₹500
```

### Transaction Table Already Handles This
The `wallet_transactions` table already has `whatsapp_account_id` (the specific number's config ID). This means:

**Report can be filtered TWO ways:**
1. **All Numbers:** Show total spend for the entire workspace
2. **Per Number:** Filter by `whatsapp_account_id` to see only Sales Number or only Support Number costs

**The Report UI will show:**
```
[ All Numbers ▼ ]   [ This Month ▼ ]   [ All Categories ▼ ]

┌─────────────────────────────────────────────────┐
│ Total Spent: ₹500                                │
│ Number A (Sales):    ₹320 (64%)                  │
│ Number B (Support):  ₹180 (36%)                  │
└─────────────────────────────────────────────────┘

│ Date  │ Number      │ Category   │ Contact     │ Amount │
│ 27May │ Sales (+91…)│ Marketing  │ +91 9800… │ -₹0.70 │
│ 27May │ Support     │ Utility    │ +91 9700… │ -₹0.22 │
```

### Schema Addition for Multi-Number Tracking
The `wallet_transactions` table needs one more column:
```sql
-- Add to wallet_transactions:
whatsapp_account_id UUID REFERENCES public.whatsapp_config(id) ON DELETE SET NULL,
-- This tells us WHICH number sent this message (Sales or Support)
```

### Balance Check Logic for Multi-Number
Since balance is shared at workspace level, the check is simple:
```js
// Before sending from ANY number (A or B):
const wallet = await getWallet(userId); // workspace-level balance
if (wallet.wallet_enforced && wallet.balance < estimatedCost) {
    throw new Error('Insufficient wallet balance');
}
// After deduction, log which number (whatsapp_account_id) was used
```

---

## 3. How Deduction Works — The Trigger Point

Meta charges per **conversation window**, not per message. The billing moment is when you **initiate** the conversation.

### Two Deduction Points:

**Point A — Template Message Sent (Business-Initiated)**
When your code calls `whatsappService.sendMessage(..., 'template', ...)`, this opens a conversation. Charge immediately at send time.

**Point B — Webhook Status Update (Confirmed by Meta)**
Meta's webhook sends a `status: delivered` or `status: read` event with a `pricing` object:
```json
{
  "pricing": {
    "billable": true,
    "pricing_model": "CBP",
    "category": "marketing"
  }
}
```
This is the **ground truth**. Your current `webhook.js` receives this but ignores the `pricing` field! This is where you should do the **final, accurate deduction**.

**Recommended Strategy: Pre-debit + Reconcile**
1. When a template is sent → Pre-debit estimated amount, mark as `PENDING`
2. When webhook status confirms `billable: true` → Mark as `CONFIRMED`
3. When webhook says `billable: false` → Refund the pre-debit

---

## 4. Where to Hook Into Existing Code

### Hook 1 — `whatsappService.js` → After successful send
```js
// In sendMessage(), after response is received:
if (waMessageId && type === 'template') {
    WalletService.preDebit({
        userId, to, category: content.category, 
        waMessageId, source: 'CAMPAIGN_SEND'
    }).catch(e => console.error('Wallet pre-debit failed:', e));
}
```

### Hook 2 — `webhook.js` → Status update handler
The webhook already receives status updates. Find the `status` handler and add:
```js
if (status === 'delivered' && pricing?.billable === true) {
    WalletService.confirmDebit({
        waMessageId: messageId,
        category: pricing.category,
        userId
    }).catch(e => console.error('Wallet confirm failed:', e));
}
```

### Hook 3 — `campaignWorker.js` → Pass source context
When sending, pass `source: 'CAMPAIGN_SEND'` and `campaignId` to WalletService so the transaction report shows which campaign spent how much.

---

## 5. Wallet Service (New File: `server/services/WalletService.js`)

```js
// Core functions needed:

// 1. Get balance
getBalance(userId) → { balance, currency }

// 2. Add credit (admin topup or user recharge)
addCredit(userId, amount, description, adminId) → transaction

// 3. Pre-debit (before Meta confirms)
preDebit({ userId, waMessageId, category, source, campaignId, ... }) → transaction

// 4. Confirm debit (after Meta webhook confirms billable)
confirmDebit({ waMessageId, category, userId }) → updated_transaction

// 5. Refund (if not billable)
refundPreDebit(waMessageId) → refund_transaction

// 6. Check if sufficient balance (before sending)
hasSufficientBalance(userId, estimatedCost) → boolean

// 7. Get transaction report
getTransactions(userId, { startDate, endDate, source, category, page, limit }) → { transactions, total, summary }
```

---

## 6. Wallet Report Structure

Every user gets a report page with:

### Summary Cards
- **Current Balance:** ₹245.50
- **Total Spent This Month:** ₹1,840.00
- **Marketing Conversations:** 1,200 (₹840)
- **Utility Conversations:** 2,800 (₹616)
- **Service Conversations:** 1,700 (₹340)

### Transaction Table (Filterable)
| Date | Source | Category | Contact | Amount | Balance After |
|---|---|---|---|---|---|
| 27 May | Campaign: "Diwali Blast" | Marketing | +91 9800... | -₹0.70 | ₹245.50 |
| 27 May | Drip: "Onboarding" | Utility | +91 9700... | -₹0.22 | ₹246.20 |
| 26 May | Admin Topup | — | — | +₹500.00 | ₹746.20 |

### Filters
- Date Range
- Source (Campaign / Drip / Flow / Inbox / API)
- Category (Marketing / Utility / Service)
- Export as CSV

---

## 7. Low Balance Alerts

Add a background check in `scheduler.js`:
```js
// Every hour: find users with balance < threshold
// Send them a WhatsApp/Email notification
// Also: optionally PAUSE all campaigns when balance = 0
```

---

## 8. Implementation Steps

| Step | Task | Risk |
|---|---|---|
| 1 | Create `user_wallets`, `wallet_transactions`, `wa_message_rates` tables | Zero |
| 2 | Create `WalletService.js` with all core functions | Zero (new file) |
| 3 | Add billing hook in `webhook.js` status handler | Minimal (additive only) |
| 4 | Add pre-debit hook in `whatsappService.js` | Minimal (fire-and-forget) |
| 5 | Create Wallet API routes (`/api/wallet/balance`, `/api/wallet/transactions`) | Zero |
| 6 | Build Wallet UI (Balance card + Transaction table) | Zero |
| 7 | Add low-balance alerts in `scheduler.js` | Zero |
| 8 | Admin panel: topup user wallet | Zero |

> [!NOTE]
> All hooks are **fire-and-forget** (`.catch()` prevents any billing failure from breaking message sending). Your existing 1 lakh users are fully protected.
