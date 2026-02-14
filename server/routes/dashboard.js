
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

router.get('/stats', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;

        // --- 0. Check Cache (1 minute TTL) ---
        if (!global.dashboardCache) global.dashboardCache = {};

        // Check if we have a valid cache
        // We can add a query param ?force=true to bypass cache if needed
        const cached = global.dashboardCache[userId];
        const cacheTTL = 60 * 1000; // 60 seconds

        if (cached && (Date.now() - cached.timestamp < cacheTTL) && !req.query.force) {
            return res.json(cached.data);
        }

        // Use Admin to bypass row limits
        const supabase = supabaseAdmin;

        // 1. Fetch Counts (Parallel for performance)
        const [
            { count: totalContactsCount },
            { count: totalLeads },
            { count: todayLeads },
            // Consolidated: Query 4 & 14 combined - Fetch minimal necessary fields for ALL active leads logic
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
            facebookStatusRes,
            { data: integrationsRes }
        ] = await Promise.all([
            // Total Contacts
            supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('user_id', userId),

            // Total Active Leads
            supabase.from('leads').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'active'),

            // Leads Created Today
            supabase.from('leads').select('*', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', getStartDate('today')),

            // [OPTIMIZED] All Leads Data for Aggregation (Revenue + Pipeline Stats + Conversion)
            supabase.from('leads')
                .select('id, pipeline_id, stage_id, estimated_value, status')
                .eq('user_id', userId),

            // Recent Leads/Activity
            supabase.from('leads').select('id, name, created_at, status, pipeline_id').eq('user_id', userId).order('created_at', { ascending: false }).limit(5),

            // Counts
            supabase.from('whatsapp_templates').select('*', { count: 'exact', head: true }).eq('user_id', userId),
            supabase.from('campaigns').select('*', { count: 'exact', head: true }).eq('user_id', userId),
            supabase.from('flows').select('*', { count: 'exact', head: true }).eq('user_id', userId),

            // Config
            supabase.from('whatsapp_config').select('phone_number, phone_number_id, meta_access_token').eq('user_id', userId).limit(1),

            // More Counts
            supabase.from('pipelines').select('*', { count: 'exact', head: true }).eq('user_id', userId),
            supabase.from('contact_groups').select('*', { count: 'exact', head: true }).eq('user_id', userId),

            // Reference Data
            supabase.from('pipelines').select('id, name').eq('user_id', userId).order('created_at', { ascending: false }),
            supabase.from('pipeline_stages').select('id, name, pipeline_id').eq('user_id', userId),

            // Tasks
            supabase.from('tasks').select('id, is_completed, due_date, lead_id, leads(pipeline_id)').eq('user_id', userId),

            // External Services
            facebookService.getUserConnectedStatus(userId).catch(() => ({ connected: false })),
            supabase.from('user_integrations').select('provider').eq('user_id', userId)
        ]);

        if (errLeads) console.error('Error fetching leads:', errLeads);

        // --- PROCESS INTEGRATION STATS ---
        const integrationStats = {
            total: 0,
            breakdown: {}
        };
        const facebookStatus = facebookStatusRes || { connected: false };
        if (facebookStatus.connected) {
            integrationStats.breakdown['facebook'] = 1;
            integrationStats.total++;
        }
        (integrationsRes || []).forEach(i => {
            const p = i.provider || 'unknown';
            integrationStats.breakdown[p] = (integrationStats.breakdown[p] || 0) + 1;
            integrationStats.total++;
        });

        // --- PHONE HEALTH (OPTIMIZED) ---
        const config = waConfigData?.[0];
        const whatsAppPhone = config?.phone_number || null;
        const whatsAppId = config?.phone_number_id || null;
        const accessToken = config?.meta_access_token || null;

        let phoneHealth = {
            quality_rating: 'UNKNOWN',
            messaging_limit_tier: 'TIER_50',
            status: 'UNKNOWN',
            name_status: 'UNKNOWN',
            display_phone_number: null
        };

        if (whatsAppId && accessToken) {
            // Check Meta Health Cache (5 minute TTL)
            if (!global.metaHealthCache) global.metaHealthCache = {};
            const metaCached = global.metaHealthCache[whatsAppId];
            const metaTTL = 5 * 60 * 1000;

            if (metaCached && (Date.now() - metaCached.timestamp < metaTTL)) {
                phoneHealth = metaCached.data;
            } else {
                try {
                    const metaUrl = `https://graph.facebook.com/v21.0/${whatsAppId}?fields=quality_rating,messaging_limit_tier,status,name_status,display_phone_number`;
                    // 2s timeout to prevent locking the dashboard
                    const { data: metaRes } = await require('axios').get(metaUrl, {
                        headers: { 'Authorization': `Bearer ${accessToken}` },
                        timeout: 1000
                    });

                    if (metaRes) {
                        phoneHealth = {
                            quality_rating: metaRes.quality_rating || 'UNKNOWN',
                            messaging_limit_tier: metaRes.messaging_limit_tier || 'TIER_50',
                            status: metaRes.status || 'UNKNOWN',
                            name_status: metaRes.name_status || 'UNKNOWN',
                            display_phone_number: metaRes.display_phone_number || null
                        };
                        // Cache it
                        global.metaHealthCache[whatsAppId] = {
                            data: phoneHealth,
                            timestamp: Date.now()
                        };
                    }
                } catch (metaErr) {
                    // console.error('Meta Health Check Failed (Non-blocking):', metaErr.message);
                    // Keep defaults
                }
            }
        }

        // 2. Calculate Revenue Stats (Total, Won, Conversion)
        const leadsList = allLeadsRaw || [];

        // Aggregations
        let totalPipelineValue = 0;
        let wonValue = 0;
        let wonCount = 0;

        leadsList.forEach(l => {
            const val = Number(l.estimated_value) || 0;
            totalPipelineValue += val;

            const isWon = (l.status && l.status.toLowerCase() === 'won') ||
                (l.stage_id && (l.stage_id.toLowerCase().includes('won') ||
                    // Optional: check mapped stage names if needed, for now mostly string match on ID or status
                    false));

            if (isWon) {
                wonValue += val;
                wonCount++;
            }
        });

        const totalLeadsCount = Math.max(leadsList.length, 1);
        const conversionRate = Math.round((wonCount / totalLeadsCount) * 100) + '%';

        const revenueStats = {
            totalValue: totalPipelineValue,
            wonValue: wonValue,
            conversionRate: conversionRate
        };

        // 3. Real Message Traffic Data (Last 7 Days)
        // Note: We might want to optimize this query too if messages table is huge. 
        // For now, kept as is but ensure index exists (created in SQL).
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const { data: rawMessages } = await supabase
            .from('messages')
            .select('created_at, status, direction, conversations!inner(user_id)')
            .eq('conversations.user_id', userId)
            .eq('direction', 'out')
            .gte('created_at', sevenDaysAgo.toISOString());

        // Aggregate messages by day
        const trafficMap = {};
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key = d.toLocaleDateString('en-US', { weekday: 'short' });
            trafficMap[key] = { date: key, sent: 0, delivered: 0, read: 0 };
        }

        (rawMessages || []).forEach(msg => {
            const dateKey = new Date(msg.created_at).toLocaleDateString('en-US', { weekday: 'short' });
            if (trafficMap[dateKey]) {
                trafficMap[dateKey].sent++;
                const status = (msg.status || '').toLowerCase();
                if (['delivered', 'read'].includes(status)) trafficMap[dateKey].delivered++;
                if (status === 'read') trafficMap[dateKey].read++;
            }
        });
        const trafficData = Object.values(trafficMap);

        // 3b. Leads Growth (Last 30 Days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: rawLeadsHistory } = await supabase
            .from('leads')
            .select('created_at')
            .eq('user_id', userId)
            .gte('created_at', thirtyDaysAgo.toISOString());

        // Aggregate leads
        const leadsMap = {};
        for (let i = 29; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key = d.toISOString().split('T')[0];
            const displayKey = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            leadsMap[key] = { date: displayKey, fullDate: key, count: 0 };
        }

        (rawLeadsHistory || []).forEach(l => {
            const dateKey = new Date(l.created_at).toISOString().split('T')[0];
            if (leadsMap[dateKey]) {
                leadsMap[dateKey].count++;
            }
        });
        const leadsChartData = Object.values(leadsMap);


        // 4. Real Campaign Performance
        const { data: lastCampaigns } = await supabase
            .from('campaigns')
            .select('id, title, success_count, failed_count')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(5);

        let campaignStats = [];
        if (lastCampaigns && lastCampaigns.length > 0) {
            campaignStats = lastCampaigns.map(c => ({
                name: c.title,
                sent: (c.success_count || 0) + (c.failed_count || 0),
                delivered: c.success_count || 0,
                read: 0 // Simplification as queue check is expensive
            }));
        }

        // 5. Template Stats
        const { data: templatesRaw } = await supabase
            .from('whatsapp_templates')
            .select('status')
            .eq('user_id', userId);

        const templateStats = { approved: 0, pending: 0, rejected: 0 };
        (templatesRaw || []).forEach(t => {
            const s = (t.status || '').toUpperCase();
            if (s === 'APPROVED') templateStats.approved++;
            else if (s === 'REJECTED') templateStats.rejected++;
            else templateStats.pending++;
        });

        // --- PROCESS PIPELINE STATS (Using Same Leads List) ---
        let pipelineStats = [];
        if (detailedPipelines && detailedPipelines.length > 0) {
            pipelineStats = detailedPipelines.map(p => {
                const pStages = (detailedStages || []).filter(s => s.pipeline_id === p.id);
                // Filter leadsList (which we already fetched)
                const pLeads = leadsList.filter(l => l.pipeline_id === p.id);

                const stageBreakdown = pStages.map(s => {
                    const count = pLeads.filter(l => l.stage_id === s.id).length;
                    return { name: s.name, count };
                });

                return {
                    id: p.id,
                    name: p.name,
                    totalLeads: pLeads.length,
                    stages: stageBreakdown
                };
            });
        }

        // --- PROCESS TASK STATS ---
        const taskStats = {
            today: 0,
            total: (taskData || []).length,
            completed: 0,
            due: 0,
            breakdown: {}
        };

        const now = new Date();
        const startOfToday = new Date(now.setHours(0, 0, 0, 0));
        const endOfToday = new Date(now.setHours(23, 59, 59, 999));

        (taskData || []).forEach(t => {
            const isCompleted = t.is_completed;
            const dueDate = t.due_date ? new Date(t.due_date) : null;
            const pipelineId = t.leads?.pipeline_id;

            if (pipelineId && !taskStats.breakdown[pipelineId]) {
                const pipeName = (detailedPipelines || []).find(p => p.id === pipelineId)?.name || 'Unknown Pipeline';
                taskStats.breakdown[pipelineId] = { id: pipelineId, name: pipeName, today: 0, overdue: 0, total: 0 };
            }

            if (isCompleted) {
                taskStats.completed++;
            } else {
                taskStats.due++;
                if (pipelineId && taskStats.breakdown[pipelineId]) taskStats.breakdown[pipelineId].total++;
                if (dueDate) {
                    if (dueDate >= startOfToday && dueDate <= endOfToday) {
                        taskStats.today++;
                        if (pipelineId && taskStats.breakdown[pipelineId]) taskStats.breakdown[pipelineId].today++;
                    }
                    else if (dueDate < startOfToday) {
                        if (pipelineId && taskStats.breakdown[pipelineId]) taskStats.breakdown[pipelineId].overdue++;
                    }
                }
            }
        });

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
            chartData: trafficData,
            leadsChartData,
            campaignStats,
            templateStats,
            pipelineStats,
            taskStats,
            integrationStats,
            connection: {
                phone: whatsAppPhone,
                id: whatsAppId,
                quality_rating: phoneHealth.quality_rating,
                messaging_limit: phoneHealth.messaging_limit_tier,
                status: phoneHealth.status,
                name_status: phoneHealth.name_status,
                display_phone_number: phoneHealth.display_phone_number
            }
        };

        // Cache the result
        global.dashboardCache[userId] = {
            data: dashboardData,
            timestamp: Date.now()
        };

        res.json(dashboardData);

    } catch (error) {
        console.error('Dashboard Stats Error:', error);
        res.status(500).json({ error: error.message });
    }
});



module.exports = router;
