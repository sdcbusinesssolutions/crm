# Campaign Worker — Complete Fix Documentation
> Branch: `feature/21-02-fix-ECONNRESET`  
> Date: 21 February 2026  
> File: `server/workers/campaignWorker.js`

---

## 📋 Table of Contents

1. [Problem Overview](#1-problem-overview)
2. [SQL Migrations Required](#2-sql-migrations-required)
3. [Fix 1 — ECONNRESET (Too Many Sockets)](#3-fix-1--econnreset-too-many-sockets)
4. [Fix 2 — WABA Rate Limit Cross-Contamination](#4-fix-2--waba-rate-limit-cross-contamination)
5. [Fix 3 — Shared Rate Limit Across Containers](#5-fix-3--shared-rate-limit-across-containers)
6. [Fix 4 — 100+ Container Race Conditions](#6-fix-4--100-container-race-conditions)
7. [Fix 5 — Template Fetch Storm](#7-fix-5--template-fetch-storm)
8. [Fix 6 — PGRST204 Column Error](#8-fix-6--pgrst204-column-error)
9. [Fix 7 — Google Auth Library Corruption](#9-fix-7--google-auth-library-corruption)
10. [Scaling Behaviour Summary](#10-scaling-behaviour-summary)

---

## 1. Problem Overview

The campaign broadcast system was failing due to multiple interconnected issues:

| # | Problem | Symptom | Root Cause |
|---|---|---|---|
| 1 | ECONNRESET errors | Messages fail with network error | Too many sockets per container |
| 2 | WABA A rate limit blocks WABA B | All campaigns stop when one hits limit | In-memory rate limit per container only |
| 3 | Multi-container hammering | 6 containers × 10 sends = Meta blocks all WABAs | No shared rate limit state |
| 4 | 100+ containers — same campaign processed by all | DB overloaded, Meta hammered 100× | No campaign-level ownership |
| 5 | Template fetched from Meta every 2 seconds | Quota wasted on metadata, not messages | No persistent template cache |
| 6 | `PGRST204` error on startup | `claimed_at` column not found | Revert left stale column references |
| 7 | Server won't start — `SyntaxError` in googleapis | Server crash | Corrupted npm package |

---

## 2. SQL Migrations Required

> ⚠️ **Run each statement separately** in Supabase SQL Editor.  
> All 3 create **new tables only** — no `ALTER TABLE`, no timeouts.

### Statement 1 — Campaign Ownership Claims
```sql
CREATE TABLE IF NOT EXISTS campaign_worker_claims (
    campaign_id TEXT PRIMARY KEY,
    worker_id   TEXT NOT NULL,
    claimed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```
**Why:** Each of 100+ containers tries to process all campaigns simultaneously. This table ensures exactly **one container owns one campaign** at a time using atomic `INSERT`. Any other container that tries to insert the same `campaign_id` gets a `23505 unique violation` → immediately skips.

---

### Statement 2 — Shared Rate Limit Store
```sql
CREATE TABLE IF NOT EXISTS campaign_rate_limits (
    waba_id      TEXT PRIMARY KEY,
    paused_until TIMESTAMPTZ NOT NULL,
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);
```
**Why:** In-memory rate limit maps are per-container. If Container 1 detects that WABA X is rate-limited, Containers 2–100 don't know and keep hammering Meta's API, making the penalty longer. This table is the **single source of truth** shared by all containers.

---

### Statement 3 — Persistent Template Component Cache
```sql
CREATE TABLE IF NOT EXISTS template_components_cache (
    user_id       TEXT NOT NULL,
    template_name TEXT NOT NULL,
    components    JSONB NOT NULL,
    updated_at    TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, template_name)
);
```
**Why:** Previously, every container fetched template structure (header/body/buttons) from Meta API every 5 minutes. At 100 containers × 10 active campaigns = **1,000 Meta API calls just for template metadata** per tick. This table caches the components **permanently** — Meta is called exactly once per template, ever.

---

## 3. Fix 1 — ECONNRESET (Too Many Sockets)

### Problem
```
Error: read ECONNRESET
```
With 6 containers and `maxSockets: 100`, up to **600 simultaneous TCP connections** were opened to `graph.facebook.com`. Meta's load balancer RST'd (reset) connections it couldn't handle.

### Code Fix — `campaignWorker.js` (top of file)

```javascript
// BEFORE (broken):
const httpsAgent = new https.Agent({
    keepAlive: true,
    maxSockets: 100,      // ❌ Too many — 100 sockets × 100 containers = 10,000 connections
});

// AFTER (fixed):
const httpsAgent = new https.Agent({
    keepAlive: true,
    maxSockets: 10,           // ✅ Max 10 per container — safe total across all containers
    maxFreeSockets: 5,
    timeout: 30000,
    scheduling: 'lifo',       // ✅ LIFO reuses warm connections first, avoids stale socket resets
});
```

**Why `lifo`:** Last-In-First-Out means recently used (warm) connections are reused. FIFO cycles through idle connections that may have timed out on Meta's side → causes ECONNRESET on stale sockets.

### Also Added — Auto-Retry for Network Errors

```javascript
// In sendMessage() catch block:
} else if (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
    // Network-level failure (Meta server refusing or dropping connection)
    // Retry instead of failing immediately
    console.warn(`[Worker] Network error (${error.code}). Will retry.`);
    shouldRetry = true;
}
```

**Why:** Even with tuned sockets, transient network errors happen. Instead of marking the message FAILED immediately, it retries with exponential backoff.

---

## 4. Fix 2 — WABA Rate Limit Cross-Contamination

### Problem
When WABA A hit Meta's rate limit (error 80008), the original code did:
```javascript
TEMPLATE_CACHE.clear(); // ❌ Clears cache for ALL WABAs, not just WABA A
```
This forced every other WABA to re-fetch templates from Meta on the next tick — wasting their quota and potentially triggering their own rate limits.

### Code Fix

```javascript
// BEFORE (broken):
TEMPLATE_CACHE.clear(); // Wipes all users' templates

// AFTER (fixed):
// Only clear cache entries for THIS specific WABA
for (const key of TEMPLATE_CACHE.keys()) {
    if (key.startsWith(`${config.whatsapp_business_account_id}:`)) {
        TEMPLATE_CACHE.delete(key);
    }
}
```

**Why:** Cache keys are formatted as `{wabaId}:{templateName}`. Filtering by prefix ensures only the rate-limited WABA's templates are cleared. All other users' templates remain cached and their campaigns are unaffected.

### Also Added — Parallel Campaign Processing

```javascript
// BEFORE (broken): Sequential — WABA A's problem blocks WABA B, C, D...
for (const campaign of activeCampaigns) {
    await this.processCampaignBatch(campaign); // ❌ Blocks next if this is slow
}

// AFTER (fixed): Parallel — each WABA runs independently
const shuffled = [...activeCampaigns].sort(() => Math.random() - 0.5);
await Promise.all(shuffled.map(campaign => this.processCampaignBatch(campaign)));
```

**Why shuffle:** Without shuffling, all containers process campaigns in the same order, causing thundering herd on Campaign A before touching B or C. Random order spreads the competition.

### Also Added — Early Rate Limit Check

```javascript
async _processCampaignBatchInternal(campaign) {
    // ...get config...

    // ✅ Check BEFORE any work — don't fetch templates, don't touch queue items
    if (await isWabaRateLimited(config.whatsapp_business_account_id)) {
        const waitSec = getWabaRateLimitWaitSec(config.whatsapp_business_account_id);
        console.warn(`[Worker] WABA rate-limited ${waitSec}s. Skipping.`);
        return; // Exit immediately — don't waste any resources
    }
```

**Why:** Previously the rate limit was only checked inside `sendMessage()` — after locking queue items, fetching templates, and doing all the setup work. Now we exit at the very top before touching anything.

---

## 5. Fix 3 — Shared Rate Limit Across Containers

### Problem
`RATE_LIMIT_MAP` was an **in-memory Map** inside each container process:
```javascript
const RATE_LIMIT_MAP = new Map(); // ❌ Each container has its own isolated copy
```
With 6 containers each having their own map:
- Container 1 detects rate limit → marks WABA X in its own map
- Containers 2–6 don't know → continue hammering Meta for another 2 seconds
- Meta's penalty extends each time they call → WABA blocked for hours

### Code Fix — Database-Backed Shared State

```javascript
// Shared across ALL containers via Supabase DB
// Local cache (30s TTL) as fast-path to avoid DB query on every single message

const LOCAL_RATE_LIMIT_CACHE = new Map(); // Fast in-memory layer
const RATE_LIMIT_CACHE_TTL = 30 * 1000;  // Re-check DB every 30s

async function isWabaRateLimited(wabaId) {
    const now = Date.now();
    const cached = LOCAL_RATE_LIMIT_CACHE.get(wabaId);

    // 1. Use local cache if fresh (avoid DB hit on every message)
    if (cached && now < cached.checkedAt + RATE_LIMIT_CACHE_TTL) {
        return now < cached.pausedUntil;
    }

    // 2. Check DB (source of truth shared across all containers)
    const { data } = await supabase
        .from('campaign_rate_limits')
        .select('paused_until')
        .eq('waba_id', wabaId)
        .single();

    const pausedUntil = data ? new Date(data.paused_until).getTime() : 0;
    LOCAL_RATE_LIMIT_CACHE.set(wabaId, { pausedUntil, checkedAt: now });
    return now < pausedUntil;
}

async function setWabaRateLimit(wabaId, pauseMs) {
    const pausedUntil = new Date(Date.now() + pauseMs).toISOString();

    // Write to DB — all other containers will see it within 30s (their cache TTL)
    await supabase.from('campaign_rate_limits').upsert({
        waba_id: wabaId,
        paused_until: pausedUntil,
        updated_at: new Date().toISOString()
    }, { onConflict: 'waba_id' });

    // Update local cache immediately (this container knows right now)
    LOCAL_RATE_LIMIT_CACHE.set(wabaId, {
        pausedUntil: Date.now() + pauseMs,
        checkedAt: Date.now()
    });
}
```

**Two-layer design:**
| Layer | Speed | Scope | TTL |
|---|---|---|---|
| `LOCAL_RATE_LIMIT_CACHE` (Map) | ~0ms | This container only | 30 seconds |
| `campaign_rate_limits` (Supabase) | ~5ms | ALL containers | Until rate limit expires |

---

## 6. Fix 4 — 100+ Container Race Conditions

### Problem
With 100 containers all running `processQueue()`:
1. All 100 fetch the same list of active campaigns
2. All 100 try to process all campaigns simultaneously
3. 100 containers × 10 campaigns × 50 queue items = 50,000 DB ops per tick
4. 100 containers × 1 template fetch per campaign = 1,000 Meta API calls per tick

### Code Fix A — Campaign Ownership Claim (Critical)

```javascript
async processCampaignBatch(campaign) {
    const claimExpiry = new Date(Date.now() - 60 * 1000).toISOString();

    // Step 1: Remove expired claim (dead container recovery)
    await supabase.from('campaign_worker_claims')
        .delete()
        .eq('campaign_id', campaign.id)
        .lt('claimed_at', claimExpiry);

    // Step 2: Try to INSERT our claim atomically
    const { error: claimErr } = await supabase
        .from('campaign_worker_claims')
        .insert({ campaign_id: campaign.id, worker_id: this.workerId, claimed_at: now });

    if (claimErr?.code === '23505') {
        return; // ✅ Another container claimed it — skip silently (99 containers exit here)
    }

    // Step 3: Heartbeat — renew claim every 20s while processing
    const heartbeatInterval = setInterval(async () => {
        await supabase.from('campaign_worker_claims')
            .update({ claimed_at: new Date().toISOString() })
            .eq('campaign_id', campaign.id)
            .eq('worker_id', this.workerId);
    }, 20000);

    try {
        await this._processCampaignBatchInternal(campaign);
    } finally {
        clearInterval(heartbeatInterval);
        // Release claim — next container can pick up on next tick
        await supabase.from('campaign_worker_claims')
            .delete()
            .eq('campaign_id', campaign.id)
            .eq('worker_id', this.workerId);
    }
}
```

**Flow at 100 containers, 3 active campaigns:**
```
All 100 containers try to claim campaign A:
  Container 7  → INSERT succeeds → owns campaign A ✅
  Container 23 → INSERT fails (23505) → skips campaign A ✅
  Containers 1–6, 8–22, 24–100 → INSERT fails → skip ✅

All 100 containers try to claim campaign B:
  Container 31 → INSERT succeeds → owns campaign B ✅
  Others → skip ✅

Result: 3 containers working, 97 containers idle per tick
        (instead of 100 containers doing 300× the work)
```

**Dead container recovery:** If a container crashes, its claim's `claimed_at` stops updating. After 60 seconds, `recoverStaleLocks()` deletes the stale claim. The next container to try can then claim it.

### Code Fix B — Startup Jitter

```javascript
async loop() {
    // Without jitter: All 100 containers start at the same millisecond
    // → DB hit by 300 simultaneous queries at t=0, t=2000, t=4000...
    const startJitter = Math.floor(Math.random() * 5000); // 0–5s
    await sleep(startJitter);

    while (this.isRunning) {
        // ...process...

        // Per-tick jitter: spreads 100 containers across 5s window
        const tickJitter = 2000 + Math.floor(Math.random() * 3000); // 2–5s
        await sleep(tickJitter);
    }
}
```

**Why jitter:** Without it, at exactly t=0, t=2000, t=4000:
- 100 containers simultaneously query `campaigns`, `campaign_queue`, `whatsapp_config`
- DB connection pool gets saturated → query timeouts → errors

With jitter, 100 containers are spread across a 5-second window → ~20 containers active per second instead of 100 at once.

### Code Fix C — Staggered Maintenance

```javascript
// BEFORE: All 100 containers run recoverStaleLocks() every 2 seconds
await this.recoverStaleLocks();     // ❌ 100 × expensive query every 2s

// AFTER: Probability gate — only ~1 container per tick runs maintenance
const shouldRunMaintenance = Math.random() < (1 / Math.max(1, this.estimatedContainerCount));
if (shouldRunMaintenance) {
    await this.recoverStaleLocks();             // ✅ ~1 container runs this
    await this.processScheduledCampaigns();     // ✅ ~1 container runs this
}
```

**Why:** `recoverStaleLocks()` does a full table scan on `campaign_queue`. Running it 100 times simultaneously wastes DB resources. At 100 containers, probability `1/100` means on average 1 container per tick handles maintenance — exactly what's needed.

---

## 7. Fix 5 — Template Fetch Storm

### Problem
Every 5 minutes (cache TTL), each container fetched template definitions from Meta's API:
```
GET /graph.facebook.com/{wabaId}/message_templates?name=hello_world
```
- Each fetch counts against Meta's rate limit quota
- 100 containers × 10 active campaigns = **1,000 Meta API calls per 5 minutes just for template metadata**
- This quota should be used for **sending messages**, not fetching metadata

### Code Fix — Fetch Once, Store in `template_components_cache`

```javascript
// Step 1: Check persistent DB cache first
const { data: cachedComp } = await supabase
    .from('template_components_cache')
    .select('components')
    .eq('user_id', campaign.user_id)
    .eq('template_name', campaign.template_name)
    .single();

if (cachedComp?.components?.length > 0) {
    // ✅ CACHE HIT — zero Meta API calls
    templateDef = { ...localTmpl, components: cachedComp.components };

} else {
    // ⬇️ CACHE MISS — fetch from Meta ONCE and save permanently
    const tmplRes = await axios.get(`${GRAPH_API_URL}/...`);
    const metaDef = tmplRes.data.data[0];

    // 💾 Save to DB — all future ticks, any container, skip Meta
    await supabase.from('template_components_cache').upsert({
        user_id: campaign.user_id,
        template_name: campaign.template_name,
        components: metaDef.components,
    }, { onConflict: 'user_id,template_name' });
}
```

**Lifecycle:**
```
Campaign "promo_sale" for User A — First run ever:
  → DB cache: MISS
  → Meta API: GET template (1 call)
  → DB cache: WRITE components
  → Send messages ✅

Campaign "promo_sale" for User A — Every run after:
  → DB cache: HIT
  → Meta API: NOT CALLED 🎉
  → Send messages ✅

At 1 lakh users × 1 template each = 1 lakh total Meta calls (ever)
Then = 0 Meta calls for templates, forever
```

---

## 8. Fix 6 — PGRST204 Column Error

### Problem
```
PGRST204: Could not find the 'claimed_at' column of 'campaigns' in the schema cache
```

During development, code was added to set `claimed_by` and `claimed_at` on the **campaigns** table. When we switched to using the **separate `campaign_worker_claims` table** instead, the campaigns table update was not fully cleaned up. A reverted diff re-introduced the broken line.

### Code Fix — `processScheduledCampaigns()`

```javascript
// BEFORE (broken — campaigns table has no claimed_by/claimed_at):
.update({ status: 'PROCESSING', claimed_by: null, claimed_at: null }) // ❌ PGRST204

// AFTER (fixed — only update what exists):
.update({ status: 'PROCESSING' }) // ✅ Clean
```

**Why PGRST204 vs 42703:** PostgREST (Supabase's API layer) returns `PGRST204` when a column doesn't exist in its schema cache. Raw PostgreSQL SQL returns `42703`. These are different error codes for the same underlying problem. The fallback only caught `42703`, so `PGRST204` fell through to the generic error handler and logged the warning.

---

## 9. Fix 7 — Google Auth Library Corruption

### Problem
```
SyntaxError: Invalid or unexpected token
at node_modules/google-auth-library/build/src/auth/oauth2common.js:1
```
Server refused to start. The file contained binary garbage instead of valid JavaScript — typically caused by an interrupted `npm install`.

### Fix

```powershell
# Delete corrupted package
Remove-Item -Recurse -Force node_modules\google-auth-library

# Reinstall clean copy
npm install google-auth-library
```

### Verification
```powershell
# File starts with valid JavaScript now:
"use strict";
// Copyright 2021 Google LLC
```

**Why it happens:** If `npm install` is interrupted (Ctrl+C, power cut, network drop) mid-download, a `.js` file can be partially written — leaving it with a mix of binary HTTP chunk headers and partial JavaScript. Node.js then fails to parse it.

---

## 10. Scaling Behaviour Summary

### DB Operations Per Tick

| Operation | 1 Container | 6 Containers | 100 Containers |
|---|---|---|---|
| Claim attempts | 1× | 6× | 100× (99 instant-exit on conflict) |
| Template fetch (Meta) | 0 (cached in DB) | 0 | 0 |
| Queue SELECT | 1× per campaign | 1× per campaign | 1× per campaign |
| Rate limit DB check | Per 30s TTL | Per 30s TTL | Per 30s TTL |
| `recoverStaleLocks` | Every tick | Every tick | **~1 per tick** (staggered) |
| DB query spike at t=0 | Sharp | 6× sharp | **Spread over 5s** (jitter) |

### Meta API Calls Per Tick

| Action | Before All Fixes | After All Fixes |
|---|---|---|
| Template fetch | 1 per container per 5 min | **0** (DB cache, fetched once ever) |
| Message send | All containers × all campaigns | **1 container per campaign** only |
| WABA A rate-limited → WABA B stops? | ✅ Yes (shared in-memory) | **❌ No** (separate, parallel) |

### Container Crash Recovery

```
Container 7 claims campaign A at t=0
Container 7 crashes at t=30s (heartbeat was renewing every 20s)
claimed_at = t=20s (last heartbeat)

At t=80s: claimed_at is 60s old → claim expired
recoverStaleLocks() runs → DELETE expired claim

At t=82s: Container 31 tries to claim campaign A
INSERT succeeds → Container 31 picks up from where A left off ✅
Queue items that were SENDING → recovered to PENDING by recoverStaleLocks() ✅
```

---

## Appendix — All SQL (Final)

```sql
-- Run each separately. All are new tables — no ALTER TABLE, no timeouts.

-- 1. Campaign worker ownership (prevents 100 containers processing same campaign)
CREATE TABLE IF NOT EXISTS campaign_worker_claims (
    campaign_id TEXT PRIMARY KEY,
    worker_id   TEXT NOT NULL,
    claimed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Shared WABA rate limit state (all containers see the same rate limits)
CREATE TABLE IF NOT EXISTS campaign_rate_limits (
    waba_id      TEXT PRIMARY KEY,
    paused_until TIMESTAMPTZ NOT NULL,
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Persistent template component cache (fetch from Meta once, reuse forever)
CREATE TABLE IF NOT EXISTS template_components_cache (
    user_id       TEXT NOT NULL,
    template_name TEXT NOT NULL,
    components    JSONB NOT NULL,
    updated_at    TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, template_name)
);
```

---

*Document generated: 21 February 2026*  
*Branch: `feature/21-02-fix-ECONNRESET`*  
*Commit: `ba4a491`*
