
const express = require('express');
const router = express.Router();
const { getAuthenticatedSupabase } = require('../lib/supabaseClient');
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
        const supabase = getAuthenticatedSupabase(req);
        const userId = req.user.id;

        // 1. Fetch Counts (Parallel for performance)
        const [
            { count: totalContacts, error: err1 },
            { count: totalLeads, error: err2 },
            { count: todayLeads, error: err3 },
            { data: pipelineData, error: err4 },
            { data: recentLeads, error: err5 },
            { count: totalTemplates, error: err6 },
            { count: totalCampaigns, error: err7 },
            { count: totalFlows, error: err8 },
            { data: waConfigData, error: err9 },
            { count: totalPipelines, error: err10 },
            { count: totalGroups, error: err11 },
            { data: detailedPipelines, error: err12 },
            { data: detailedStages, error: err13 },
            { data: allLeadsAggregation, error: err14 },
            { data: taskData, error: err15 },
            facebookStatusRes,
            { data: integrationsRes, error: err17 }
        ] = await Promise.all([
            // Total Contacts
            supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('user_id', userId),

            // Total Active Leads
            supabase.from('leads').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'active'),

            // Leads Created Today
            supabase.from('leads')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId)
                .gte('created_at', getStartDate('today')),

            // Pipeline Stage Distribution
            supabase.from('leads')
                .select('stage_id, estimated_value')
                .eq('user_id', userId),

            // Recent Leads/Activity
            supabase.from('leads')
                .select('id, name, created_at, status, pipeline_id')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(5),

            // ... (existing queries)
            supabase.from('whatsapp_templates').select('*', { count: 'exact', head: true }).eq('user_id', userId),

            // Total Campaigns
            supabase.from('campaigns').select('*', { count: 'exact', head: true }).eq('user_id', userId),

            // Total Flows
            supabase.from('flows').select('*', { count: 'exact', head: true }).eq('user_id', userId),

            // WhatsApp Config
            supabase.from('whatsapp_config').select('phone_number, phone_number_id, meta_access_token').eq('user_id', userId).limit(1),

            // Total Pipelines Count
            supabase.from('pipelines').select('*', { count: 'exact', head: true }).eq('user_id', userId),

            // Total Groups
            supabase.from('contact_groups').select('*', { count: 'exact', head: true }).eq('user_id', userId),

            // [NEW] 12. Detailed Pipelines
            supabase.from('pipelines').select('id, name').eq('user_id', userId).order('created_at', { ascending: false }),

            // [NEW] 13. All Stages
            supabase.from('pipeline_stages').select('id, name, pipeline_id').eq('user_id', userId),

            // [NEW] 14. All Leads (Lightweight) for aggregation
            supabase.from('leads').select('id, pipeline_id, stage_id').eq('user_id', userId),

            // [NEW] 15. Tasks Stats with Pipeline Link
            supabase.from('tasks').select('id, is_completed, due_date, lead_id, leads(pipeline_id)').eq('user_id', userId),

            // [NEW] 16. Facebook Status (Service call, might be fast or slow, careful)
            facebookService.getUserConnectedStatus(userId).catch(() => ({ connected: false })),

            // [NEW] 17. User Integrations (Google, etc.)
            supabase.from('user_integrations').select('provider').eq('user_id', userId)
        ]);

        if (err1 || err2 || err3 || err4 || err5 || err6 || err7 || err8 || err9 || err10) {
            console.error('Error fetching dashboard stats', { err1, err2, err3, err4, err5, err6, err7, err8, err9, err10 });
        }

        const facebookStatus = facebookStatusRes || { connected: false };
        const integrations = integrationsRes || [];

        // --- PROCESS INTEGRATION STATS ---
        const integrationStats = {
            total: 0,
            breakdown: {}
        };

        // Facebook
        if (facebookStatusRes && facebookStatusRes.connected) {
            integrationStats.breakdown['facebook'] = 1;
            integrationStats.total++;
        }

        // Other Integrations form DB
        if (integrationsRes) {
            integrationsRes.forEach(i => {
                const p = i.provider || 'unknown';
                integrationStats.breakdown[p] = (integrationStats.breakdown[p] || 0) + 1;
                integrationStats.total++;
            });
        }

        // Extract Phone Number & Config
        const config = waConfigData?.[0];
        const whatsAppPhone = config?.phone_number || null;
        const whatsAppId = config?.phone_number_id || null;
        const accessToken = config?.meta_access_token || null;

        // Fetch Real-time Phone Health from Meta
        let phoneHealth = {
            quality_rating: 'UNKNOWN',
            messaging_limit_tier: 'TIER_50',
            status: 'UNKNOWN',
            name_status: 'UNKNOWN',
            display_phone_number: null
        };

        if (whatsAppId && accessToken) {
            try {
                const metaUrl = `https://graph.facebook.com/v21.0/${whatsAppId}?fields=quality_rating,messaging_limit_tier,status,name_status,display_phone_number`;
                const { data: metaRes } = await require('axios').get(metaUrl, {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });

                if (metaRes) {
                    phoneHealth = {
                        quality_rating: metaRes.quality_rating || 'UNKNOWN',
                        messaging_limit_tier: metaRes.messaging_limit_tier || 'TIER_50',
                        status: metaRes.status || 'UNKNOWN',
                        name_status: metaRes.name_status || 'UNKNOWN',
                        display_phone_number: metaRes.display_phone_number || null
                    };
                }
            } catch (metaErr) {
                console.error('Failed to fetch phone health from Meta:', metaErr.message);
                // Fallback to default/unknown is already set
            }
        }

        // 2. Calculate Pipeline Value
        const totalPipelineValue = (pipelineData || []).reduce((sum, lead) => sum + (Number(lead.estimated_value) || 0), 0);

        // 3. Real Message Traffic Data (Last 7 Days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const { data: rawMessages, error: msgError } = await supabase
            .from('messages')
            .select('created_at, status, direction, conversations!inner(user_id)')
            .eq('conversations.user_id', userId)
            .eq('direction', 'out')
            .gte('created_at', sevenDaysAgo.toISOString());

        if (msgError) console.error('Error fetching messages stats:', msgError);

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

        // 3b. Real Leads Growth Data (Last 30 Days) - Requested Feature
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: rawLeadsHistory, error: leadHistError } = await supabase
            .from('leads')
            .select('created_at')
            .eq('user_id', userId)
            .gte('created_at', thirtyDaysAgo.toISOString());

        if (leadHistError) console.error('Error fetching leads history:', leadHistError);

        // Aggregate leads by day
        const leadsMap = {};
        // Initialize last 30 days with 0
        for (let i = 29; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key = d.toISOString().split('T')[0]; // YYYY-MM-DD
            // Format for display - e.g., "Dec 10"
            const displayKey = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            leadsMap[key] = { date: displayKey, fullDate: key, count: 0 };
        }

        (rawLeadsHistory || []).forEach(l => {
            const dateKey = new Date(l.created_at).toISOString().split('T')[0];
            if (leadsMap[dateKey]) {
                leadsMap[dateKey].count++;
            }
        });
        const leadsChartData = Object.values(leadsMap); // Array of { date, fullDate, count }


        // 4. Real Campaign Performance (Last 5 Campaigns + Queue Stats)
        const { data: lastCampaigns, error: campError } = await supabase
            .from('campaigns')
            .select('id, title, success_count, failed_count')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(5);

        let campaignStats = [];
        if (lastCampaigns && lastCampaigns.length > 0) {
            const campaignIds = lastCampaigns.map(c => c.id);

            // Try to fetch queue stats for better accuracy if possible
            const { data: queueStats, error: qError } = await supabase
                .from('campaign_queue')
                .select('campaign_id, status')
                .in('campaign_id', campaignIds);

            if (!qError && queueStats && queueStats.length > 0) {
                const queueMap = {};
                queueStats.forEach(item => {
                    if (!queueMap[item.campaign_id]) queueMap[item.campaign_id] = { sent: 0, delivered: 0, read: 0, failed: 0 };

                    const s = (item.status || '').toUpperCase();
                    if (['SENT', 'DELIVERED', 'READ'].includes(s)) queueMap[item.campaign_id].sent++;
                    if (['DELIVERED', 'READ'].includes(s)) queueMap[item.campaign_id].delivered++;
                    if (s === 'READ') queueMap[item.campaign_id].read++;
                });

                campaignStats = lastCampaigns.map(c => ({
                    name: c.title,
                    sent: queueMap[c.id]?.sent || c.success_count || 0,
                    delivered: queueMap[c.id]?.delivered || c.success_count || 0, // Fallback
                    read: queueMap[c.id]?.read || 0
                }));
            } else {
                campaignStats = lastCampaigns.map(c => ({
                    name: c.title,
                    sent: (c.success_count || 0) + (c.failed_count || 0),
                    delivered: c.success_count || 0,
                    read: 0
                }));
            }
        }

        // 5. Real Template Stats
        const { data: templatesRaw } = await supabase
            .from('whatsapp_templates')
            .select('status')
            .eq('user_id', userId);

        const templateStats = { approved: 0, pending: 0, rejected: 0 };
        if (templatesRaw) {
            templatesRaw.forEach(t => {
                const s = (t.status || '').toUpperCase();
                if (s === 'APPROVED') templateStats.approved++;
                else if (s === 'REJECTED') templateStats.rejected++;
                else templateStats.pending++;
            });
        }

        // --- PROCESS PIPELINE STATS ---
        let pipelineStats = [];
        if (detailedPipelines && detailedPipelines.length > 0) {
            pipelineStats = detailedPipelines.map(p => {
                const pStages = (detailedStages || []).filter(s => s.pipeline_id === p.id);
                // Leads might have null pipeline_id, so filter carefully
                const pLeads = (allLeadsAggregation || []).filter(l => l.pipeline_id === p.id);

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
            breakdown: {} // pipelineId -> { name, today, overdue, total }
        };

        const now = new Date();
        const startOfToday = new Date(now.setHours(0, 0, 0, 0));
        const endOfToday = new Date(now.setHours(23, 59, 59, 999));

        (taskData || []).forEach(t => {
            const isCompleted = t.is_completed; // Boolean column
            const dueDate = t.due_date ? new Date(t.due_date) : null;
            // The lead inner join returns array or object depending on 1:1. 
            // In supabase js with !inner, it returns object if singular, but let's be safe.
            const pipelineId = t.leads?.pipeline_id;

            // Initialize breakdown for this pipeline if meaningful and not yet set
            if (pipelineId && !taskStats.breakdown[pipelineId]) {
                const pipeName = (detailedPipelines || []).find(p => p.id === pipelineId)?.name || 'Unknown Pipeline';
                taskStats.breakdown[pipelineId] = { id: pipelineId, name: pipeName, today: 0, overdue: 0, total: 0 };
            }

            if (isCompleted) {
                taskStats.completed++;
            } else {
                taskStats.due++; // Pending/Due

                if (pipelineId && taskStats.breakdown[pipelineId]) {
                    taskStats.breakdown[pipelineId].total++;
                }

                if (dueDate) {
                    // Check Today
                    if (dueDate >= startOfToday && dueDate <= endOfToday) {
                        taskStats.today++;
                        if (pipelineId && taskStats.breakdown[pipelineId]) taskStats.breakdown[pipelineId].today++;
                    }
                    // Check Overdue (strictly before today and not completed)
                    else if (dueDate < startOfToday) {
                        if (pipelineId && taskStats.breakdown[pipelineId]) taskStats.breakdown[pipelineId].overdue++;
                    }
                }
            }
        });

        res.json({
            summary: {
                totalContacts: totalContacts || 0,
                activeLeads: totalLeads || 0,
                newLeadsToday: todayLeads || 0,
                pipelineValue: totalPipelineValue || 0,
                totalTemplates: totalTemplates || 0,
                totalCampaigns: totalCampaigns || 0,
                totalFlows: totalFlows || 0,
                totalPipelines: totalPipelines || 0,
                totalGroups: totalGroups || 0
            },
            recentLeads: recentLeads || [],
            chartData: trafficData,
            leadsChartData,
            campaignStats,
            templateStats,
            pipelineStats, // [NEW] Displayed in Chart
            taskStats, // [NEW] Displayed in Follow-up cards
            integrationStats, // [NEW] Integration Stats Breakdown
            connection: {
                phone: whatsAppPhone, // Local DB fallback
                id: whatsAppId,
                quality_rating: phoneHealth.quality_rating,
                messaging_limit: phoneHealth.messaging_limit_tier,
                status: phoneHealth.status,
                name_status: phoneHealth.name_status,
                display_phone_number: phoneHealth.display_phone_number // Meta source of truth
            }
        });

    } catch (error) {
        console.error('Dashboard Stats Error:', error);
        res.status(500).json({ error: error.message });
    }
});



module.exports = router;
