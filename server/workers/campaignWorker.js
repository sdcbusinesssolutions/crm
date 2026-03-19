const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const https = require('https');

// --- Global HTTPS Agent — tuned for resilience against ECONNRESET ---
const httpsAgent = new https.Agent({
    keepAlive: true,
    maxSockets: 50,          // ✅ Matches whatsappService limit
    maxFreeSockets: 10,
    timeout: 30000,
    scheduling: 'lifo'       // Reuse warm sockets first
});

const { logCampaignRequest } = require('../utils/logger');
const whatsappService = require('../services/whatsappService');

// --- Configuration ---
const GRAPH_API_URL = 'https://graph.facebook.com/v18.0';
const BATCH_SIZE = 50; // Items to fetch per tick
const MAX_CONCURRENCY = 5; // Max parallel requests (reduced to prevent Meta rate limit 80008)
const MAX_RETRIES = 3; // Max retry attempts for transient errors
const RATE_LIMIT_DELAY_MS = 200; // 200ms between chunks = ~5 msg/sec (safe for Meta's limits)

// --- Template Cache (prevents repeated Meta API calls for same template) ---
// Key: `${wabaId}:${templateName}`, Value: { def, expiresAt }
const TEMPLATE_CACHE = new Map();
const TEMPLATE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// --- Rate Limit State (per-WABA, SHARED ACROSS ALL CONTAINERS via Supabase DB) ---
// 
// ⚠️ PROBLEM with in-memory Map: Each Docker container has its OWN RATE_LIMIT_MAP.
// If WABA X is rate-limited on Container 1, Containers 2-6 don't know — they keep
// hammering Meta, making the penalty WORSE (Meta increases ban duration for continued requests!).
//
// ✅ SOLUTION: Use Supabase `campaign_rate_limits` table as shared state.
//    - Local in-memory cache for fast-path (avoids DB query every 2 seconds)
//    - DB is source of truth, synced when cache expires or on rate-limit event
//
// DB Table Required (run once in Supabase SQL Editor):
// CREATE TABLE IF NOT EXISTS campaign_rate_limits (
//     waba_id TEXT PRIMARY KEY,
//     paused_until TIMESTAMPTZ NOT NULL,
//     updated_at TIMESTAMPTZ DEFAULT NOW()
// );

const RATE_LIMIT_DEFAULT_PAUSE_MS = 60 * 1000; // 60s fallback if header not available

// Local fast-path cache: { wabaId -> pausedUntilMs }
// Only used to avoid hitting DB on every 2-second tick
const LOCAL_RATE_LIMIT_CACHE = new Map();
const LOCAL_CACHE_TTL_MS = 30 * 1000; // Re-check DB every 30s max
const LOCAL_CACHE_TIMESTAMPS = new Map(); // wabaId -> last DB check time

// Shared supabase client for rate limit operations (set once worker starts)
let _rlSupabase = null;
function setRateLimitSupabase(client) { _rlSupabase = client; }

// Helper: Check if a specific WABA is currently rate-limited (local cache first, DB fallback)
async function isWabaRateLimited(wabaId) {
    const now = Date.now();

    // 1. Fast-path: local cache hit (< 30s old)
    const lastCheck = LOCAL_CACHE_TIMESTAMPS.get(wabaId) || 0;
    if (now - lastCheck < LOCAL_CACHE_TTL_MS) {
        const cachedUntil = LOCAL_RATE_LIMIT_CACHE.get(wabaId) || 0;
        return now < cachedUntil;
    }

    // 2. Cache miss or stale — check DB (shared across all containers)
    try {
        if (_rlSupabase) {
            const { data } = await _rlSupabase
                .from('campaign_rate_limits')
                .select('paused_until')
                .eq('waba_id', wabaId)
                .single();

            const pausedUntilMs = data?.paused_until ? new Date(data.paused_until).getTime() : 0;
            LOCAL_RATE_LIMIT_CACHE.set(wabaId, pausedUntilMs);
            LOCAL_CACHE_TIMESTAMPS.set(wabaId, now);
            return now < pausedUntilMs;
        }
    } catch (e) { /* DB error — fail open (allow sending) */ }

    return false;
}

// Helper: Get remaining wait seconds for a WABA
function getWabaRateLimitWaitSec(wabaId) {
    const until = LOCAL_RATE_LIMIT_CACHE.get(wabaId) || 0;
    return Math.max(0, Math.ceil((until - Date.now()) / 1000));
}

// Helper: Set rate limit for a specific WABA — writes to DB (shared) + local cache
async function setWabaRateLimit(wabaId, pauseMs) {
    const until = new Date(Date.now() + pauseMs);
    const untilMs = until.getTime();

    // 1. Update local cache immediately (fast-path for THIS container)
    LOCAL_RATE_LIMIT_CACHE.set(wabaId, untilMs);
    LOCAL_CACHE_TIMESTAMPS.set(wabaId, Date.now());

    // 2. Persist to DB so ALL other containers see it
    try {
        if (_rlSupabase) {
            await _rlSupabase
                .from('campaign_rate_limits')
                .upsert({
                    waba_id: wabaId,
                    paused_until: until.toISOString(),
                    updated_at: new Date().toISOString()
                }, { onConflict: 'waba_id' });
            console.log(`[RateLimit] ✅ WABA ${wabaId} paused until ${until.toISOString()} — written to DB (all containers will see this).`);
        }
    } catch (e) {
        console.error(`[RateLimit] ⚠️ Failed to persist rate limit for WABA ${wabaId} to DB:`, e.message);
        // Even if DB write fails, local cache is set — this container at least won't hammer
    }
}

// Helper: Parse X-Business-Use-Case-Usage header to get exact wait time from Meta
function parseMetaRateLimitHeader(headers) {
    try {
        const headerVal = headers?.['x-business-use-case-usage'];
        if (!headerVal) return null;
        const parsed = typeof headerVal === 'string' ? JSON.parse(headerVal) : headerVal;
        // Header contains object keyed by business-object-id
        for (const key of Object.keys(parsed)) {
            const entries = parsed[key];
            if (Array.isArray(entries)) {
                for (const entry of entries) {
                    if (entry.estimated_time_to_regain_access > 0) {
                        return {
                            waitMinutes: entry.estimated_time_to_regain_access,
                            callCount: entry.call_count,
                            totalTime: entry.total_time
                        };
                    }
                    // Proactive: warn if approaching limit (>= 80%)
                    if (entry.call_count >= 80) {
                        console.warn(`[Worker] ⚠️ Meta API usage at ${entry.call_count}% of limit. Slowing down...`);
                    }
                }
            }
        }
    } catch (e) { /* ignore parse errors */ }
    return null;
}

// Helper: Sleep
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper: Get cached template or null
function getCachedTemplate(wabaId, templateName) {
    const key = `${wabaId}:${templateName}`;
    const cached = TEMPLATE_CACHE.get(key);
    if (cached && Date.now() < cached.expiresAt) {
        return cached.def;
    }
    TEMPLATE_CACHE.delete(key); // Expired
    return null;
}

