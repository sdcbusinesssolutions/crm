const express = require('express');
const router = express.Router();
const { getAuthenticatedSupabase, supabaseAdmin } = require('../lib/supabaseClient');
const requireAuth = require('../middleware/requireAuth');

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

// GET /api/lead-dashboard/stats
router.get('/stats', requireAuth, async (req, res) => {
    // SECURITY: Disable all browser-level caching for API to prevent cross-user leakage on shared machines.
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    try {
        const userId = req.user.id;

        // --- Cache Disabled for Dev Sync ---
        /*
        if (!global.leadDashboardCache) global.leadDashboardCache = {};
        const cached = global.leadDashboardCache[userId];
        const cacheTTL = 60 * 1000;

        if (cached && (Date.now() - cached.timestamp < cacheTTL) && !req.query.force) {
            return res.json(cached.data);
        }
        */

        const supabase = getAuthenticatedSupabase(req);

        const [
            pipelinesRes,           // 0
            groupCountRes,          // 1
            formCountRes,           // 2
            followUpCountRes,       // 3
            totalLeadsRes,          // 4
            recentLeadsRes,         // 5
            allLeadsRes,            // 6 (Aggregated Leads Data)
            tagsRes,                // 7 (Tag distribution from contacts)
            stagesRes,              // 8
            tagsListRes             // 9
        ] = await Promise.all([
            // 0. Pipelines the user has access to (Matching Board ordering)
            supabase.from('pipelines').select('id, name, is_default').order('created_at', { ascending: false }),
            // 1-4. Aggregate Counts (Use Admin to see full totals)
            supabaseAdmin.from('contact_groups').select('*', { count: 'exact', head: true }),
            supabaseAdmin.from('forms').select('*', { count: 'exact', head: true }),
            supabaseAdmin.from('tasks').select('*', { count: 'exact', head: true }).eq('is_completed', false),
            supabaseAdmin.from('contacts').select('*', { count: 'exact', head: true }),

            // 5. Recent Leads (Matching Board visibility)
            supabaseAdmin.from('leads').select('id, name, company, email, phone, status, created_at, source').order('created_at', { ascending: false }).limit(5),

            // 6. ALL Leads for aggregation (Global sync to match CRM totals)
            supabaseAdmin.from('leads').select('id, pipeline_id, stage_id, source, created_at').limit(50000),

            // 7. Tag distribution (Global aggregation to match Lead CRM count)
            supabaseAdmin.from('contacts').select('tags').limit(50000),

            // 8-9. Meta Data
            supabaseAdmin.from('pipeline_stages').select('id, name, color, pipeline_id'),
            supabaseAdmin.from('tags').select('name, color'),

            // 10-12. Time-Series Data for specialized cards
            supabaseAdmin.from('forms').select('id, created_at').gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
            supabaseAdmin.from('pipelines').select('id, created_at').gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
            supabaseAdmin.from('tasks').select('id, created_at').gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        ]);

        const pipelines = pipelinesRes.data || [];
        const stages = stagesRes.data || [];
        const tagsList = tagsListRes.data || [];
        const formsTimeData = Array.isArray(arguments[0][10]?.data) ? arguments[0][10].data : [];
        const pipesTimeData = Array.isArray(arguments[0][11]?.data) ? arguments[0][11].data : [];
        const tasksTimeData = Array.isArray(arguments[0][12]?.data) ? arguments[0][12].data : [];

        // D. Pipeline-Specific Stats Map
        const pipelineStatsMap = {};
        const leadsData = allLeadsRes.data || [];
        
        // A. Leads By Source (Global)
        const sourceMap = {};
        leadsData.forEach(l => {
            const src = l.source || 'manual';
            sourceMap[src] = (sourceMap[src] || 0) + 1;
        });
        const leadsBySource = Object.entries(sourceMap)
            .map(([name, count]) => ({ name, count, value: count }))
            .sort((a, b) => b.count - a.count);

        // B. Leads Over Time (Global - Last 7 Days)
        const last7Days = [];
        const formsOverTime = [];
        const pipelinesOverTime = [];
        const tasksOverTime = [];

        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });

            const dayCount = leadsData.filter(l => l.created_at && l.created_at.startsWith(dateStr)).length;
            last7Days.push({ date: dateStr, count: dayCount, dayName });

            const fCount = formsTimeData.filter(f => f.created_at && f.created_at.startsWith(dateStr)).length;
            formsOverTime.push({ date: dateStr, count: fCount, dayName });

            const pCount = pipesTimeData.filter(p => p.created_at && p.created_at.startsWith(dateStr)).length;
            pipelinesOverTime.push({ date: dateStr, count: pCount, dayName });

            const tCount = tasksTimeData.filter(t => t.created_at && t.created_at.startsWith(dateStr)).length;
            tasksOverTime.push({ date: dateStr, count: tCount, dayName });
        }

        // C. Leads By Tag (Aggregating from Contacts and Leads for maximum coverage)
        const tagMap = {};
        
        // 1. Process Tags from Contacts (Most likely source for high-volume tags)
        (tagsRes.data || []).forEach(item => {
            let tags = item.tags;
            if (typeof tags === 'string') {
                try {
                    // Handle Postgres array format {tag1,tag2}
                    tags = tags.replace(/^{|}$/g, '').split(',').map(t => t.trim()).filter(t => t.length > 0);
                } catch(e) { tags = []; }
            }
            if (Array.isArray(tags)) {
                tags.forEach(t => {
                    if (t) tagMap[t] = (tagMap[t] || 0) + 1;
                });
            }
        });

        // 2. Process Tags from Leads (Ensure pipeline-specific tags are included)
        leadsData.forEach(l => {
            let tags = l.tags;
            if (Array.isArray(tags)) {
                tags.forEach(t => {
                    if (t) tagMap[t] = (tagMap[t] || 0) + 1;
                });
            }
        });

        const leadsByTag = Object.entries(tagMap)
            .map(([name, count]) => {
                const tagDef = tagsList.find(t => t.name === name);
                return { name, count, color: tagDef?.color || '#cbd5e1' };
            })
            .sort((a, b) => b.count - a.count)
            .slice(0, 8);

        pipelines.forEach(p => {
            const pLeads = leadsData.filter(l => l.pipeline_id === p.id);
            const pStages = stages.filter(s => s.pipeline_id === p.id);

            // Sources for this pipeline
            const pSourceMap = {};
            pLeads.forEach(l => {
                const src = l.source || 'manual';
                pSourceMap[src] = (pSourceMap[src] || 0) + 1;
            });

            // Activity for this pipeline
            const pLast7Days = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dateStr = d.toISOString().split('T')[0];
                const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
                // We use created_at from pipeStatsRaw if available, else fallback to 0 or similar
                // Note: pipeStatsRes.data must include created_at for this to work
                const dayCount = pLeads.filter(l => l.created_at && l.created_at.startsWith(dateStr)).length;
                pLast7Days.push({ date: dateStr, count: dayCount, dayName });
            }

            let totalVal = 0;
            const stageStats = pStages.map(s => {
                const sLeads = pLeads.filter(l => l.stage_id === s.id);
                const count = sLeads.length;
                const val = sLeads.reduce((acc, curr) => acc + (Number(curr.estimated_value) || 0), 0);
                totalVal += val;
                return { name: s.name, count, color: s.color, value: val };
            });

            pipelineStatsMap[p.id] = {
                totalLeads: pLeads.length,
                totalValue: totalVal,
                stages: stageStats,
                leadsBySource: Object.entries(pSourceMap).map(([name, count]) => ({ name, count, value: count })).sort((a, b) => b.count - a.count),
                leadsOverTime: pLast7Days
            };
        });

        const responseData = {
            pipelines,
            pipelineCount: pipelines.length,
            groupCount: groupCountRes.count || 0,
            formCount: formCountRes.count || 0,
            followUpCount: followUpCountRes.count || 0,
            totalLeads: totalLeadsRes.count || 0,
            recentLeads: recentLeadsRes.data || [],
            leadsBySource,
            leadsOverTime: last7Days,
            formsOverTime,
            pipelinesOverTime,
            tasksOverTime,
            leadsByTag,
            pipelineStatsMap // { pipelineId: { totalLeads, totalValue, stages: [] } }
        };

        // Cache It
        global.leadDashboardCache[userId] = {
            data: responseData,
            timestamp: Date.now()
        };

        // Add Cache-Control Header for Browser Caching (30s stale allow, 10s fresh)
        // This ensures subsequent navigations (within 10s) are INSTANT (disk cache).
        res.json(responseData);

    } catch (error) {
        console.error('Lead Dashboard Stats Error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;