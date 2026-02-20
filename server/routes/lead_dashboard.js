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

        // --- 0. Check Cache (60s TTL) ---
        // We use a lenient cache on server, but browser cache is better for "instant" feel
        if (!global.leadDashboardCache) global.leadDashboardCache = {};
        const cached = global.leadDashboardCache[userId];
        const cacheTTL = 60 * 1000;

        if (cached && (Date.now() - cached.timestamp < cacheTTL) && !req.query.force) {
            return res.json(cached.data);
        }

        const supabase = supabaseAdmin;

        // --- 1. Fetch Core Data (Parallel) ---
        // Split queries for maximum index efficiency to keep DB response < 100ms
        const [
            pipelinesRes,           // 0
            groupCountRes,          // 1
            formCountRes,           // 2
            followUpCountRes,       // 3
            totalLeadsRes,          // 4
            recentLeadsRes,         // 5
            pipeStatsRes,           // 6 (Partial: pipeline_id, stage_id, estimated_value)
            sourceRes,              // 7 (Partial: source)
            timeRes,                // 8 (Partial: created_at, last 7 days)
            tagsRes,                // 9 (Partial: tags)
            stagesRes,              // 10
            tagsListRes             // 11
        ] = await Promise.all([
            supabase.from('pipelines').select('*').eq('user_id', userId).order('created_at'),
            supabase.from('contact_groups').select('*', { count: 'exact', head: true }).eq('user_id', userId),
            supabase.from('forms').select('*', { count: 'exact', head: true }).eq('user_id', userId),
            supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('is_completed', false),
            supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('user_id', userId), // Total Audience (Contacts) count

            // Recent Leads (Limit 5)
            supabase.from('leads').select('id, name, company, email, phone, status, created_at, source').eq('user_id', userId).order('created_at', { ascending: false }).limit(5),

            // --- OPTIMIZED SPLIT QUERIES (Covering Indices) ---
            supabase.from('leads').select('pipeline_id, stage_id, estimated_value').eq('user_id', userId),
            supabase.from('leads').select('source').eq('user_id', userId),
            supabase.from('leads').select('created_at').eq('user_id', userId).gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
            supabase.from('leads').select('tags').eq('user_id', userId),

            // Meta Data
            supabase.from('pipeline_stages').select('id, name, color, pipeline_id').eq('user_id', userId),
            supabase.from('tags').select('name, color').eq('user_id', userId)
        ]);

        // --- 2. Process Aggregations (CPU Bound - Fast) ---
        const pipelines = pipelinesRes.data || [];
        const stages = stagesRes.data || [];
        const tagsList = tagsListRes.data || [];

        // A. Leads By Source
        const sourceMap = {};
        (sourceRes.data || []).forEach(l => {
            const src = l.source || 'manual';
            sourceMap[src] = (sourceMap[src] || 0) + 1;
        });
        const leadsBySource = Object.entries(sourceMap)
            .map(([name, count]) => ({ name, count, value: count }))
            .sort((a, b) => b.count - a.count);

        // B. Leads Over Time (Last 7 Days)
        const last7Days = [];
        const recentTimeData = timeRes.data || [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });

            // Count leads for this day
            const dayCount = recentTimeData.filter(l => l.created_at && l.created_at.startsWith(dateStr)).length;
            last7Days.push({ date: dateStr, count: dayCount, dayName });
        }

        // C. Leads By Tag (Top 5)
        const tagMap = {};
        (tagsRes.data || []).forEach(l => {
            let tags = l.tags;
            // Handle potential string format "{tag1,tag2}"
            if (typeof tags === 'string') {
                tags = tags.replace(/^{|}$/g, '').split(',').filter(t => t.length > 0);
            }
            if (Array.isArray(tags)) {
                tags.forEach(t => tagMap[t] = (tagMap[t] || 0) + 1);
            }
        });
        const leadsByTag = Object.entries(tagMap)
            .map(([name, count]) => {
                const tagDef = tagsList.find(t => t.name === name);
                return { name, count, color: tagDef?.color || '#cbd5e1' };
            })
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        // D. Pipeline Stats (Default Pipeline)
        const pipeStatsRaw = pipeStatsRes.data || [];
        const pipelineStatsMap = {};

        pipelines.forEach(p => {
            const pStages = stages.filter(s => s.pipeline_id === p.id);
            const pLeads = pipeStatsRaw.filter(l => l.pipeline_id === p.id);

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
                stages: stageStats
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
