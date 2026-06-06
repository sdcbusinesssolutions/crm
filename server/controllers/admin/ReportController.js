const { supabaseAdmin } = require('../../lib/supabaseClient');

class ReportController {
    /**
     * Helper to validate permissions and domain scoping.
     * Returns { isSuperAdmin, targetDomain }
     */
    static getScope(req) {
        const adminDomain = req.admin?.managed_domain || req.admin?.domain;
        const adminRole = req.admin?.role;
        const MASTER_DOMAIN = process.env.VITE_MASTER_URL
            ? new URL(process.env.VITE_MASTER_URL).hostname
            : 'clickube.com';
        
        const isSuperAdmin = adminRole === 'super_admin' || 
                             adminDomain === MASTER_DOMAIN || 
                             adminDomain === 'localhost';

        // If Tenant Admin, they can ONLY see their own domain data.
        // If Super Admin, they can see ALL domains (null) unless they specify one in query.
        const requestedDomain = req.query.domain;
        const targetDomain = isSuperAdmin ? (requestedDomain || null) : adminDomain;

        return { isSuperAdmin, targetDomain };
    }

    /**
     * GET /api/wallet/admin/reports/revenue
     * Calculates Gross Revenue, Meta Costs, Platform Revenue, grouped by an entity.
     */
    static async getRevenueReport(req, res) {
        try {
            const { isSuperAdmin, targetDomain } = ReportController.getScope(req);
            const { startDate, endDate, groupBy } = req.query;

            // groupBy can be: 'tenant', 'user', 'campaign', 'category', 'source'
            // Default to 'category' if nothing specified
            const group = groupBy || 'category';

            // Security: If Tenant Admin tries to group by 'tenant', override to 'user' since they only have 1 tenant anyway.
            const safeGroup = (!isSuperAdmin && group === 'tenant') ? 'user' : group;

            const { data, error } = await supabaseAdmin.rpc('get_revenue_report', {
                p_start_date: startDate ? new Date(startDate).toISOString() : null,
                p_end_date: endDate ? new Date(endDate).toISOString() : null,
                p_group_by: safeGroup,
                p_tenant_domain: targetDomain
            });

            if (error) throw error;
            res.json({ success: true, data });
        } catch (error) {
            console.error('Error fetching revenue report:', error);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * GET /api/wallet/admin/reports/wallet-summary
     * Calculates Total Added, Consumed, Refunded, Adjusted for a given period.
     */
    static async getWalletSummary(req, res) {
        try {
            const { targetDomain } = ReportController.getScope(req);
            const { startDate, endDate } = req.query;

            const { data, error } = await supabaseAdmin.rpc('get_wallet_summary_report', {
                p_start_date: startDate ? new Date(startDate).toISOString() : null,
                p_end_date: endDate ? new Date(endDate).toISOString() : null,
                p_tenant_domain: targetDomain
            });

            if (error) throw error;
            res.json({ success: true, data: data?.[0] || {} });
        } catch (error) {
            console.error('Error fetching wallet summary:', error);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * GET /api/wallet/admin/reports/usage
     * Generates time-series data for usage (messages sent, conversions, AI calls, etc).
     */
    static async getUsageReport(req, res) {
        try {
            const { targetDomain } = ReportController.getScope(req);
            const { startDate, endDate, interval } = req.query;

            // interval can be: 'day', 'week', 'month'
            const timeInterval = interval || 'day';

            const { data, error } = await supabaseAdmin.rpc('get_usage_report', {
                p_start_date: startDate ? new Date(startDate).toISOString() : null,
                p_end_date: endDate ? new Date(endDate).toISOString() : null,
                p_interval: timeInterval,
                p_tenant_domain: targetDomain
            });

            if (error) throw error;
            res.json({ success: true, data });
        } catch (error) {
            console.error('Error fetching usage report:', error);
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = ReportController;