// Helper: Store template in cache
function setCachedTemplate(wabaId, templateName, def) {
    const key = `${wabaId}:${templateName}`;
    TEMPLATE_CACHE.set(key, { def, expiresAt: Date.now() + TEMPLATE_CACHE_TTL_MS });
}

// ─────────────────────────────────────────────────────────────────
// MEMORY MANAGEMENT UTILITIES
// ─────────────────────────────────────────────────────────────────

/**
 * Trigger V8 garbage collection if --expose-gc flag is set.
 * Called after bulk operations (large batch sends) to reclaim memory immediately
 * instead of waiting for V8's next GC cycle.
 */
function triggerGC(reason) {
    if (typeof global.gc === 'function') {
        global.gc();
        // console.log(`[GC] Triggered: ${reason}`);
    }
}

/**
 * Evict expired entries from the TEMPLATE_CACHE Map.
 * Without this, the Map grows unboundedly as new templates are used
 * over days/weeks, eventually causing heap pressure.
 */
function evictExpiredTemplateCache() {
    const now = Date.now();
    let evicted = 0;
    for (const [key, entry] of TEMPLATE_CACHE.entries()) {
        if (now > entry.expiresAt) {
            TEMPLATE_CACHE.delete(key);
            evicted++;
        }
    }
    if (evicted > 0) {
        console.log(`[Cache] Evicted ${evicted} expired template entries. Cache size: ${TEMPLATE_CACHE.size}`);
    }
}

/**
 * Log current heap usage. Helps spot slow memory leaks over time.
 * Run every 5 minutes. If heapUsed keeps climbing → memory leak.
 */
function logMemoryStats(workerId) {
    const mem = process.memoryUsage();
    const toMB = (b) => Math.round(b / 1024 / 1024);
    console.log(
        `[Mem:${workerId}] Heap: ${toMB(mem.heapUsed)}/${toMB(mem.heapTotal)}MB` +
        ` | RSS: ${toMB(mem.rss)}MB` +
        ` | External: ${toMB(mem.external)}MB` +
        ` | TemplateCache: ${TEMPLATE_CACHE.size} entries`
    );
}

class CampaignWorker {
    constructor(supabaseUrl, supabaseServiceKey) {
        this.supabase = createClient(supabaseUrl, supabaseServiceKey);
        this.isRunning = false;
        this.isProcessing = false;
        this.workerId = Math.random().toString(36).substring(2, 7).toUpperCase();
        this.estimatedContainerCount = 10; // Starting estimate, self-tunes over time
        this._memInterval = null;
        this._cacheInterval = null;
        // Wire shared Supabase client for cross-container rate limit coordination
        setRateLimitSupabase(this.supabase);
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log(`🚀 Campaign Worker [${this.workerId}] Started`);

        // ─────────────────────────────────────────────────────────────────
        // MEMORY MONITORING: Log heap stats every 5 min
        // Watch for heapUsed steadily climbing → indicates a memory leak
        // ─────────────────────────────────────────────────────────────────
        this._memInterval = setInterval(() => {
            logMemoryStats(this.workerId);
        }, 5 * 60 * 1000); // every 5 minutes

        // ─────────────────────────────────────────────────────────────────
        // CACHE CLEANUP: Evict expired template entries every 10 min
        // Without this, old template Maps stay in heap even after campaigns end
        // ─────────────────────────────────────────────────────────────────
        this._cacheInterval = setInterval(() => {
            evictExpiredTemplateCache();
            triggerGC('scheduled cache eviction');
        }, 10 * 60 * 1000); // every 10 minutes

        try {
            logCampaignRequest('WORKER_START', {
                mode: 'Robust',
                timestamp: new Date().toISOString()
            });
        } catch (e) { console.error('Logger init failed', e); }
        this.loop();
    }

    stop() {
        this.isRunning = false;
        if (this._memInterval) clearInterval(this._memInterval);
        if (this._cacheInterval) clearInterval(this._cacheInterval);
        console.log(`[Worker ${this.workerId}] Stopped cleanly.`);
    }

    async loop() {
        // ✅ JITTER: Each container waits a random 0-5s before starting its first tick.
        // Without this, all 100 containers start simultaneously and hammer the DB at the same moment.
        const startJitter = Math.floor(Math.random() * 5000);
        console.log(`[Worker ${this.workerId}] Starting with ${startJitter}ms jitter...`);
        await sleep(startJitter);

        while (this.isRunning) {
            try {
                if (!this.isProcessing) {
                    this.isProcessing = true;

                    // ✅ STAGGERED MAINTENANCE: Only ~1% of containers run heavy maintenance per tick.
                    // At 100 containers, this means ~1 container does recovery every 2s tick.
                    // Without this, all 100 containers run recoverStaleLocks simultaneously.
                    const shouldRunMaintenance = Math.random() < (1 / Math.max(1, this.estimatedContainerCount));
                    if (shouldRunMaintenance) {
                        await this.recoverStaleLocks();
                        await this.processScheduledCampaigns();
                    }

                    await this.processQueue();
                    this.isProcessing = false;
                }
            } catch (error) {
                console.error(`[❌ Worker ${this.workerId}] Loop Error:`, error.message);
                this.isProcessing = false;
            }

            // ✅ JITTER ON EVERY TICK: Base 2s + random 0-3s extra.
            // Spreads 100 container ticks across a 5s window instead of all hitting at once.
            const tickJitter = 2000 + Math.floor(Math.random() * 3000);
            await sleep(tickJitter);
        }
    }

    async recoverStaleLocks() {
        // Recover items stuck in SENDING for more than 2 minutes.
        // ✅ Only ~1 container per tick runs this (probability-based in loop()).
        const threshold = new Date(Date.now() - 2 * 60 * 1000).toISOString();

        const { data: recovered } = await this.supabase
            .from('campaign_queue')
            .update({ status: 'PENDING' })
            .eq('status', 'SENDING')
            .lt('updated_at', threshold)
            .select('id');

        if (recovered && recovered.length > 0) {
            console.log(`[Worker ${this.workerId}] Auto-Recovered ${recovered.length} stale SENDING items.`);
        }

        // Release claims from dead containers (no heartbeat for > 60s).
        // Uses campaign_worker_claims table (no ALTER TABLE needed on campaigns).
        const claimThreshold = new Date(Date.now() - 60 * 1000).toISOString();
        const { error: releaseErr } = await this.supabase
            .from('campaign_worker_claims')
            .delete()
            .lt('claimed_at', claimThreshold);

        if (releaseErr && releaseErr.code !== '42P01') {
            // 42P01 = table doesn't exist yet — ignore until migration runs
            console.warn('[Worker] Stale claim cleanup error:', releaseErr.message);
        }
    }

