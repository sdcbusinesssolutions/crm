
const express = require('express');
const router = express.Router();
const { getAuthenticatedSupabase, supabaseAdmin } = require('../lib/supabaseClient');
const requireAuth = require('../middleware/requireAuth');
const facebookService = require('../services/FacebookLeadService');

// ============================================================
// PHASE 1: FAST SUMMARY — returns in ~150ms
// Only uses COUNT queries and small SELECTs. NO full row fetches.
// Cache: 5 minutes (300s) — safe for dashboard counters
// ============================================================
router.get('/stats', requireAuth, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    try {
        const userId = req.user.id;
        const supabase = supabaseAdmin;

        // Fast in-memory cache: 5 minutes
        if (!global.dashboardCache) global.dashboardCache = {};
        const cached = global.dashboardCache[userId];
        const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

        if (cached && (Date.now() - cached.timestamp < CACHE_TTL) && !req.query.force) {
            return res.json(cached.data);
        }

        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        // PHASE 1 QUERIES: All COUNT/head=true or tiny selects — no full row scans
        const [
            { count: totalContacts },
            { count: activeLeads },
            { count: newLeadsToday },
            { count: totalTemplates },
            { count: totalCampaigns },
            { count: totalFlows },
            { count: totalPipelines },
            { count: totalGroups },
            { count: completedTasks },
            { count: dueTasks },
            { count: todayTasks },
            { data: waConfig },
            { data: recentLeads },
            { data: pipelines },
            { data: stages },
            { data: integrations },
            // Revenue: fetch ONLY value + status columns (not all columns)
            { data: leadsForRevenue },
            // Template status breakdown - only status column
            { data: templatesStatus },
            // Recent campaigns — tiny limit
            { data: lastCampaigns },
        ] = await Promise.all([
            // Pure COUNT queries — extremely fast with DB index on user_id
            supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('user_id', userId),
            supabase.from('leads').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'active'),
            supabase.from('leads').select('*', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', startOfToday.toISOString()),
            supabase.from('whatsapp_templates').select('*', { count: 'exact', head: true }).eq('user_id', userId),
            supabase.from('campaigns').select('*', { count: 'exact', head: true }).eq('user_id', userId),
            supabase.from('flows').select('*', { count: 'exact', head: true }).eq('user_id', userId),
            supabase.from('pipelines').select('*', { count: 'exact', head: true }).eq('user_id', userId),
            supabase.from('contact_groups').select('*', { count: 'exact', head: true }).eq('user_id', userId),
            supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('is_completed', true),
            supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('is_completed', false),
            supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('is_completed', false).gte('due_date', startOfToday.toISOString()).lte('due_date', new Date(startOfToday.getTime() + 86400000).toISOString()),
            // Small selects — bounded by one record
            supabase.from('whatsapp_config').select('phone_number, phone_number_id').eq('user_id', userId).limit(1),
            supabase.from('leads').select('id, name, created_at, status, pipeline_id').eq('user_id', userId).order('created_at', { ascending: false }).limit(5),
            supabase.from('pipelines').select('id, name').eq('user_id', userId).order('created_at', { ascending: false }),
            supabase.from('pipeline_stages').select('id, name, pipeline_id').eq('user_id', userId),
            supabase.from('user_integrations').select('provider').eq('user_id', userId),
            // Revenue: only 2 columns (not all) — still needs rows but much lighter
            supabase.from('leads').select('estimated_value, status, stage_id, pipeline_id').eq('user_id', userId).limit(5000),
            // Template status: only 1 column
            supabase.from('whatsapp_templates').select('status').eq('user_id', userId).limit(1000),
            // Last 5 campaigns
            supabase.from('campaigns').select('id, title, success_count, failed_count').eq('user_id', userId).order('created_at', { ascending: false }).limit(5),
        ]);

        // --- CPU Aggregations ---

        // Revenue
        const leadsList = leadsForRevenue || [];
        let totalPipelineValue = 0, wonValue = 0, wonCount = 0;
        leadsList.forEach(l => {
            const val = Number(l.estimated_value) || 0;
            totalPipelineValue += val;
            const isWon = (l.status && l.status.toLowerCase() === 'won') || (l.stage_id && l.stage_id.toLowerCase().includes('won'));
            if (isWon) { wonValue += val; wonCount++; }
        });
        const revenueStats = {
            totalValue: totalPipelineValue,
            wonValue,
            conversionRate: Math.round((wonCount / Math.max(leadsList.length, 1)) * 100) + '%'
        };

        // Pipeline breakdown using already-fetched leads
        const pipelineStats = (pipelines || []).map(p => {
            const pLeads = leadsList.filter(l => l.pipeline_id === p.id);
            return {
                id: p.id, name: p.name, totalLeads: pLeads.length,
                stages: (stages || []).filter(s => s.pipeline_id === p.id).map(s => ({
                    name: s.name, count: pLeads.filter(l => l.stage_id === s.id).length
                }))
            };
        });

        // Template stats
        const templateStats = { approved: 0, pending: 0, rejected: 0 };
        (templatesStatus || []).forEach(t => {
            const s = (t.status || '').toUpperCase();
            if (s === 'APPROVED') templateStats.approved++;
            else if (s === 'REJECTED') templateStats.rejected++;
            else templateStats.pending++;
        });

        // Integration stats
        const integrationStats = { total: 0, breakdown: {} };
        (integrations || []).forEach(i => {
            const p = i.provider || 'unknown';
            integrationStats.breakdown[p] = (integrationStats.breakdown[p] || 0) + 1;
            integrationStats.total++;
        });

        // Campaign stats
        const campaignStats = (lastCampaigns || []).map(c => ({
            name: c.title,
            sent: (c.success_count || 0) + (c.failed_count || 0),
            delivered: c.success_count || 0,
            read: 0
        }));

        // Config
        const config = waConfig?.[0];

        const dashboardData = {
            summary: {
                totalContacts: totalContacts || 0,
                activeLeads: activeLeads || 0,
                newLeadsToday: newLeadsToday || 0,
                pipelineValue: totalPipelineValue || 0,
                totalTemplates: totalTemplates || 0,
                totalCampaigns: totalCampaigns || 0,
                totalFlows: totalFlows || 0,
                totalPipelines: totalPipelines || 0,
                totalGroups: totalGroups || 0
            },
            revenueStats,
            recentLeads: recentLeads || [],
            templateStats,
            pipelineStats,
            taskStats: {
                today: todayTasks || 0,
                total: (completedTasks || 0) + (dueTasks || 0),
                completed: completedTasks || 0,
                due: dueTasks || 0,
                breakdown: {}
            },
            integrationStats,
            campaignStats,
            // Chart data stubbed — loaded by /charts endpoint separately
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

        global.dashboardCache[userId] = { data: dashboardData, timestamp: Date.now() };
        res.json(dashboardData);

    } catch (error) {
        console.error('Dashboard Stats Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// PHASE 2: CHART DATA — loads in background after main stats
// Heavier queries — runs after UI is already showing data
// Cache: 10 minutes
// ============================================================
router.get('/charts', requireAuth, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    try {
        const userId = req.user.id;
        const supabase = supabaseAdmin;

        if (!global.dashboardChartCache) global.dashboardChartCache = {};
        const cached = global.dashboardChartCache[userId];
        const CACHE_TTL = 10 * 60 * 1000; // 10 minutes — charts don't need to be real-time

        if (cached && (Date.now() - cached.timestamp < CACHE_TTL) && !req.query.force) {
            return res.json(cached.data);
        }

        const now = new Date();
        const sevenDaysAgo = new Date(now); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Get conversation IDs for this user first (needed for message filtering)
        const { data: convIds } = await supabase
            .from('conversations').select('id').eq('user_id', userId);
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

        // Build traffic chart
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

        // Build leads growth chart
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
// Cache: 5 minutes (Meta API is slow)
// ============================================================
router.get('/connections', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;

        if (!global.connectionCache) global.connectionCache = {};
        const cached = global.connectionCache[userId];
        if (cached && (Date.now() - cached.timestamp < 300000) && !req.query.force) {
            return res.json(cached.data);
        }

        const supabase = supabaseAdmin;
        const [{ data: waConfigData }, facebookStatus] = await Promise.all([
            supabase.from('whatsapp_config').select('phone_number_id, meta_access_token').eq('user_id', userId).limit(1),
            facebookService.getUserConnectedStatus(userId).catch(() => ({ connected: false }))
        ]);

        const config = waConfigData?.[0];
        const whatsAppId = config?.phone_number_id;
        const accessToken = config?.meta_access_token;

        let phoneHealth = { quality_rating: 'UNKNOWN', messaging_limit_tier: 'TIER_50', status: 'UNKNOWN', name_status: 'UNKNOWN', display_phone_number: null };

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
                    quality_rating: (metaRes.quality_rating || 'UNKNOWN').toUpperCase(),
                    messaging_limit: (metaRes.messaging_limit_tier || 'TIER_50').toUpperCase(),
                    status: (metaRes.status || 'UNKNOWN').toUpperCase(),
                    name_status: (metaRes.name_status || 'UNKNOWN').toUpperCase(),
                    display_phone_number: metaRes.display_phone_number || null
                };
            } catch (e) { /* silent */ }
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

module.exports = router;
