
const express = require('express');
const router = express.Router();
const { getAuthenticatedSupabase, supabaseAdmin } = require('../lib/supabaseClient');
const requireAuth = require('../middleware/requireAuth');
const facebookService = require('../services/FacebookLeadService');

// Helper to get start of day/week/month
const getStartDate = (period) => {
    const now = new Date();
    if (period === 'today') return new Date(now.setHours(0, 0, 0, 0)).toISOString();
    if (period === 'week') {
        const d = new Date(now);
        const day = d.getDay(), diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff)).toISOString();
    }
    return new Date(0).toISOString();
};

// 1. MAIN STATS (DB Only - Fast <300ms)
router.get('/stats', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;

        // --- 0. Check Cache (30s TTL for real-time feel) ---
        if (!global.dashboardCache) global.dashboardCache = {};
        const cached = global.dashboardCache[userId];
        const cacheTTL = 30 * 1000;

        if (cached && (Date.now() - cached.timestamp < cacheTTL) && !req.query.force) {
            return res.json(cached.data);
        }

        const supabase = supabaseAdmin;

        // 1. Fetch ALL DB Counts (Parallel)
        const [
            { count: totalContactsCount },
            { count: totalLeads },
            { count: todayLeads },
            { data: allLeadsRaw, error: errLeads },
            { data: recentLeads },
            { count: totalTemplates },
            { count: totalCampaigns },
            { count: totalFlows },
            { data: waConfigData },
            { count: totalPipelines },
            { count: totalGroups },
            { data: detailedPipelines },
            { data: detailedStages },
            { data: taskData },
            // Removed External Service Calls from here
            { data: integrationsRes }
        ] = await Promise.all([
            supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('user_id', userId),
            supabase.from('leads').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'active'),
            supabase.from('leads').select('*', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', getStartDate('today')),
            supabase.from('leads').select('id, pipeline_id, stage_id, estimated_value, status').eq('user_id', userId),
            supabase.from('leads').select('id, name, created_at, status, pipeline_id').eq('user_id', userId).order('created_at', { ascending: false }).limit(5),
            supabase.from('whatsapp_templates').select('*', { count: 'exact', head: true }).eq('user_id', userId),
            supabase.from('campaigns').select('*', { count: 'exact', head: true }).eq('user_id', userId),
            supabase.from('flows').select('*', { count: 'exact', head: true }).eq('user_id', userId),
            supabase.from('whatsapp_config').select('phone_number, phone_number_id').eq('user_id', userId).limit(1), // Removed token fetch to save bandwidth
            supabase.from('pipelines').select('*', { count: 'exact', head: true }).eq('user_id', userId),
            supabase.from('contact_groups').select('*', { count: 'exact', head: true }).eq('user_id', userId),
            supabase.from('pipelines').select('id, name').eq('user_id', userId).order('created_at', { ascending: false }),
            supabase.from('pipeline_stages').select('id, name, pipeline_id').eq('user_id', userId),
            supabase.from('tasks').select('id, is_completed, due_date, lead_id, leads(pipeline_id)').eq('user_id', userId),
            supabase.from('user_integrations').select('provider').eq('user_id', userId)
        ]);

        if (errLeads) console.error('Error fetching leads:', errLeads);

        // --- Aggregations (CPU Bound - Fast) ---

        // Integrations (DB only)
        const integrationStats = { total: 0, breakdown: {} };
        (integrationsRes || []).forEach(i => {
            const p = i.provider || 'unknown';
            integrationStats.breakdown[p] = (integrationStats.breakdown[p] || 0) + 1;
            integrationStats.total++;
        });

        // Revenue Stats
        const leadsList = allLeadsRaw || [];
        let totalPipelineValue = 0, wonValue = 0, wonCount = 0;
        leadsList.forEach(l => {
            const val = Number(l.estimated_value) || 0;
            totalPipelineValue += val;
            const isWon = (l.status && l.status.toLowerCase() === 'won') ||
                (l.stage_id && l.stage_id.toLowerCase().includes('won'));
            if (isWon) { wonValue += val; wonCount++; }
        });
        const conversionRate = Math.round((wonCount / Math.max(leadsList.length, 1)) * 100) + '%';
        const revenueStats = { totalValue: totalPipelineValue, wonValue, conversionRate };

        // Traffic Data (7 Days)
        const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const { data: rawMessages } = await supabase.from('messages')
            .select('created_at, status, direction, conversations!inner(user_id)')
            .eq('conversations.user_id', userId).eq('direction', 'out')
            .gte('created_at', sevenDaysAgo.toISOString());

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

        // Leads Growth (30 Days)
        const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const { data: rawLeadsHistory } = await supabase.from('leads')
            .select('created_at').eq('user_id', userId).gte('created_at', thirtyDaysAgo.toISOString());

        const leadsMap = {};
        for (let i = 29; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const k = d.toISOString().split('T')[0];
            leadsMap[k] = {
                date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                fullDate: k,
                count: 0
            };
        }
        (rawLeadsHistory || []).forEach(l => {
            const k = new Date(l.created_at).toISOString().split('T')[0];
            if (leadsMap[k]) leadsMap[k].count++;
        });

        // Campaign Stats
        const { data: lastCampaigns } = await supabase.from('campaigns')
            .select('id, title, success_count, failed_count').eq('user_id', userId)
            .order('created_at', { ascending: false }).limit(5);
        const campaignStats = (lastCampaigns || []).map(c => ({
            name: c.title,
            sent: (c.success_count || 0) + (c.failed_count || 0),
            delivered: c.success_count || 0,
            read: 0
        }));

        // Template Stats
        const { data: templatesRaw } = await supabase.from('whatsapp_templates').select('status').eq('user_id', userId);
        const templateStats = { approved: 0, pending: 0, rejected: 0 };
        (templatesRaw || []).forEach(t => {
            const s = (t.status || '').toUpperCase();
            if (s === 'APPROVED') templateStats.approved++; else if (s === 'REJECTED') templateStats.rejected++; else templateStats.pending++;
        });

        // Pipeline Stats
        let pipelineStats = [];
        if (detailedPipelines) {
            pipelineStats = detailedPipelines.map(p => {
                const pLeads = leadsList.filter(l => l.pipeline_id === p.id);
                return {
                    id: p.id, name: p.name, totalLeads: pLeads.length,
                    stages: (detailedStages || []).filter(s => s.pipeline_id === p.id).map(s => ({
                        name: s.name, count: pLeads.filter(l => l.stage_id === s.id).length
                    }))
                };
            });
        }

        // Task Stats
        const taskStats = { today: 0, total: (taskData || []).length, completed: 0, due: 0, breakdown: {} };
        const now = new Date(), startToday = new Date(now.setHours(0, 0, 0, 0)), endToday = new Date(now.setHours(23, 59, 59, 999));
        (taskData || []).forEach(t => {
            const pid = t.leads?.pipeline_id;
            if (pid && !taskStats.breakdown[pid]) {
                taskStats.breakdown[pid] = { id: pid, name: detailedPipelines?.find(p => p.id === pid)?.name || 'Unknown', today: 0, overdue: 0, total: 0 };
            }
            if (t.is_completed) taskStats.completed++;
            else {
                taskStats.due++;
                if (pid && taskStats.breakdown[pid]) taskStats.breakdown[pid].total++;
                if (t.due_date) {
                    const dd = new Date(t.due_date);
                    if (dd >= startToday && dd <= endToday) {
                        taskStats.today++;
                        if (pid && taskStats.breakdown[pid]) taskStats.breakdown[pid].today++;
                    } else if (dd < startToday) {
                        if (pid && taskStats.breakdown[pid]) taskStats.breakdown[pid].overdue++;
                    }
                }
            }
        });

        // Config Data (Partial)
        const config = waConfigData?.[0];

        const dashboardData = {
            summary: {
                totalContacts: totalContactsCount || 0,
                activeLeads: totalLeads || 0,
                newLeadsToday: todayLeads || 0,
                pipelineValue: totalPipelineValue || 0,
                totalTemplates: totalTemplates || 0,
                totalCampaigns: totalCampaigns || 0,
                totalFlows: totalFlows || 0,
                totalPipelines: totalPipelines || 0,
                totalGroups: totalGroups || 0
            },
            revenueStats,
            recentLeads: recentLeads || [],
            chartData: Object.values(trafficMap),
            leadsChartData: Object.values(leadsMap),
            campaignStats,
            templateStats,
            pipelineStats,
            taskStats,
            integrationStats,
            connection: {
                // Return Basic DB info only - FAST
                phone: config?.phone_number || null,
                id: config?.phone_number_id || null,
                quality_rating: 'LOADING', // Frontend will fetch real status
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

// 2. CONNECTIONS HEALTH (External APIs - Slower ~1s)
router.get('/connections', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;

        // Check Cache (5 min TTL)
        if (!global.connectionCache) global.connectionCache = {};
        const cached = global.connectionCache[userId];
        if (cached && (Date.now() - cached.timestamp < 300000) && !req.query.force) {
            return res.json(cached.data);
        }

        const supabase = supabaseAdmin;

        // Fetch Config & Facebook Status
        const [{ data: waConfigData }, facebookStatus] = await Promise.all([
            supabase.from('whatsapp_config').select('phone_number_id, meta_access_token').eq('user_id', userId).limit(1),
            facebookService.getUserConnectedStatus(userId).catch(() => ({ connected: false }))
        ]);

        const config = waConfigData?.[0];
        const whatsAppId = config?.phone_number_id;
        const accessToken = config?.meta_access_token;

        let phoneHealth = { quality_rating: 'UNKNOWN', messaging_limit_tier: 'TIER_50', status: 'UNKNOWN', name_status: 'UNKNOWN', display_phone_number: null };

        // Real-time Meta Check (The slow part)
        if (whatsAppId && accessToken) {
            try {
                const metaUrl = `https://graph.facebook.com/v21.0/${whatsAppId}?fields=quality_rating,messaging_limit_tier,status,name_status,display_phone_number`;
                const { data: metaRes } = await require('axios').get(metaUrl, {
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                    timeout: 2500
                });
                if (metaRes) phoneHealth = {
                    quality_rating: (metaRes.quality_rating || 'UNKNOWN').toUpperCase(),
                    messaging_limit: (metaRes.messaging_limit_tier || 'TIER_50').toUpperCase(),
                    status: (metaRes.status || 'UNKNOWN').toUpperCase(),
                    name_status: (metaRes.name_status || 'UNKNOWN').toUpperCase(),
                    display_phone_number: metaRes.display_phone_number || null
                };
            } catch (e) {
                // console.error('Meta Check Failed', e.message);
            }
        }

        const data = {
            integrationStats: {
                facebook: facebookStatus.connected ? 1 : 0
            },
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
