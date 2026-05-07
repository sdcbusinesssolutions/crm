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
const leadDashboardCache = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 Minutes Server-Side Cache

router.get('/stats', requireAuth, async (req, res) => {
    // SECURITY: Disable all browser-level caching for API to prevent cross-user leakage on shared machines.
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    try {
        const userId = req.user.id;
        const force = req.query.force === 'true';

        // 1. Server-Side Cache Check
        const cached = leadDashboardCache[userId];
        if (cached && (Date.now() - cached.timestamp < CACHE_TTL) && !force) {
            return res.json(cached.data);
        }

        const supabase = getAuthenticatedSupabase(req);

        // 2. Execute High-Performance SQL RPC
        // This function handles dynamic stage counts, lead aggregation, and pipeline mapping in one pass.
        const { data, error } = await supabase.rpc('get_lead_dashboard_stats_v2', { p_user_id: userId });

        if (error) {
            console.error('[LeadDashboard] RPC Error:', error);
            // If RPC is missing, return an error so user knows to run the migration
            return res.status(500).json({ 
                error: 'Stats Engine Missing', 
                message: 'Please run the get_lead_dashboard_stats_v2 SQL function in your database.' 
            });
        }

        // 3. Update Server Cache
        leadDashboardCache[userId] = {
            data: data,
            timestamp: Date.now()
        };

        console.log(`[LeadDashboardStats] Optimized RPC success for user ${userId}`);
        res.json(data);

    } catch (err) {
        console.error('Lead Dashboard Stats Error:', err);
        res.status(500).json({ error: 'Failed to load optimized stats' });
    }
});

module.exports = router;