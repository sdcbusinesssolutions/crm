
const express = require('express');
const router = express.Router();
const { getAuthenticatedSupabase, supabaseAdmin } = require('../lib/supabaseClient');
const requireAuth = require('../middleware/requireAuth');

const GRAPH_API_URL = 'https://graph.facebook.com/v25.0';

// ============================================================
// In-memory JSON cache — shared per user, held in-process RAM
// Much faster than re-fetching Supabase on every request
// ============================================================
if (!global.dashboardCache)      global.dashboardCache      = {};
if (!global.dashboardChartCache) global.dashboardChartCache = {};
global.connectionCache = {}; // ALWAYS RESET on reload — ensures stale TIER_50 cache is cleared

const STATS_TTL   = 15 * 60 * 1000; // 15 minutes (was 5) — more visits served from RAM
const CHARTS_TTL  = 30 * 60 * 1000; // 30 minutes (was 10) — chart data changes rarely
const CONN_TTL    = 15 * 60 * 1000; // 15 minutes — limits can change, keep fresh

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
        // 🚀 OPTIMIZATION: Try to use the RPC first to offload the 10,000 leads calculation to Postgres
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_dashboard_stats', { p_user_id: userId });
        const hasRpc = !rpcError && rpcData;

        // Fetch parallel lightweight queries
        const [
            allTasksData,
            allFollowUpsData,
            templatesStatusData,
            integrations,
            lastCampaigns,
            pipelines,
            stagesData,
            allLeadsResponse,
            contactsCountRes,
            flowsCountRes,
            configRes,
            groupsCountRes
        ] = await Promise.all([
            // Tasks (count + due logic from data)
            supabase.from('tasks').select('is_completed, due_date').eq('user_id', userId).limit(5000),
            
            // FollowUps
            (req.user.isStaff && req.user.staffId) 
                ? supabase.from('follow_ups').select('status, scheduled_at').eq('user_id', userId).eq('created_by_staff_id', req.user.staffId).limit(5000)
                : supabase.from('follow_ups').select('status, scheduled_at').eq('user_id', userId).limit(5000),

            // Templates: fetch status rows + exact count in one request
            supabase.from('whatsapp_templates')
                .select('status', { count: 'exact' })
                .eq('user_id', userId)
                .limit(2000),

            // Integrations
            supabase.from('user_integrations').select('provider').eq('user_id', userId).limit(200),

            // Campaigns: fetch rows + exact count in one request
            supabase.from('campaigns')
                .select('id, title, success_count, failed_count', { count: 'exact' })
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(200),

            // Structure
            supabase.from('pipelines').select('id, name').eq('user_id', userId),
            supabase.from('pipeline_stages').select('id, name, pipeline_id').eq('user_id', userId),

            // Leads — Only fetch if the RPC is NOT installed!
            hasRpc 
                ? Promise.resolve({ data: null }) 
                : supabase.from('leads')
                    .select('id, name, created_at, status, pipeline_id, stage_id, estimated_value')
                    .eq('user_id', userId)
                    .limit(10000),
            
            // Counts
            supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('user_id', userId),
            supabase.from('flows').select('*', { count: 'exact', head: true }).eq('user_id', userId),
            supabase.from('whatsapp_config').select('phone_number, phone_number_id').eq('user_id', userId).limit(1),
            supabase.from('contact_groups').select('*', { count: 'exact', head: true }).eq('user_id', userId)
        ]);

        const allLeads = allLeadsResponse?.data;
        const waConfig = configRes?.data;
        const totalContacts = contactsCountRes?.count;
        const totalFlows = flowsCountRes?.count;
        const totalGroups = groupsCountRes?.count;
        const totalPipelines = (pipelines?.data || []).length;

        // Counts derived from already-fetched row data (no extra DB calls)
        // Limits (2000 templates, 200 campaigns) are generous for most users
        const totalTemplates = templatesStatusData?.count || (templatesStatusData?.data || []).length;
        const totalCampaigns = lastCampaigns?.count || (lastCampaigns?.data || []).length;

        const allTasks        = allTasksData?.data        || [];
        const allFollowUps    = allFollowUpsData?.data    || [];
        const templatesStatus = templatesStatusData?.data || [];
        const integrList      = integrations?.data        || [];
        const campaignRows    = lastCampaigns?.data       || [];


        let recentLeads = [];
        let totalPipelineValue = 0, wonValue = 0, wonCount = 0;
        let activeLeads = 0, newLeadsToday = 0;
        let pipelineStats = [];
        let totalLeadsCount = 0;

        if (hasRpc) {
            // ✅ Use ultra-fast Postgres aggregated stats
            const r = rpcData;
            recentLeads = r.recentLeads || [];
            totalPipelineValue = r.summary?.totalPipelineValue || 0;
            wonValue = r.summary?.wonValue || 0;
            wonCount = r.summary?.wonCount || 0;
            activeLeads = r.summary?.activeLeads || 0;
            newLeadsToday = r.summary?.newLeadsToday || 0;
            totalLeadsCount = r.summary?.totalLeads || 0;
            
            // Format pipeline stats to match frontend expected structure
            pipelineStats = (r.pipelineStats || []).map(p => ({
                id: p.pipeline_id,
                name: p.pipeline_name,
                totalLeads: p.total_leads || 0,
                stages: (p.stages || []).map(s => ({
                    name: s.name,
                    count: s.count || 0
                }))
            }));
        } else {
            // ⚠️ FALLBACK: CPU aggregations on the single leads array (old method)
            const leads = allLeads || [];
            totalLeadsCount = leads.length;

            recentLeads = leads
                .slice()
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .slice(0, 5)
                .map(l => ({ id: l.id, name: l.name, created_at: l.created_at, status: l.status, pipeline_id: l.pipeline_id }));

            // Build pipeline map from separate pipelines + stages arrays
            const pipelineMap = {};
            (pipelines?.data || []).forEach(p => {
                pipelineMap[p.id] = { id: p.id, name: p.name, stages: [] };
            });
            (stagesData?.data || []).forEach(s => {
                if (pipelineMap[s.pipeline_id]) {
                    pipelineMap[s.pipeline_id].stages.push({ id: s.id, name: s.name });
                }
            });
            const pipelineList = Object.values(pipelineMap);

            leads.forEach(l => {
                const val = Number(l.estimated_value) || 0;
                totalPipelineValue += val;
                const isWon = (l.status && l.status.toLowerCase() === 'won') || (l.stage_id && l.stage_id.toLowerCase().includes('won'));
                if (isWon) { wonValue += val; wonCount++; }
                if (l.status === 'active') activeLeads++;
                if (l.created_at >= todayISO && l.created_at < tomorrowISO) newLeadsToday++;
            });

            // Pipeline breakdown — CPU only, no extra DB hits
            pipelineStats = pipelineList.map(p => {
                const pLeads = leads.filter(l => l.pipeline_id === p.id);
                return {
                    id: p.id, name: p.name, totalLeads: pLeads.length,
                    stages: p.stages.map(s => ({
                        name: s.name, count: pLeads.filter(l => l.stage_id === s.id).length
                    }))
                };
            });
        }

        const revenueStats = {
            totalValue: totalPipelineValue,
            wonValue,
            conversionRate: Math.round((wonCount / Math.max(totalLeadsCount, 1)) * 100) + '%'
        };

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
        let completedTasks = 0, dueTasks = 0, todayTasks = 0, overdueTasks = 0;
        allTasks.forEach(t => {
            if (t.is_completed) { completedTasks++; return; }
            dueTasks++;
            if (t.due_date) {
                if (t.due_date < todayISO) {
                    overdueTasks++;
                } else if (t.due_date >= todayISO && t.due_date < tomorrowISO) {
                    todayTasks++;
                }
            }
        });

        allFollowUps.forEach(f => {
            if (f.status === 'COMPLETED') { completedTasks++; return; }
            dueTasks++;
            if (f.scheduled_at) {
                if (f.scheduled_at < todayISO) {
                    overdueTasks++;
                } else if (f.scheduled_at >= todayISO && f.scheduled_at < tomorrowISO) {
                    todayTasks++;
                }
            }
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
                overdue: overdueTasks,
                breakdown: {
                    default: {
                        today: todayTasks,
                        overdue: overdueTasks
                    },
                    overdue: {
                        total: overdueTasks
                    }
                }
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
        const [{ data: waConfigData }] = await Promise.all([
            supabase.from('whatsapp_config').select('phone_number_id, whatsapp_business_account_id, meta_access_token').eq('user_id', userId).limit(1)
        ]);

        const config      = waConfigData?.[0];
        const whatsAppId  = config?.phone_number_id;
        const wabaId      = config?.whatsapp_business_account_id;
        const accessToken = config?.meta_access_token;

        let phoneHealth = {
            quality_rating: 'UNKNOWN', messaging_limit: 'UNKNOWN',
            status: 'UNKNOWN', name_status: 'UNKNOWN', display_phone_number: null
        };

        if (whatsAppId && accessToken) {
            try {
                const axios = require('axios');
                const https = require('https');
                const agent = new https.Agent({ keepAlive: true });
                const axiosOpts = { headers: { 'Authorization': `Bearer ${accessToken}` }, timeout: 8000, httpsAgent: agent };

                // Per Meta docs: whatsapp_business_manager_messaging_limit is the correct (non-deprecated) field.
                // messaging_limit_tier is deprecated and returns TIER_50 incorrectly.
                // Use v25.0 as shown in Meta's official example.
                // Reference: https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits
                const metaUrl = `${GRAPH_API_URL}/${whatsAppId}?fields=quality_rating,whatsapp_business_manager_messaging_limit,status,name_status,display_phone_number`;

                let metaRes = await axios.get(metaUrl, axiosOpts).then(r => r.data).catch(async e => {
                    console.warn(`[Dashboard] Meta API failed for ID ${whatsAppId} with new field. Falling back to old field. Error:`, e.response?.data || e.message);
                    
                    const fallbackUrl = `https://graph.facebook.com/v21.0/${whatsAppId}?fields=quality_rating,messaging_limit_tier,status,name_status,display_phone_number`;
                    return await axios.get(fallbackUrl, axiosOpts).then(r => r.data).catch(err => {
                        console.error(`[Dashboard] Meta API fallback failed for ID ${whatsAppId}:`, err.response?.data || err.message);
                        return null;
                    });
                });

                console.log(`[Dashboard] Meta API response for ${whatsAppId}:`, JSON.stringify(metaRes));

                if (metaRes) {
                    // Use new field; if not present (older token permissions), show UNKNOWN — never hardcode TIER_50
                    const limitTier = metaRes.whatsapp_business_manager_messaging_limit || metaRes.messaging_limit_tier || 'UNKNOWN';
                    phoneHealth = {
                        quality_rating:      (metaRes.quality_rating || 'UNKNOWN').toString().toUpperCase(),
                        messaging_limit:     limitTier.toString().toUpperCase(),
                        status:              (metaRes.status || 'UNKNOWN').toString().toUpperCase(),
                        name_status:         (metaRes.name_status || 'UNKNOWN').toString().toUpperCase(),
                        display_phone_number: metaRes.display_phone_number || null
                    };
                }
            } catch (e) {
                console.error(`[Dashboard] Meta API exception for ID ${whatsAppId}:`, e.message);
            }
        }

        const data = {
            integrationStats: { facebook: 0 },
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
