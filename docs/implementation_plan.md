# Bulletproof Wallet Security & Race Condition Prevention

You are absolutely right to demand zero loopholes and no negative balances. I have reviewed the current wallet implementation and identified a **critical race condition** that could cause financial loss.

## The Loophole (Race Condition)
Currently, if a user sends 10 messages at the exact same millisecond, Node.js reads the wallet balance (e.g., ₹500) 10 times in parallel. All 10 requests deduct ₹0.70 from ₹500, and they all write ₹499.30 back to the database at the same time. The user just sent 10 messages but was only charged for 1!

## The Solution

I will implement **Atomic SQL Transactions** directly inside the PostgreSQL database. This ensures that even if 1,000 messages hit the system in the exact same millisecond, the database strictly queues the deductions one by one, making it mathematically impossible to bypass the balance or go negative.

### User Review Required

> [!WARNING]
> This requires running a new SQL script (`wallet_atomic_rpc.sql`) on your Supabase instance to create the safe transaction functions. Please approve this plan so I can generate the script and update the backend code.

## Proposed Changes

### [NEW] `server/sql/wallet_atomic_rpc.sql`
- Create an RPC function `adjust_wallet_balance(p_user_id UUID, p_amount NUMERIC, p_type TEXT, p_source TEXT, p_category TEXT, p_description TEXT, p_wa_message_id TEXT)`
- The function will use row-level locking (`FOR UPDATE`) to lock the user's wallet while the math is happening.
- The function will explicitly throw an error if the transaction would cause the balance to drop below ₹0 (if Mode B is enforced).
- The function will automatically insert the `wallet_transactions` history row inside the same transaction, ensuring the log and the balance are never out of sync.

### [MODIFY] `server/services/WalletService.js`
- Rewrite `preDebit()`, `handleWebhookPricing()`, and `addCredit()` to completely stop doing math in Node.js.
- They will now exclusively call the `adjust_wallet_balance` RPC function.

## Verification Plan
- We will verify that rapid, concurrent calls to `adjust_wallet_balance` result in perfectly sequential deductions.
- We will verify that an attempt to deduct ₹10 from a ₹5 balance correctly fails at the database layer.