    async processScheduledCampaigns() {
        const now = new Date().toISOString();

        // NOTE: claimed_by/claimed_at do NOT exist on campaigns table.
        // Campaign ownership is tracked via the separate `campaign_worker_claims` table.
        const { data: startedCampaigns, error } = await this.supabase
            .from('campaigns')
            .update({ status: 'PROCESSING' })
            .eq('status', 'SCHEDULED')
            .lte('scheduled_at', now)
            .select('id, title');

        if (error) {
            if (error.message?.includes('fetch failed') || error.message?.includes('ECONNRESET')) {
                console.warn('[Worker] Transient Supabase connection error. Retrying next tick...');
            } else {
                console.error('[Worker] Error starting scheduled campaigns:', error);
            }
            return;
        }

        if (startedCampaigns?.length > 0) {
            console.log(`[Worker ${this.workerId}] Started ${startedCampaigns.length} scheduled campaigns: ${startedCampaigns.map(c => c.title).join(', ')}`);
        }
    }

    async processQueue() {
        const { data: activeCampaigns } = await this.supabase
            .from('campaigns')
            .select('id, user_id, title, template_name, language_code, variable_mapping, media_url, media_type, location_header')
            .eq('status', 'PROCESSING');

        if (!activeCampaigns || activeCampaigns.length === 0) return;

        // ✅ SCALE: Update estimated container count based on active campaigns volume.
        // This self-tunes the maintenance probability in loop().
        this.estimatedContainerCount = Math.max(10, this.estimatedContainerCount || 10);

        // ✅ SHUFFLE: Randomize campaign order so not all containers compete on the same campaign first.
        const shuffled = [...activeCampaigns].sort(() => Math.random() - 0.5);

        // Process campaigns in parallel — each claims exclusive ownership before working.
        await Promise.all(shuffled.map(campaign => this.processCampaignBatch(campaign)));
    }

    async processCampaignBatch(campaign) {
        // ═══════════════════════════════════════════════════════════════════
        // ✅ CAMPAIGN-LEVEL OWNERSHIP CLAIM (100+ container safe)
        // ═══════════════════════════════════════════════════════════════════
        // Uses a SEPARATE `campaign_worker_claims` table — no ALTER TABLE needed.
        // UPSERT atomically: only succeeds if no live claim exists.
        // The other 99 containers get a conflict error → they skip immediately.
        // ═══════════════════════════════════════════════════════════════════
        const claimExpiry = new Date(Date.now() - 60 * 1000).toISOString();
        const now = new Date().toISOString();

        // Step 1: Delete any expired claim for this campaign (dead container cleanup)
        await this.supabase
            .from('campaign_worker_claims')
            .delete()
            .eq('campaign_id', campaign.id)
            .lt('claimed_at', claimExpiry);

        // Step 2: Try to INSERT our claim — fails if another container already has it
        const { error: claimErr } = await this.supabase
            .from('campaign_worker_claims')
            .insert({ campaign_id: campaign.id, worker_id: this.workerId, claimed_at: now });

        if (claimErr) {
            if (claimErr.code === '42P01') {
                // Table doesn't exist yet — migration not run. Skip claiming, process anyway.
                // Remove this fallback once SQL migration is confirmed.
                console.warn('[Worker] campaign_worker_claims table missing. Run SQL migration. Processing without claim lock.');
            } else if (claimErr.code === '23505') {
                // Unique violation — another container already claimed this campaign
                return; // Skip silently — the owner is handling it
            } else {
                console.warn(`[Worker ${this.workerId}] Claim insert error:`, claimErr.message);
                return;
            }
        }

        // We own this campaign. Heartbeat renews claimed_at every 20s.
        const heartbeatInterval = setInterval(async () => {
            try {
                await this.supabase
                    .from('campaign_worker_claims')
                    .update({ claimed_at: new Date().toISOString() })
                    .eq('campaign_id', campaign.id)
                    .eq('worker_id', this.workerId);
            } catch (e) { /* ignore */ }
        }, 20000);

        try {
            await this._processCampaignBatchInternal(campaign);
        } finally {
            clearInterval(heartbeatInterval);
            // Release claim so other containers can pick up next batch
            await this.supabase
                .from('campaign_worker_claims')
                .delete()
                .eq('campaign_id', campaign.id)
                .eq('worker_id', this.workerId);
        }
    }

