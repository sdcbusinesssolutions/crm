const { supabaseAdmin } = require('../../lib/supabaseClient');

exports.getDashboardStats = async (req, res) => {
    try {
        const adminDomain = req.admin?.managed_domain || req.admin?.domain;
        const adminRole = req.admin?.role;

        if (!adminDomain) {
            return res.status(403).json({ message: 'Domain information missing' });
        }

        // Check if super admin
        const MASTER_DOMAIN = process.env.VITE_MASTER_URL ? new URL(process.env.VITE_MASTER_URL).hostname : 'clickube.com';
        const isSuperAdmin = adminRole === 'super_admin' || adminDomain === MASTER_DOMAIN || adminDomain === 'localhost';

        // Get current date boundaries
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEnd = new Date(todayStart);
        todayEnd.setDate(todayEnd.getDate() + 1);

        // Fetch profiles with domain filtering
        let profilesQuery = supabaseAdmin
            .from('profiles')
            .select('id, created_at, signup_domain, last_sign_in_at');

        if (!isSuperAdmin) {
            profilesQuery = profilesQuery.eq('signup_domain', adminDomain);
        }

        const { data: profiles, error: profilesError } = await profilesQuery;

        if (profilesError) {
            console.error('Error fetching profiles:', profilesError);
            return res.status(500).json({ message: 'Failed to fetch user data' });
        }

        // Calculate stats
        const totalUsers = profiles.length;

        // Today's signups
        const todaySignups = profiles.filter(p => {
            const createdAt = new Date(p.created_at);
            return createdAt >= todayStart && createdAt < todayEnd;
        }).length;

        // Active users today (signed in today)
        const todayActiveUsers = profiles.filter(p => {
            if (!p.last_sign_in_at) return false;
            const lastSignIn = new Date(p.last_sign_in_at);
            return lastSignIn >= todayStart && lastSignIn < todayEnd;
        }).length;

        // Active users (signed in within last 7 days)
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const activeUsers = profiles.filter(p => {
            if (!p.last_sign_in_at) return false;
            const lastSignIn = new Date(p.last_sign_in_at);
            return lastSignIn >= sevenDaysAgo;
        }).length;

        // Get contacts count
        let contactsQuery = supabaseAdmin
            .from('contacts')
            .select('id', { count: 'exact', head: true });

        if (!isSuperAdmin) {
            contactsQuery = contactsQuery.eq('domain', adminDomain);
        }

        const { count: contacts } = await contactsQuery;

        // Generate signup trends data
        const signupTrends = await generateSignupTrends(profiles, isSuperAdmin ? null : adminDomain);

        const stats = {
            totalUsers,
            activeUsers,
            todayActiveUsers,
            todaySignups,
            contacts: contacts || 0,
            signupTrends
        };

        res.json(stats);
    } catch (err) {
        console.error('Dashboard stats error:', err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// Helper function to generate signup trends
async function generateSignupTrends(profiles, domain = null) {
    const now = new Date();

    // Daily data (last 7 days)
    const dailyData = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);

        const count = profiles.filter(p => {
            const createdAt = new Date(p.created_at);
            return createdAt >= dayStart && createdAt < dayEnd;
        }).length;

        dailyData.push({
            label: date.toLocaleDateString('en-US', { weekday: 'short' }),
            date: dayStart.toISOString().split('T')[0],
            value: count
        });
    }

    // Weekly data (last 8 weeks)
    const weeklyData = [];
    for (let i = 7; i >= 0; i--) {
        const weekEnd = new Date(now);
        weekEnd.setDate(weekEnd.getDate() - (i * 7));
        const weekStart = new Date(weekEnd);
        weekStart.setDate(weekStart.getDate() - 7);

        const count = profiles.filter(p => {
            const createdAt = new Date(p.created_at);
            return createdAt >= weekStart && createdAt < weekEnd;
        }).length;

        weeklyData.push({
            label: `Week ${8 - i}`,
            dateRange: `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
            value: count
        });
    }

    // Monthly data (last 12 months)
    const monthlyData = [];
    for (let i = 11; i >= 0; i--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
        const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1);

        const count = profiles.filter(p => {
            const createdAt = new Date(p.created_at);
            return createdAt >= monthStart && createdAt < monthEnd;
        }).length;

        monthlyData.push({
            label: monthDate.toLocaleDateString('en-US', { month: 'short' }),
            month: monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
            value: count
        });
    }

    return {
        daily: dailyData,
        weekly: weeklyData,
        monthly: monthlyData
    };
}

exports.getTenantsList = async (req, res) => {
    try {
        if (!supabaseAdmin) return res.status(500).json({ message: 'DB Connection Error' });

        const { data, error } = await supabaseAdmin.rpc('get_all_tenants_summary');

        if (error) {
            console.error('Error fetching tenants:', error);
            // Fallback for demo if RPC missing
            return res.json([
                { domain: 'clickube.com', brand_name: 'ClicKube (Master)', user_count: 0 },
                { domain: 'apiautomation.in', brand_name: 'ApiAutomation', user_count: 0 }
            ]);
        }

        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};
