# Scheduler & Automation Architecture (Robustness & Safety)

This document details the architectural mechanisms implemented to ensure **At-Least-Once Delivery** while strictly preventing **Double-Sending** (Race Conditions) in the Campaign Scheduler and Google Sheet Automation systems.

## 1. Safety Hierarchy
Both the Campaign Worker and Sheet Automation Service operate on a **multi-layer safety model**. If one layer fails, the next one catches the issue.

| Layer | Mechanism | Purpose |
| :--- | :--- | :--- |
| **Layer 1** | **Optimistic Locking (Atomic DB Updates)** | Prevents two workers from picking up the same job/message. |
| **Layer 2** | **Row/Message Deduplication** | Ensures the same content isn't sent to the same user twice. |
| **Layer 3** | **DB Constraints (Unique Keys)** | Hard fall-back that causes the database to reject duplicate inserts. |

---

## 2. Campaign Scheduler (Worker)
**File:** `server/workers/campaignWorker.js`

### Mechanism: Atomic Pickup
Previously, schedulers used a *Read-Check-Update* pattern, which is prone to race conditions (two workers read "Ready" at the same time).
**New Implementation (Atomic Update):**

```javascript
// ATOMIC LOCK: Select and Update in ONE operation
const { data: startedCampaigns } = await supabase
    .from('campaigns')
    .update({ status: 'PROCESSING' })      // 1. Mark as taken
    .eq('status', 'SCHEDULED')             // 2. Must be currently free
    .lte('scheduled_at', now)              // 3. Must be due
    .select('id');                         // 4. Return ONLY what THIS worker claimed
```

*   **Result:** Even if 100 workers run this query at the exact same millisecond, the database (Postgres) ensures clear serialization. Only one worker gets the return value. The others get an empty list.

### Message Processing
Once a campaign is "PROCESSING", individual messages are processed in batches.
1.  **Selection:** Select `PENDING` messages.
2.  **Locking:** Update them to `SENDING` using the same atomic pattern.
3.  **Sending:** Send via WhatsApp API.
4.  **Result:** Update to `SENT` or `FAILED`.

---

## 3. Google Sheet Automation
**File:** `server/services/SheetAutomationService.js`

This system syncs rows from Google Sheets to WhatsApp messages. It faces unique challenges (concurrent webhooks, overlapping schedules).

### 3.1 Job Locking (The "Coordinator" Lock)
Before a job (checking a sheet) starts, it must claim a "Run Lock".
```javascript
const claimed = await this.claimJobLock(auto);
if (!claimed) return; // Stop immediately
```
**How `claimJobLock` works:**
It uses **Version Checking** on the `last_run_at` timestamp.
*   `UPDATE sheet_automations SET last_run_at = NOW() WHERE id = X AND last_run_at = [OLD_TIMESTAMP]`
*   If another worker updated the timestamp *just* before us, our `WHERE` clause fails (0 rows updated), and we know we lost the race. We abort gracefully.

### 3.2 Row-Level Deduplication (The "User" Lock)
Even if the job runs, we must ensure we don't send the same message to "John Doe" twice.

1.  **Hash Generation:**
    *   The system creates a **Unique Hash** for the row data (e.g., `MD5(Name+Phone+Message)`).
    *   This hash acts as a fingerprint for that specific intent to send.

2.  **History Check (Memory & DB):**
    *   **In-Memory:** We keep a Set of hashes processed in the *current* run.
    *   **Database:** We check `sheet_automation_history` table for this Hash.

3.  **The "Reservation" Pattern (Strongest Guard):**
    *   Before sending, we **INSERT** the Hash into `sheet_automation_history` with status `PENDING`.
    *   **Constraint:** The table has a **UNIQUE CONSTRAINT** on `(automation_id, row_hash)`.
    *   If this row was already processed (or is being processed by a ghost worker), the Insert **FAILS** with error `23505 (Unique Violation)`.
    *   We catch this error and **SKIP** the row.

### 3.3 Frequency Control
*   **One-Time:** Runs once, never repeats (enforced by `last_run_at` check).
*   **Daily/Weekly:** Runs based on IST Timezone calculations.
*   **Recurring Logic:**
    *   If using conditions like "Is Birthday Today", the hash includes "Date" or we clear history daily (Deduping window = 24h).
    *   Otherwise, Deduping Window is **Lifetime** (Never send to this row again).

---

## 4. Timezone Handling
**Problem:** Server is UTC. User is IST.
**Solution:**
*   Frontend (`CreateCampaign`) converts user selection (IST) to ISO String (UTC) cleanly.
*   Backend Workers compare `now()` (Server UTC) vs `scheduled_at` (Stored UTC).
*   Sheet Automation uses explicit `Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata' })` for all "Is it 9 AM yet?" checks to match user expectation.

---

## Summary of Guarantees
1.  **Zero Double Sends:** Guaranteed by DB Unique Constraints on History Logic.
2.  **Zero Double Processing:** Guaranteed by Atomic Optimistic Locking on Jobs/Campaigns.
3.  **Resilience:** If a worker crashes, the campaign stays "PROCESSING" (stuck) but won't be picked up by others blindly. *Self-healing implementation for stuck jobs is the next recommended step (e.g., release lock after 1 hour).*