    async _processCampaignBatchInternal(campaign) {
        // Get Config (WABA, Token)
        const { data: config } = await this.supabase
            .from('whatsapp_config')
            .select('phone_number_id, meta_access_token, whatsapp_business_account_id, phone_number')
            .eq('user_id', campaign.user_id)
            .single();

        if (!config) {
            console.error(`No config found for user ${campaign.user_id}`);
            await this.supabase.from('campaigns').update({ status: 'FAILED' }).eq('id', campaign.id);
            return;
        }

        // Check if THIS WABA is rate-limited BEFORE doing ANY work
        if (await isWabaRateLimited(config.whatsapp_business_account_id)) {
            const waitSec = getWabaRateLimitWaitSec(config.whatsapp_business_account_id);
            console.warn(`[Worker ${this.workerId}] ⏸️ WABA ${config.whatsapp_business_account_id} rate-limited ${waitSec}s. Skipping.`);
            return;
        }

        // Template vars
        let templateDef = null;
        let localButtons = null;
        let localTmpl = null;

        try {
            // ══════════════════════════════════════════════════════════════
            // TEMPLATE STRATEGY: Fetch from Meta ONCE → Store in DB → Reuse forever
            // ══════════════════════════════════════════════════════════════
            // Uses `template_components_cache` table (no ALTER TABLE needed).
            // 1st: Check cache table → 0 Meta API calls
            // 2nd: Fetch from Meta ONCE if not cached → save to cache table
            // Result: Meta called exactly 1 time per template, ever.
            // ══════════════════════════════════════════════════════════════

            // Step 1: Get local template (buttons, type, text)
            const { data: localTmpls } = await this.supabase
                .from('whatsapp_templates')
                .select('id, buttons, language, template_type, body_text, header_text')
                .eq('name', campaign.template_name)
                .eq('user_id', campaign.user_id);

            localTmpl = localTmpls?.find(t => t.language === campaign.language_code)
                || localTmpls?.find(t => t.language.startsWith(campaign.language_code.split('_')[0]))
                || localTmpls?.[0];

            if (localTmpl) {
                localButtons = localTmpl.buttons;

                // Step 2: Check dedicated components cache table
                const { data: cachedComp } = await this.supabase
                    .from('template_components_cache')
                    .select('components')
                    .eq('user_id', campaign.user_id)
                    .eq('template_name', campaign.template_name)
                    .single();

                if (cachedComp?.components?.length > 0) {
                    // ✅ CACHE HIT: Components in DB — zero Meta API calls
                    templateDef = {
                        name: campaign.template_name,
                        language: localTmpl.language,
                        components: cachedComp.components,
                        buttons: localTmpl.buttons || [],
                        body_text: localTmpl.body_text,
                        header_text: localTmpl.header_text,
                        template_type: localTmpl.template_type
                    };
                    console.log(`[Worker] ✅ Template '${campaign.template_name}' from component cache (0 Meta API calls).`);

                } else if (config.whatsapp_business_account_id && !(await isWabaRateLimited(config.whatsapp_business_account_id))) {
                    // ⬇️ CACHE MISS: Fetch from Meta ONCE and save permanently
                    console.log(`[Worker] 🔄 Fetching template '${campaign.template_name}' from Meta (first time only)...`);
                    try {
                        const tmplRes = await axios.get(
                            `${GRAPH_API_URL}/${config.whatsapp_business_account_id}/message_templates?name=${encodeURIComponent(campaign.template_name)}`,
                            {
                                headers: { 'Authorization': `Bearer ${config.meta_access_token}` },
                                httpsAgent: httpsAgent,
                                timeout: 10000
                            }
                        );

                        const usageInfo = parseMetaRateLimitHeader(tmplRes.headers);
                        if (usageInfo?.callCount >= 80) {
                            console.warn(`[Worker] ⚠️ Meta API at ${usageInfo.callCount}% usage.`);
                        }

                        if (tmplRes.data?.data) {
                            const metaDef = tmplRes.data.data.find(t => t.language === campaign.language_code) || tmplRes.data.data[0];
                            if (metaDef?.components) {
                                templateDef = { ...metaDef, buttons: localTmpl.buttons || [] };

                                // 💾 SAVE TO CACHE TABLE — all future sends skip Meta entirely
                                await this.supabase
                                    .from('template_components_cache')
                                    .upsert({
                                        user_id: campaign.user_id,
                                        template_name: campaign.template_name,
                                        components: metaDef.components,
                                        updated_at: new Date().toISOString()
                                    }, { onConflict: 'user_id,template_name' });

                                console.log(`[Worker] 💾 Template components saved to cache. Future sends = 0 Meta calls.`);
                            }
                        }
                    } catch (metaErr) {
                        const errCode = metaErr.response?.data?.error?.code;
                        if (errCode === 80008) {
                            const rateLimitInfo = parseMetaRateLimitHeader(metaErr.response?.headers);
                            const pauseMs = (rateLimitInfo?.waitMinutes > 0)
                                ? rateLimitInfo.waitMinutes * 60 * 1000
                                : RATE_LIMIT_DEFAULT_PAUSE_MS;
                            console.error(`[Worker] 🚨 Rate Limit (80008) on template fetch! Pausing WABA ${config.whatsapp_business_account_id} for ${Math.ceil(pauseMs / 60000)}min.`);
                            await setWabaRateLimit(config.whatsapp_business_account_id, pauseMs);
                        } else {
                            console.warn(`[Worker] Meta template fetch warning: ${metaErr.message}`);
                        }
                        // Fall through — send with minimal payload
                    }
                } else {
                    console.warn(`[Worker] ⏸️ Rate-limited or no WABA ID — using local template data only.`);
                }
            } else {
                console.warn(`[Worker] ⚠️ Template '${campaign.template_name}' not found in local DB for user ${campaign.user_id}.`);
            }
        } catch (e) {
            console.warn(`[Worker] Template fetch error:`, e.message);
        }

        // 3. Merge Strategies
        if (templateDef && localButtons) {
            templateDef.buttons = localButtons;
            console.log('[Worker] Merged Local Buttons into Template Def.');
        } else if (!templateDef && localButtons) {
            // (Duplication removed)

            const components = [];
            if (localTmpl) {
                if (localTmpl.template_type && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(localTmpl.template_type)) {
                    components.push({ type: 'HEADER', format: localTmpl.template_type });
                } else if (localTmpl.template_type === 'TEXT' || localTmpl.header_text) {
                    components.push({ type: 'HEADER', format: 'TEXT', text: localTmpl.header_text || '' });
                }

                if (localTmpl.body_text) {
                    components.push({ type: 'BODY', text: localTmpl.body_text });
                }
            }

            templateDef = {
                name: campaign.template_name,
                language: campaign.language_code,
                components: components,
                buttons: localButtons
            };
            // console.warn('[Worker] Using ONLY Local Buttons (Meta API failed). Constructed Components based on DB.');
        } else if (!templateDef) {
            console.error('[Worker] CRITICAL: Template Definition not found in DB or Meta API.');
        }

        // Fetch Pending Items OR Items due for Retry
        // OPTIMISTIC LOCKING: We try to find items and lock them to 'SENDING' immediately.

        // 1. Find candidates (LIMIT BATCH_SIZE)
        // SIMPLIFIED QUERY to avoid syntax errors with timestamps
        const { data: candidates, error: fetchErr } = await this.supabase
            .from('campaign_queue')
            .select('id, status, next_retry_at, phone_number')
            .eq('campaign_id', campaign.id)
            .in('status', ['PENDING', 'RETRYING'])
            .limit(BATCH_SIZE * 2); // Fetch more to allow for filtering

        if (fetchErr) {
            console.error('[Worker] Error fetching queue candidates:', fetchErr);
            return;
        }

        // Filter RETRYING items that are not yet due
        const now = new Date();
        const validCandidates = candidates ? candidates.filter(c => {
            if (c.status === 'PENDING') return true;
            if (c.status === 'RETRYING' && c.next_retry_at && new Date(c.next_retry_at) <= now) return true;
            return false;
        }).slice(0, BATCH_SIZE) : [];

        // Use validCandidates for the rest
        const candidateData = validCandidates; // Renaming to match logic flow if needed, but we used 'candidates' variable before.
        // Let's just override candidates variable or use a new one.
        // The original code used 'candidates'. Let's reuse the name or adjust logic.
        const effectiveCandidates = validCandidates;

        if (!effectiveCandidates || effectiveCandidates.length === 0) {
            // Check if ANY are left pending (to mark campaign completed)
            const { count } = await this.supabase
                .from('campaign_queue')
                .select('*', { count: 'exact', head: true })
                .eq('campaign_id', campaign.id)
                .in('status', ['PENDING', 'RETRYING', 'SENDING']); // Include SENDING so we don't close early while others are working

            if (count === 0) {
                console.log(`Campaign ${campaign.id} Completed!`);
                await this.supabase.from('campaigns').update({ status: 'COMPLETED' }).eq('id', campaign.id);
            } else {
                // If count > 0 but we found no candidates, it means they are all in SENDING/RETRYING(future)
                // We should log this so the user knows we are waiting.
                // console.log(`[Worker] Waiting for ${count} items (Status: SENDING/RETRYING)...`);
            }
            return;
        }

        // 2. Lock Candidates -> Set to SENDING
        // We only process items that we successfully updated to SENDING.
        // This prevents race conditions if multiple workers grabbed the same candidate IDs.
        // 2. Lock Candidates -> Set to SENDING
        // We only process items that we successfully updated to SENDING.
        const candidateIds = effectiveCandidates.map(c => c.id);

        // Log Lock Attempt
        try {
            console.log(`[Worker] Attempting to lock ${candidateIds.length} candidates...`);
            logCampaignRequest('LOCK_ATTEMPT', {
                workerId: this.workerId,
                campaignId: campaign.id,
                phoneNumberId: config.phone_number_id,
                whatsappNumber: config.phone_number,
                candidates: effectiveCandidates.map(c => ({ id: c.id, phone: c.phone_number }))
            });
        } catch (ignore) { }

        const { data: lockedItems, error: lockErr } = await this.supabase
            .from('campaign_queue')
            .update({
                status: 'SENDING',
                updated_at: new Date().toISOString() // Explicitly update timestamp for recovery
            })
            .in('id', candidateIds)
            .in('status', ['PENDING', 'RETRYING']) // Simpler status check
            .select('*, contacts(*)');

        if (lockErr) {
            console.error('Error locking queue items:', lockErr);
            return;
        }

        if (!lockedItems || lockedItems.length === 0) {
            // We found candidates but failed to lock them (maybe another worker took them).
            try {
                logCampaignRequest('LOCK_FAILED_RACE', {
                    workerId: this.workerId,
                    campaignId: campaign.id,
                    candidates: effectiveCandidates.map(c => ({ id: c.id, phone: c.phone_number }))
                });
            } catch (ignore) { }
            return;
        }

        // Log Lock Success
        try {
            console.log(`[Worker] Successfully locked ${lockedItems.length} items. Processing...`);
            logCampaignRequest('LOCK_SUCCESS', {
                workerId: this.workerId,
                campaignId: campaign.id,
                phoneNumberId: config.phone_number_id,
                whatsappNumber: config.phone_number,
                lockedCount: lockedItems.length,
                lockedIds: lockedItems.map(i => i.id),
                phones: lockedItems.map(i => i.phone_number)
            });
        } catch (ignore) { }

        const items = lockedItems;

        // Process Batch
        const chunks = [];
        for (let i = 0; i < items.length; i += MAX_CONCURRENCY) {
            chunks.push(items.slice(i, i + MAX_CONCURRENCY));
        }

        for (const chunk of chunks) {
            console.log(`[Worker] Processing chunk of ${chunk.length} items...`);
            const promises = chunk.map(item => {
                console.log(`[Worker] Calling sendMessage for ${item.phone_number}`);
                return this.sendMessage(item, campaign, config, templateDef);
            });
            await Promise.all(promises);
            await sleep(RATE_LIMIT_DELAY_MS * chunk.length);
        }

        // Free memory from this batch: axios response bodies, contact objects, payload buffers
        triggerGC('batch complete');
    }

