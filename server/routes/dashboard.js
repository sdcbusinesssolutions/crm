
const express = require('express');
const router = express.Router();
const { getAuthenticatedSupabase, supabaseAdmin } = require('../lib/supabaseClient');
const requireAuth = require('../middleware/requireAuth');
const facebookService = require('../services/FacebookLeadService');

// ============================================================
// In-memory JSON cache — shared per user, held in-process RAM
// Much faster than re-fetching Supabase on every request
// ============================================================
if (!global.dashboardCache)      global.dashboardCache      = {};
if (!global.dashboardChartCache) global.dashboardChartCache = {};
if (!global.connectionCache)     global.connectionCache     = {};

const STATS_TTL   = 15 * 60 * 1000; // 15 minutes (was 5) — more visits served from RAM
const CHARTS_TTL  = 30 * 60 * 1000; // 30 minutes (was 10) — chart data changes rarely
const CONN_TTL    = 10 * 60 * 1000; // 10 minutes (was 5)  — Meta API is slow, cache longer

// ============================================================
// PHASE 1: FAST SUMMARY — ~8 parallel queries (was 19)
// KEY IMPROVEMENT: Single leads fetch replaces 5 separate ones
// Cache: 5 min in-process memory → nearly instant on warmup
// ============================================================
router.get('/stats', requireAuth, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
        const userId = req.user.id;
        const supabase = supabaseAdmin;

        // ── Serve from in-memory cache if fresh ───────────────────────
        const cached = global.dashboardCache[userId];
        if (cached && (Date.now() - cached.timestamp < STATS_TTL) && !req.query.force) {
            return res.json(cached.data);
        }

        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const todayISO   = startOfToday.toISOString();
        const tomorrowISO = new Date(startOfToday.getTime() + 86400000).toISOString();

        // ── ALL queries in ONE parallel batch (no sequential await blocks) ──────
        // 11 total queries (was 19). whatsapp_templates/campaigns counts derived from data.
        const [
            { count: totalContacts },
            { count: totalFlows },
            { data: waConfig },
            { data: allLeads },
            { data: pipelines },
            { data: stagesData },
            { data: integrations },
            { data: allTasksData },
            { data: templatesStatusData },
            { data: lastCampaigns },
            { count: totalGroups },
        ] = await Promise.all([
            // Fast COUNT with DB index
            supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('user_id', userId),
            supabase.from('flows').select('*', { count: 'exact', head: true }).eq('user_id', userId),

            // Config — 1 row
            supabase.from('whatsapp_config').select('phone_number, phone_number_id').eq('user_id', userId).limit(1),

            // Leads — ONE query replaces 5 separate lead queries
            supabase.from('leads')
                .select('id, name, created_at, status, pipeline_id, stage_id, estimated_value')
                .eq('user_id', userId)
                .limit(10000),

            // Structure
            supabase.from('pipelines').select('id, name').eq('user_id', userId),
            supabase.from('pipeline_stages').select('id, name, pipeline_id').eq('user_id', userId),

            // Integrations
            supabase.from('user_integrations').select('provider').eq('user_id', userId).limit(200),

            // Tasks (count + due logic from data)
            supabase.from('tasks').select('is_completed, due_date').eq('user_id', userId).limit(5000),

            // Templates: fetch status rows + exact count in one request
            supabase.from('whatsapp_templates')
                .select('status', { count: 'exact' })
                .eq('user_id', userId)
                .limit(2000),

            // Campaigns: fetch rows + exact count in one request
            supabase.from('campaigns')
                .select('id, title, success_count, failed_count', { count: 'exact' })
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(200),

            // Groups count only
            supabase.from('contact_groups').select('*', { count: 'exact', head: true }).eq('user_id', userId),
        ]);

        // Counts derived from already-fetched row data (no extra DB calls)
        // Limits (2000 templates, 200 campaigns) are generous for most users
        const totalTemplates = (templatesStatusData || []).length;
        const totalCampaigns = (lastCampaigns || []).length;



        const allTasks        = allTasksData        || [];
        const templatesStatus = templatesStatusData  || [];
        const integrList      = integrations         || [];
        const campaignRows    = lastCampaigns        || [];


        // Derive recent leads from allLeads (CPU sort — no extra DB query)
        const recentLeads = (allLeads || [])
            .slice()
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 5)
            .map(l => ({ id: l.id, name: l.name, created_at: l.created_at, status: l.status, pipeline_id: l.pipeline_id }));

        // ── CPU aggregations on the single leads array ─────────────────
        const leads = allLeads || [];
        let totalPipelineValue = 0, wonValue = 0, wonCount = 0;
        let activeLeads = 0, newLeadsToday = 0;

        // Build pipeline map from separate pipelines + stages arrays
        const pipelineMap = {};
        (pipelines || []).forEach(p => {
            pipelineMap[p.id] = { id: p.id, name: p.name, stages: [] };
        });
        (stagesData || []).forEach(s => {
            if (pipelineMap[s.pipeline_id]) {
                pipelineMap[s.pipeline_id].stages.push({ id: s.id, name: s.name });
            }
        });
        const pipelineList = Object.values(pipelineMap);
        const totalPipelines = pipelineList.length;

        leads.forEach(l => {
            const val = Number(l.estimated_value) || 0;
            totalPipelineValue += val;
            const isWon = (l.status && l.status.toLowerCase() === 'won') || (l.stage_id && l.stage_id.toLowerCase().includes('won'));
            if (isWon) { wonValue += val; wonCount++; }
            if (l.status === 'active') activeLeads++;
            if (l.created_at >= todayISO && l.created_at < tomorrowISO) newLeadsToday++;
        });

        const revenueStats = {
            totalValue: totalPipelineValue,
            wonValue,
            conversionRate: Math.round((wonCount / Math.max(leads.length, 1)) * 100) + '%'
        };

        // Pipeline breakdown — CPU only, no extra DB hits
        const pipelineStats = pipelineList.map(p => {
            const pLeads = leads.filter(l => l.pipeline_id === p.id);
            return {
                id: p.id, name: p.name, totalLeads: pLeads.length,
                stages: p.stages.map(s => ({
                    name: s.name, count: pLeads.filter(l => l.stage_id === s.id).length
                }))
            };
        });

        // Template stats
        const templateStats = { approved: 0, pending: 0, rejected: 0 };
        templatesStatus.forEach(t => {
            const s = (t.status || '').toUpperCase();
            if      (s === 'APPROVED') templateStats.approved++;
            else if (s === 'REJECTED') templateStats.rejected++;
            else                       templateStats.pending++;
        });

        // Integration stats
        const integrationStats = { total: 0, breakdown: {} };
        integrList.forEach(i => {
            const p = i.provider || 'unknown';
            integrationStats.breakdown[p] = (integrationStats.breakdown[p] || 0) + 1;
            integrationStats.total++;
        });

        // Task stats — CPU aggregation
        let completedTasks = 0, dueTasks = 0, todayTasks = 0;
        allTasks.forEach(t => {
            if (t.is_completed) { completedTasks++; return; }
            dueTasks++;
            if (t.due_date && t.due_date >= todayISO && t.due_date < tomorrowISO) todayTasks++;
        });

        // Campaign stats — use first 5 from the campaignRows (already ordered by created_at desc)
        const campaignStats = campaignRows.slice(0, 5).map(c => ({
            name: c.title,
            sent: (c.success_count || 0) + (c.failed_count || 0),
            delivered: c.success_count || 0,
            read: 0
        }));

        const config = waConfig?.[0];

        const dashboardData = {
            summary: {
                totalContacts: totalContacts || 0,
                activeLeads,
                newLeadsToday,
                pipelineValue: totalPipelineValue,
                totalTemplates: totalTemplates || 0,
                totalCampaigns: totalCampaigns || 0,
                totalFlows: totalFlows || 0,
                totalPipelines,
                totalGroups: totalGroups || 0,
            },
            revenueStats,
            recentLeads,
            templateStats,
            pipelineStats,
            taskStats: {
                today: todayTasks,
                total: completedTasks + dueTasks,
                completed: completedTasks,
                due: dueTasks,
                breakdown: {}
            },
            integrationStats,
            campaignStats,
            // Charts loaded separately by /charts endpoint
            chartData: [],
            leadsChartData: [],
            connection: {
                phone: config?.phone_number || null,
                id: config?.phone_number_id || null,
                quality_rating: 'LOADING',
                messaging_limit: 'CHECKING',
                status: 'LOADING',
                name_status: 'UNKNOWN',
                display_phone_number: null
            }
        };

        // Write to in-memory JSON cache
        global.dashboardCache[userId] = { data: dashboardData, timestamp: Date.now() };
        res.json(dashboardData);

    } catch (error) {
        console.error('Dashboard Stats Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// PHASE 2: CHART DATA — background load after UI is visible
// Cache: 10 minutes
// ============================================================
router.get('/charts', requireAuth, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
        const userId = req.user.id;
        const supabase = supabaseAdmin;

        const cached = global.dashboardChartCache[userId];
        if (cached && (Date.now() - cached.timestamp < CHARTS_TTL) && !req.query.force) {
            return res.json(cached.data);
        }

        const now = new Date();
        const sevenDaysAgo  = new Date(now); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Get conversation IDs first (needed for message filtering)
        const { data: convIds } = await supabase
            .from('conversations').select('id').eq('user_id', userId).limit(2000);
        const cids = (convIds || []).map(c => c.id);

        const [{ data: rawMessages }, { data: rawLeadsHistory }] = await Promise.all([
            cids.length > 0
                ? supabase.from('messages')
                    .select('created_at, status')
                    .eq('direction', 'out')
                    .gte('created_at', sevenDaysAgo.toISOString())
                    .in('conversation_id', cids)
                    .limit(2000)
                : Promise.resolve({ data: [] }),
            supabase.from('leads')
                .select('created_at')
                .eq('user_id', userId)
                .gte('created_at', thirtyDaysAgo.toISOString())
                .limit(5000)
        ]);

        // Build traffic chart (7-day)
        const trafficMap = {};
        for (let i = 6; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const key = d.toLocaleDateString('en-US', { weekday: 'short' });
            trafficMap[key] = { date: key, sent: 0, delivered: 0, read: 0 };
        }
        (rawMessages || []).forEach(msg => {
            const k = new Date(msg.created_at).toLocaleDateString('en-US', { weekday: 'short' });
            if (trafficMap[k]) {
                trafficMap[k].sent++;
                if (['delivered', 'read'].includes((msg.status || '').toLowerCase())) trafficMap[k].delivered++;
                if ((msg.status || '').toLowerCase() === 'read') trafficMap[k].read++;
            }
        });

        // Build leads growth chart (30-day)
        const leadsMap = {};
        for (let i = 29; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const k = d.toISOString().split('T')[0];
            leadsMap[k] = { date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), fullDate: k, count: 0 };
        }
        (rawLeadsHistory || []).forEach(l => {
            const k = new Date(l.created_at).toISOString().split('T')[0];
            if (leadsMap[k]) leadsMap[k].count++;
        });

        const chartData = {
            chartData: Object.values(trafficMap),
            leadsChartData: Object.values(leadsMap)
        };

        global.dashboardChartCache[userId] = { data: chartData, timestamp: Date.now() };
        res.json(chartData);

    } catch (error) {
        console.error('Dashboard Charts Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// PHASE 3: CONNECTION HEALTH — WhatsApp Meta API
// Runs in background after UI is already showing
// Cache: 5 minutes (Meta API is slow)
// ============================================================
router.get('/connections', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;

        const cached = global.connectionCache[userId];
        if (cached && (Date.now() - cached.timestamp < CONN_TTL) && !req.query.force) {
            return res.json(cached.data);
        }

        const supabase = supabaseAdmin;
        const [{ data: waConfigData }, facebookStatus] = await Promise.all([
            supabase.from('whatsapp_config').select('phone_number_id, meta_access_token').eq('user_id', userId).limit(1),
            facebookService.getUserConnectedStatus(userId).catch(() => ({ connected: false }))
        ]);

        const config    = waConfigData?.[0];
        const whatsAppId  = config?.phone_number_id;
        const accessToken = config?.meta_access_token;

        let phoneHealth = {
            quality_rating: 'UNKNOWN', messaging_limit_tier: 'TIER_50',
            status: 'UNKNOWN', name_status: 'UNKNOWN', display_phone_number: null
        };

        if (whatsAppId && accessToken) {
            try {
                const https = require('https');
                const agent = new https.Agent({ keepAlive: true });
                const metaUrl = `https://graph.facebook.com/v21.0/${whatsAppId}?fields=quality_rating,messaging_limit_tier,status,name_status,display_phone_number`;
                const { data: metaRes } = await require('axios').get(metaUrl, {
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                    timeout: 5000,
                    httpsAgent: agent
                });
                if (metaRes) phoneHealth = {
                    quality_rating:      (metaRes.quality_rating      || 'UNKNOWN').toUpperCase(),
                    messaging_limit:     (metaRes.messaging_limit_tier || 'TIER_50').toUpperCase(),
                    status:              (metaRes.status               || 'UNKNOWN').toUpperCase(),
                    name_status:         (metaRes.name_status          || 'UNKNOWN').toUpperCase(),
                    display_phone_number: metaRes.display_phone_number || null
                };
            } catch (e) { /* silent — connection may not be configured */ }
        }

        const data = {
            integrationStats: { facebook: facebookStatus.connected ? 1 : 0 },
            connection: phoneHealth
        };

        global.connectionCache[userId] = { data, timestamp: Date.now() };
        res.json(data);

    } catch (error) {
        console.error('Connection Stats Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// Cache invalidation endpoint — call after mutations
// POST /api/dashboard/invalidate
// ============================================================
router.post('/invalidate', requireAuth, (req, res) => {
    const userId = req.user.id;
    delete global.dashboardCache[userId];
    delete global.dashboardChartCache[userId];
    delete global.connectionCache[userId];
    res.json({ ok: true, message: 'Dashboard cache cleared' });
});

module.exports = router;
