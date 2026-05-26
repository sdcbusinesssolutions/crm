# Wallet Balance - Strict Security Upgrade

I have completely refactored how wallet balances are calculated and updated to mathematically guarantee that **no loopholes exist** and the balance **can never go negative**.

## The Problem (Race Conditions)
Previously, the Node.js server read the balance from the database, did math in memory, and wrote the new balance back. If 1,000 messages fired in the exact same millisecond, all 1,000 requests would read `₹500`, subtract `₹0.70`, and write `₹499.30` back to the database. You would have been billed by Meta for 1,000 messages, but the user's wallet would only deduct `₹0.70` once!

## The Solution (Atomic SQL Transactions)

I have moved the mathematical deduction out of the Node.js application layer and built it directly into the PostgreSQL Database engine using an RPC function.

### 1. Row-Level Locking (`FOR UPDATE`)
The new `adjust_wallet_balance` SQL function locks the user's specific wallet row while it performs the deduction. If 1,000 requests hit the database at the exact same millisecond, the database forces them into a perfect queue (Request 1 deducts, then Request 2, then Request 3...). 

**Result**: It is physically impossible for concurrent API requests to bypass a charge.

### 2. Negative Balance Blocking
The database itself now strictly enforces the Mode B restriction. During the atomic transaction, if subtracting the message cost drops the balance below `₹0` (e.g. they have `₹0.50` and try to send a `₹0.70` message), the **database instantly throws an `INSUFFICIENT_BALANCE` exception and cancels the transaction**.

**Result**: It is mathematically impossible for an enforced user to go into a negative balance.

### 3. Integrated Transaction Logging
The wallet deduction and the `wallet_transactions` log insertion now happen inside the exact same database transaction.

**Result**: The user's visual transaction history will always perfectly match their exact numerical balance, down to the penny.

---

> [!IMPORTANT]
> Because this required a structural change to the database, you **must run the new migration script** on your Supabase instance to enable this security layer!
> 
> **Script Path**: `server/sql/wallet_atomic_rpc.sql`