    async sendMessage(item, campaign, config, templateDef) {
        console.log(`[Worker] Inside sendMessage() for ${item.phone_number}`);
        try {
            const components = [];
            const bodyParams = [];

            // Handle Media Header
            // Robust finding of Header Component (Case-insensitive)
            const headerDef = templateDef?.components?.find(c => c.type?.toUpperCase() === 'HEADER');

            if (campaign.media_url && campaign.media_type) {
                // Formatting Check:
                // 1. We must have a header definition in the template.
                // 2. The header format must match the media type (Case Insensitive).
                const mediaType = campaign.media_type.toUpperCase();

                if (headerDef && headerDef.format?.toUpperCase() === mediaType) {
                    components.push({
                        type: "header",
                        parameters: [
                            {
                                type: campaign.media_type.toLowerCase(),
                                [campaign.media_type.toLowerCase()]: {
                                    link: campaign.media_url.trim()
                                }
                            }
                        ]
                    });
                } else if (headerDef) {
                    console.warn(`[Worker] Header Mismatch or Skip. Template expects ${headerDef.format}, got ${mediaType}`);
                }
            } else if (campaign.location_header) {
                // Handle Location Header
                if (headerDef && headerDef.format === 'LOCATION') {
                    components.push({
                        type: "header",
                        parameters: [
                            {
                                type: "location",
                                location: {
                                    latitude: campaign.location_header.latitude,
                                    longitude: campaign.location_header.longitude,
                                    name: campaign.location_header.name,
                                    address: campaign.location_header.address
                                }
                            }
                        ]
                    });
                }
            }

            // Handle Variable Mapping (Assumed for BODY)
            if (campaign.variable_mapping) {
                // Only process keys that are actually present in the template text
                // We need to parse the template body to find {{1}}, {{2}} etc.
                const bodyText = templateDef?.components?.find(c => c.type === 'BODY')?.text;
                if (bodyText) {
                    const matches = bodyText.match(/{{(\d+|[a-zA-Z0-9_]+)}}/g);
                    if (matches) {
                        const requiredKeys = matches.map(m => m.replace(/{{|}}/g, ''));

                        requiredKeys.forEach(key => {
                            const field = campaign.variable_mapping[key];
                            let value = '';

                            // Helper to resolve nested paths (e.g. custom_data.Age)
                            // or direct properties (e.g. email, name)
                            // Helper to resolve nested paths (e.g. custom_data.Age)
                            // or direct properties (e.g. email, name)
                            // Enhanced with Case-Insensitive fallback
                            const resolvePath = (obj, path) => {
                                if (!obj || !path) return undefined;
                                const parts = path.split('.');

                                let current = obj;
                                for (const part of parts) {
                                    if (current === null || current === undefined) return undefined;

                                    // 1. Try Exact Match
                                    if (current[part] !== undefined) {
                                        current = current[part];
                                        continue;
                                    }

                                    // 2. Try Case-Insensitive Match (only if current is an object)
                                    if (typeof current === 'object' && !Array.isArray(current)) {
                                        const keys = Object.keys(current);
                                        const foundKey = keys.find(k => k.toLowerCase() === part.toLowerCase());
                                        if (foundKey) {
                                            current = current[foundKey];
                                            continue;
                                        }
                                    }

                                    return undefined; // Not found
                                }
                                return current;
                            };

                            if (field && item.contacts) {
                                let resolved = resolvePath(item.contacts, field);

                                // Fallback for common mis-mapping (e.g. custom_data.name -> name) created by Input Builder duplicates
                                if ((resolved === undefined || resolved === null) && field.startsWith('custom_data.')) {
                                    const leaf = field.split('.')[1];
                                    // If we failed to find it in custom_data, check if it exists at root levels for valid standards
                                    if (['name', 'phone', 'email', 'status', 'source'].includes(leaf)) {
                                        resolved = item.contacts[leaf];
                                    }
                                }

                                if (resolved !== undefined && resolved !== null) {
                                    value = resolved;
                                }
                            }

                            // Fallbacks
                            if (!value && field === 'phone') {
                                value = item.phone_number;
                            }

                            // Handling missing values
                            if (value === undefined || value === '' || value === null) {
                                // If the field looks like a path (e.g. custom_data.X or name/email), send empty string to avoid leaking technical keys
                                const isLikelyPath = field && (
                                    field.toLowerCase().startsWith('custom_data.') ||
                                    ['name', 'email', 'phone', 'status', 'source'].includes(field.toLowerCase())
                                );
                                if (isLikelyPath) {
                                    value = '';
                                } else {
                                    // Otherwise, assume it's a static text string the user typed (e.g. "Welcome")
                                    value = field || '';
                                }
                            }

                            bodyParams.push({
                                type: "text",
                                text: String(value)
                            });
                        });
                    }
                }
            }

            if (bodyParams.length > 0) {
                components.push({
                    type: "body",
                    parameters: bodyParams
                });
            }

            // Handle Carousel Media (stored in variable_mapping._carousel_media)
            if (campaign.variable_mapping && campaign.variable_mapping._carousel_media) {
                const carUrls = campaign.variable_mapping._carousel_media;

                // 1. Try finding in Components (Meta Standard)
                let carouselDef = templateDef?.components?.find(c => String(c.type).trim().toUpperCase() === 'CAROUSEL' || String(c.type).trim().toUpperCase() === 'MPM');

                // 2. Try finding in Buttons (Custom App Structure for Media Carousel)
                let customCarouselDef = null;
                // If not found in components, check buttons column
                if (!carouselDef && templateDef?.buttons) {
                    if (templateDef.buttons.type === 'MEDIA_CARD_CAROUSEL' && Array.isArray(templateDef.buttons.cards)) {
                        customCarouselDef = templateDef.buttons;
                        console.log('[Worker] Found MEDIA_CARD_CAROUSEL in buttons column.');
                    } else if (Array.isArray(templateDef.buttons)) {
                        customCarouselDef = templateDef.buttons.find(b => b.type === 'MEDIA_CARD_CAROUSEL');
                    }
                }

                console.log(`[Worker] Carousel Def: ${carouselDef ? 'Standard' : (customCarouselDef ? 'Custom' : 'NOT FOUND')}`);

                if (Array.isArray(carUrls) && carUrls.length > 0) {
                    const carouselCards = carUrls.map((url, idx) => {
                        if (!url) return null;

                        const cardComponents = [];

                        // 1. Header Media
                        const isVideo = url.toLowerCase().match(/\.(mp4|mov|avi|wmv)$/);
                        cardComponents.push({
                            type: 'header',
                            parameters: [
                                {
                                    type: isVideo ? 'video' : 'image',
                                    [isVideo ? 'video' : 'image']: {
                                        link: url
                                    }
                                }
                            ]
                        });

                        // 2. Buttons (Dynamic)
                        let cardButtons = null;

                        // Strategy A: Standard Meta
                        if (carouselDef && carouselDef.cards && carouselDef.cards[idx]) {
                            const cardDef = carouselDef.cards[idx];
                            const buttonsDef = cardDef.components?.find(c => c.type.toUpperCase() === 'BUTTONS');
                            if (buttonsDef) cardButtons = buttonsDef.buttons;
                        }
                        // Strategy B: Custom (Direct Buttons array in Card)
                        else if (customCarouselDef && customCarouselDef.cards && customCarouselDef.cards[idx]) {
                            cardButtons = customCarouselDef.cards[idx].buttons;
                        }

                        if (cardButtons && Array.isArray(cardButtons)) {
                            cardButtons.forEach((btn, btnIdx) => {
                                const btnType = btn.type.toUpperCase();
                                // SKIP PHONE_NUMBER buttons (Meta API Error #100: phone_number not valid sub_type)
                                if (btnType === 'PHONE_NUMBER') return;

                                const btnPayload = {
                                    type: 'button',
                                    sub_type: btnType.toLowerCase(),
                                    index: btnIdx
                                };

                                if (btnType === 'QUICK_REPLY') {
                                    btnPayload.parameters = [{
                                        type: 'payload',
                                        payload: `CARD_${idx}_BTN_${btnIdx}`
                                    }];
                                } else if (btnType === 'URL') {
                                    const isDynamicArgs = btn.url && /\{\{\d+\}\}/.test(btn.url);
                                    if (isDynamicArgs) {
                                        btnPayload.parameters = [{
                                            type: 'text',
                                            text: ' '
                                        }];
                                    }
                                }
                                cardComponents.push(btnPayload);
                            });
                        }

                        return {
                            card_index: idx,
                            components: cardComponents
                        };
                    }).filter(Boolean);

                    if (carouselCards.length > 0) {
                        components.push({
                            type: 'carousel',
                            cards: carouselCards
                        });
                    }
                }
            }

            // Handle Flow Button
            if (templateDef && templateDef.components) {
                const buttonsComp = templateDef.components.find(c => c.type === 'BUTTONS');
                if (buttonsComp && buttonsComp.buttons) {
                    buttonsComp.buttons.forEach((btn, index) => {
                        if (btn.type === 'FLOW') {
                            components.push({
                                type: "button",
                                sub_type: "flow",
                                index: index,
                                parameters: [
                                    {
                                        type: "action",
                                        action: {
                                            flow_token: btn.flow_id || "unused_token"
                                        }
                                    }
                                ]
                            });
                        }
                    });
                }
            }

            const payload = {
                messaging_product: "whatsapp",
                to: item.phone_number,
                type: "template",
                template: {
                    name: campaign.template_name,
                    language: { code: campaign.language_code },
                    components: components.length > 0 ? components : undefined
                }
            };

            // LOG REQUEST
            try {
                logCampaignRequest('SEND_MESSAGE', {
                    workerId: this.workerId,
                    campaignId: campaign.id,
                    phoneNumberId: config.phone_number_id,
                    whatsappNumber: config.phone_number,
                    queueId: item.id,
                    phone: item.phone_number,
                    template: campaign.template_name,
                    payload: payload
                });
            } catch (ignore) { }

            // Guard: Don't send if we are currently rate-limited by Meta
            if (await isWabaRateLimited(config.whatsapp_business_account_id)) {
                const waitSec = getWabaRateLimitWaitSec(config.whatsapp_business_account_id);
                console.warn(`[Worker] ⏸️ Skipping send to ${item.phone_number} — rate-limited for ${waitSec}s more. Will retry.`);
                await this.supabase.from('campaign_queue').update({
                    status: 'RETRYING',
                    retry_count: (item.retry_count || 0),
                    next_retry_at: new Date(Date.now() + (waitSec * 1000)).toISOString(),
                    error_message: 'Paused: Meta API rate limit (80008). Will retry automatically.'
                }).eq('id', item.id);
                return;
            }

            // 🚀 MARKETING MESSAGES API (MM LITE) OPTIMIZATION
            // Use specialized high-performance endpoint for Marketing templates
            const isMarketingTemplate = templateDef?.category === 'MARKETING' || campaign.template_name?.toLowerCase().includes('mkt');
            const endpoint = isMarketingTemplate ? 'marketing_messages' : 'messages';
            const url = `${GRAPH_API_URL}/${config.phone_number_id}/${endpoint}`;

            console.log(`[Worker] Sending via ${endpoint.toUpperCase()} endpoint (Template Category: ${templateDef?.category || 'Unknown'})`);

            let response;
            try {
                response = await axios.post(
                    url,
                    payload,
                    {
                        headers: { 'Authorization': `Bearer ${config.meta_access_token}` },
                        httpsAgent: httpsAgent
                    }
                );
            } catch (postErr) {
                // FALLBACK: If /marketing_messages fails with 'Unknown path' (Error 100), 
                // it might not be transitioned yet. Fall back to standard /messages.
                const errData = postErr.response?.data?.error;
                if (isMarketingTemplate && (errData?.code === 100 || errData?.message?.includes('Unknown path'))) {
                    console.warn(`[Worker] Fallback: /marketing_messages not ready for ${config.phone_number_id}. Using standard /messages.`);
                    response = await axios.post(
                        `${GRAPH_API_URL}/${config.phone_number_id}/messages`,
                        payload,
                        {
                            headers: { 'Authorization': `Bearer ${config.meta_access_token}` },
                            httpsAgent: httpsAgent
                        }
                    );
                } else {
                    throw postErr; // Re-throw other errors
                }
            }

            // LOG SUCCESS RESPONSE
            try {
                logCampaignRequest('SEND_MESSAGE_RESPONSE', {
                    campaignName: campaign.title,
                    campaignId: campaign.id,
                    phone: item.phone_number,
                    from: config.phone_number,
                    to: item.phone_number,
                    phoneNumberId: config.phone_number_id,
                    whatsappNumber: config.phone_number,
                    templateName: campaign.template_name,
                    status: 'SUCCESS',
                    response: response.data
                });
            } catch (ignore) { }

            // Success
            await this.supabase.from('campaign_queue').update({
                status: 'SENT',
                message_id: response.data.messages[0].id,
                sent_at: new Date().toISOString(),
                error_message: null
            }).eq('id', item.id);

            await this.supabase.rpc('increment_campaign_success', { row_id: campaign.id });

            // Render Body Text for Inbox Preview
            let renderedBody = null;
            let renderedHeaderText = null; // New: Capture Main Header Text
            let footerText = null;
            const _rendered_cards = [];
            const _rendered_buttons = [];

            try {
                // Main Header (Text)
                const headerDef = templateDef?.components?.find(c => c.type?.toUpperCase() === 'HEADER');
                if (headerDef && headerDef.format === 'TEXT') {
                    renderedHeaderText = headerDef.text;
                    const headerParams = components.find(c => c.type === 'header')?.parameters;
                    if (headerParams) {
                        headerParams.forEach((p, i) => {
                            renderedHeaderText = renderedHeaderText.replace(new RegExp(`\\{\\{${i + 1}\\}\\}`, 'g'), p.text || '');
                        });
                    }
                }

                // Main Body (Case-insensitive)
                const bodyDef = templateDef?.components?.find(c => c.type?.toUpperCase() === 'BODY');
                if (bodyDef && bodyDef.text) {
                    renderedBody = bodyDef.text;
                    // Replace {{1}}, {{2}} with param values
                    if (bodyParams && bodyParams.length > 0) {
                        bodyParams.forEach((p, i) => {
                            // Replace {{i+1}}
                            renderedBody = renderedBody.replace(new RegExp(`\\{\\{${i + 1}\\}\\}`, 'g'), p.text);
                        });
                    }
                }

                const footerDef = templateDef?.components?.find(c => c.type?.toUpperCase() === 'FOOTER');
                if (footerDef) footerText = footerDef.text;

                // Carousel Cards Text & Media
                // Strategy: Prioritize Local "Custom" Definition for Content (Text, Buttons) as it reflects the User's Builder state.
                // Fallback to Meta Definition for structure.

                // 1. Find Local Definition (from 'buttons' column - standard in this app for Carousel/MPM)
                let localCarouselDef = null;
                if (templateDef?.buttons?.type === 'MEDIA_CARD_CAROUSEL' && Array.isArray(templateDef.buttons.cards)) {
                    localCarouselDef = templateDef.buttons;
                } else if (Array.isArray(templateDef?.buttons)) {
                    // Try to find the carousel object in the array
                    localCarouselDef = templateDef.buttons.find(b => b.type === 'MEDIA_CARD_CAROUSEL');
                }

                // 2. Find Meta Definition (Standard Components)
                const metaCarouselDef = templateDef?.components?.find(c => String(c.type).trim().toUpperCase() === 'CAROUSEL' || String(c.type).trim().toUpperCase() === 'MPM');

                // Active Def is primarily for validation that we HAVE a carousel
                const hasCarousel = localCarouselDef || metaCarouselDef;

                if (hasCarousel && campaign.variable_mapping?._carousel_media) {
                    const carUrls = campaign.variable_mapping._carousel_media;
                    if (Array.isArray(carUrls)) {
                        carUrls.forEach((url, idx) => {
                            // Get Card Definitions from both sources
                            const localCard = localCarouselDef?.cards?.[idx];
                            const metaCardComponent = metaCarouselDef?.cards?.[idx];

                            // We need at least one definition to proceed
                            if (localCard || metaCardComponent) {

                                // ---- BODY TEXT ----
                                // Prioritize Local Body, then Meta Body Component
                                let cardBody = '';
                                if (localCard && localCard.body) {
                                    cardBody = localCard.body;
                                } else if (metaCardComponent) {
                                    const bodyComp = metaCardComponent.components?.find(c => c.type?.toUpperCase() === 'BODY');
                                    cardBody = bodyComp?.text || '';
                                }

                                // ---- HEADER TEXT ----
                                let cardHeaderText = '';
                                let headerType = 'IMAGE';

                                if (localCard && localCard.header) {
                                    // Assuming local header structure
                                    cardHeaderText = localCard.header.text || '';
                                    headerType = localCard.header.format || 'IMAGE';
                                } else if (metaCardComponent) {
                                    const headerComp = metaCardComponent.components?.find(c => c.type?.toUpperCase() === 'HEADER');
                                    cardHeaderText = headerComp?.format === 'TEXT' ? headerComp.text : '';
                                    headerType = headerComp?.format || 'IMAGE';
                                }

                                // ---- BUTTONS ----
                                // Prioritize Local Buttons (Exact labels user typed)
                                let cardButtons = [];

                                if (localCard && Array.isArray(localCard.buttons) && localCard.buttons.length > 0) {
                                    cardButtons = localCard.buttons.map(b => ({
                                        type: 'BUTTON',
                                        sub_type: b.type,
                                        text: b.text || b.label || 'Button', // Local usually has 'text'
                                        url: b.url
                                    }));
                                } else if (metaCardComponent) {
                                    // Fallback to Meta Extraction (Complex)
                                    const componentList = metaCardComponent.components || [];
                                    const buttonsContainer = componentList.find(c => c.type?.toUpperCase() === 'BUTTONS');

                                    if (buttonsContainer && Array.isArray(buttonsContainer.buttons)) {
                                        cardButtons = buttonsContainer.buttons.map(b => ({
                                            type: 'BUTTON',
                                            sub_type: b.type,
                                            text: b.text || b.label || (b.type === 'URL' ? 'Visit Link' : 'Select'),
                                            url: b.url
                                        }));
                                    } else {
                                        cardButtons = componentList.filter(c => c.type?.toUpperCase() === 'BUTTON').map(b => ({
                                            type: b.type,
                                            sub_type: b.sub_type,
                                            text: b.text || b.label || (b.sub_type === 'url' ? 'Visit Link' : 'Select'),
                                            url: b.url
                                        }));
                                    }
                                }

                                _rendered_cards.push({
                                    index: idx,
                                    body: cardBody,
                                    header_text: cardHeaderText,
                                    media_url: url,
                                    media_type: headerType,
                                    buttons: cardButtons
                                });
                            }
                        });
                    }
                }
                // Standard Buttons (Non-Carousel)
                // Strategy: Prioritize Local 'buttons' column, then fallback to Meta 'components'
                // _rendered_buttons initialized at top
                if (!hasCarousel) {
                    let localButtons = null;
                    // Check if 'buttons' is an array of actual buttons (not carousel wrapper)
                    if (Array.isArray(templateDef?.buttons) && templateDef.buttons.length > 0) {
                        // Filter out carousel objects just in case
                        const validButtons = templateDef.buttons.filter(b => b.type !== 'MEDIA_CARD_CAROUSEL');
                        if (validButtons.length > 0) localButtons = validButtons;
                    }

                    if (localButtons) {
                        _rendered_buttons.push(...localButtons.map(b => ({
                            type: b.type,
                            sub_type: b.type, // Local usually implies type is what we want
                            text: b.text || b.label || (b.type === 'URL' ? 'Visit Website' : 'Button'),
                            url: b.url,
                            phone_number: b.phone_number
                        })));
                    } else {
                        // Fallback to Meta Components
                        const buttonComp = templateDef?.components?.find(c => c.type?.toUpperCase() === 'BUTTONS');

                        if (buttonComp && Array.isArray(buttonComp.buttons)) {
                            // Struct: BUTTONS -> buttons array
                            _rendered_buttons.push(...buttonComp.buttons.map(b => ({
                                type: 'BUTTON',
                                sub_type: b.type,
                                text: b.text || b.label || (b.type === 'URL' ? 'Visit Website' : 'Button'),
                                url: b.url,
                                phone_number: b.phone_number
                            })));
                        } else {
                            // Struct: Individual BUTTON components
                            const individualButtons = templateDef?.components?.filter(c => c.type?.toUpperCase() === 'BUTTON');
                            if (individualButtons && individualButtons.length > 0) {
                                _rendered_buttons.push(...individualButtons.map(b => ({
                                    type: b.type,
                                    sub_type: b.sub_type,
                                    text: b.text || b.label || (b.sub_type === 'url' ? 'Visit Website' : 'Button'),
                                    url: b.url,
                                    phone_number: b.phone_number
                                })));
                            }
                        }
                    }
                }
            } catch (renderErr) {
                console.warn('[Worker] Failed to render template preview:', renderErr);
            }

            // LOG TO INBOX (Create Conversation Entry)
            const waMessageId = response.data.messages[0].id;
            try {
                const logPayload = {
                    ...payload.template,
                    _rendered_header_text: renderedHeaderText,
                    _rendered_body: renderedBody,
                    _rendered_buttons: _rendered_buttons,
                    _footer_text: footerText,
                    _rendered_cards: _rendered_cards
                };

                await whatsappService.logOutboundMessage(
                    campaign.user_id,
                    item.phone_number,
                    'template',
                    logPayload,
                    'sent',
                    waMessageId
                );
            } catch (logErr) {
                console.error('[Worker] Failed to log campaign message to Inbox:', logErr);
            }

        } catch (error) {
            const errorData = error.response?.data?.error || {};
            const errorMsg = errorData.message || error.message;
            const errorCode = errorData.code;
            const errorSubcode = errorData.error_subcode;

            // LOG ERROR RESPONSE
            try {
                logCampaignRequest('SEND_MESSAGE_RESPONSE', {
                    campaignName: campaign.title,
                    campaignId: campaign.id,
                    phone: item.phone_number,
                    from: config.phone_number,
                    to: item.phone_number,
                    phoneNumberId: config.phone_number_id,
                    whatsappNumber: config.phone_number,
                    templateName: campaign.template_name,
                    status: 'FAILED',
                    error: error.response?.data || error.message
                });
            } catch (ignore) { }

            console.error(`Failed to send to ${item.phone_number}:`, errorMsg);

            // Determine if Retryable
            // 131047: Rate Limit (Pause Campaign)
            // 131026: Message Undeliverable (Don't Retry)
            // 131006: Something went wrong (Retry)
            // 5xx: Server Error (Retry)

            let shouldRetry = false;
            let isRateLimit = false;

            if (errorCode === 131047) {
                // WhatsApp Cloud API messaging rate limit
                isRateLimit = true;
            } else if (errorCode === 80008) {
                // WhatsApp Business Management API rate limit — pause ALL calls
                isRateLimit = true;
                const rateLimitInfo = parseMetaRateLimitHeader(error.response?.headers);
                let pauseMs = RATE_LIMIT_DEFAULT_PAUSE_MS;
                if (rateLimitInfo && rateLimitInfo.waitMinutes > 0) {
                    pauseMs = rateLimitInfo.waitMinutes * 60 * 1000;
                    console.error(`[Worker] 🚨 80008 on SEND! Meta says wait ${rateLimitInfo.waitMinutes} min. Pausing WABA ${config.whatsapp_business_account_id} until ${new Date(Date.now() + pauseMs).toISOString()}`);
                } else {
                    console.error(`[Worker] 🚨 80008 on SEND! Pausing WABA ${config.whatsapp_business_account_id} for ${RATE_LIMIT_DEFAULT_PAUSE_MS / 1000}s.`);
                }
                await setWabaRateLimit(config.whatsapp_business_account_id, pauseMs);
                // ✅ FIX: Only clear cache for THIS WABA — not all other users' WABAs
                for (const key of TEMPLATE_CACHE.keys()) {
                    if (key.startsWith(`${config.whatsapp_business_account_id}:`)) {
                        TEMPLATE_CACHE.delete(key);
                    }
                }
            } else if (errorCode >= 500 || errorCode === 131006 || !error.response) {
                shouldRetry = true;
            } else if (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
                // Network-level failure (Meta's server refusing or dropping connection)
                // This usually happens during or just after a rate limit period — always retry
                console.warn(`[Worker] Network error (${error.code}) sending to ${item.phone_number}. Will retry.`);
                shouldRetry = true;
            }

            if (isRateLimit) {
                console.warn(`⚠️ Rate limit hit for campaign ${campaign.id}. Pausing campaign.`);
                await this.supabase.from('campaigns').update({ status: 'PAUSED' }).eq('id', campaign.id);
                // Also mark this item to retry later
                shouldRetry = true;
            }

            if (shouldRetry && (item.retry_count || 0) < MAX_RETRIES) {
                const nextRetry = new Date();
                // Exponential Backoff: 1m, 5m, 15m
                const delayMinutes = Math.pow(5, (item.retry_count || 0) + 1);
                nextRetry.setMinutes(nextRetry.getMinutes() + delayMinutes);

                await this.supabase.from('campaign_queue').update({
                    status: 'RETRYING',
                    retry_count: (item.retry_count || 0) + 1,
                    next_retry_at: nextRetry.toISOString(),
                    error_message: errorMsg
                }).eq('id', item.id);
            } else {
                // Fatal Error or Max Retries Exceeded
                await this.supabase.from('campaign_queue').update({
                    status: 'FAILED',
                    error_message: errorMsg
                }).eq('id', item.id);

                await this.supabase.rpc('increment_campaign_failed', { row_id: campaign.id });
            }
        }
    }
}

module.exports = CampaignWorker;
