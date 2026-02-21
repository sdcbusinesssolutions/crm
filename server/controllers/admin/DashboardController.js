const { supabaseAdmin } = require('../../lib/supabaseClient');

exports.getDashboardStats = async (req, res) => {
    try {
        const adminDomain = req.admin?.managed_domain || req.admin?.domain;
        const adminRole = req.admin?.role;

        if (!adminDomain) {
            return res.status(403).json({ message: 'Domain information missing' });
        }

        // STRICT Super Admin Check
        const isSuperAdmin = adminRole === 'super_admin';

        // Get current date boundaries
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEnd = new Date(todayStart);
        todayEnd.setDate(todayEnd.getDate() + 1);

        let totalUsers = 0;
        let tenantUserCount = 0;
        // Profiles used for global stats/trends
        let profiles = [];

        // 1. Fetch Tenant Specific Profiles (for Workspace Usage)
        // 1. Fetch Tenant Specific Profiles (for Workspace Usage)
        // Normalize domain to handle potential case/whitespace issues
        const safeDomain = (adminDomain || '').trim();
        console.log(`[DashboardController] Fetching stats for domain: '${safeDomain}' (Original: '${adminDomain}')`);

        const { data: tenantProfiles, error: tenantError } = await supabaseAdmin
            .from('profiles')
            .select('id, created_at, signup_domain, plan_expires_at, plan_name, email')
            .ilike('signup_domain', safeDomain);

        if (tenantError) {
            console.error('Error fetching tenant profiles:', tenantError);
        } else {
            console.log(`[DashboardController] Found ${tenantProfiles?.length || 0} profiles for domain '${safeDomain}'`);
        }

        if (tenantProfiles) {
            tenantUserCount = tenantProfiles.length;
            if (!isSuperAdmin) {
                profiles = tenantProfiles;
                totalUsers = tenantUserCount;
            }
        }

        // 2. If Super Admin, fetch ALL profiles for "Total Users" & Trends
        if (isSuperAdmin) {
            const { data: allProfiles, error: allError } = await supabaseAdmin
                .from('profiles')
                .select('id, created_at, signup_domain, plan_expires_at, plan_name, email');

            if (allProfiles) {
                profiles = allProfiles;
                totalUsers = allProfiles.length;
            }
        }

        // --- PLAN EXPIRY STATS LOGIC ---
        const nowMs = new Date().getTime();
        const weekMs = 7 * 24 * 60 * 60 * 1000;
        const monthMs = 30 * 24 * 60 * 60 * 1000;

        let expiredCount = 0;
        let expiringWeekCount = 0;
        let expiringMonthCount = 0;
        let expiringUsersList = [];

        // Filter valid profiles for expiry stats
        const profileMap = new Map(profiles.map(p => [p.id, p]));
        const userIds = profiles.map(p => p.id);

        // Fetch subscriptions dynamically to ensure accuracy
        // We fetch all subscriptions for the domain's users (filtered in memory if needed or via query if possible)
        let subsData = [];
        if (userIds.length > 0) {
            let query = supabaseAdmin
                .from('user_subscriptions')
                .select('user_id, plan_id, end_date, status')
                .order('end_date', { ascending: false }); // Latest first

            // Optimize query if possible
            if (userIds.length <= 100) {
                query = query.in('user_id', userIds);
            }

            const { data, error } = await query;
            if (!error && data) {
                subsData = data.filter(s => profileMap.has(s.user_id));
            } else if (error) {
                console.error('Error fetching subscriptions for stats:', error);
            }
        }

        // Determine latest effective subscription per user
        const userLatestSub = new Map();
        subsData.forEach(sub => {
            if (!userLatestSub.has(sub.user_id)) {
                userLatestSub.set(sub.user_id, sub);
            }
        });

        // Calculate stats
        userLatestSub.forEach((sub, userId) => {
            const p = profileMap.get(userId);
            if (!sub.end_date) return;

            const expMs = new Date(sub.end_date).getTime();
            const diff = expMs - nowMs;
            let status = null;
            let daysLeft = 0;

            if (diff < 0) {
                expiredCount++;
                status = 'Expired';
                daysLeft = Math.floor(diff / (1000 * 60 * 60 * 24));
            } else {
                daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));
                if (diff <= weekMs) {
                    expiringWeekCount++;
                    status = 'Expiring (Week)';
                } else if (diff <= monthMs) {
                    expiringMonthCount++;
                    status = 'Expiring (Month)';
                }
            }

            if (status) {
                expiringUsersList.push({
                    name: p.email ? p.email.split('@')[0] : 'User',
                    email: p.email,
                    plan: p.plan_name || 'Plan',
                    expiry: sub.end_date,
                    status,
                    daysLeft
                });
            }
        });

        expiringUsersList.sort((a, b) => new Date(a.expiry) - new Date(b.expiry));
        const recentExpirations = expiringUsersList.slice(0, 15);

        const planExpiryStats = {
            expired: expiredCount,
            expiringInWeek: expiringWeekCount,
            expiringInMonth: expiringMonthCount,
            details: recentExpirations
        };
        // -------------------------------

        // Calculate stats based on 'profiles' (Global if Super, Local if Tenant)

        // Today's signups
        const todaySignups = profiles.filter(p => {
            const createdAt = new Date(p.created_at);
            return createdAt >= todayStart && createdAt < todayEnd;
        }).length;

        // Active users today (signed in today)
        // Note: profiles table doesn't have last_sign_in_at yet. Use auth data or skip.
        const todayActiveUsers = 0;

        // Active users (signed in within last 7 days)
        const activeUsers = 0;

        // Get contacts count
        let contactsQuery = supabaseAdmin
            .from('contacts')
            .select('id', { count: 'exact', head: true });

        if (!isSuperAdmin) {
            contactsQuery = contactsQuery.ilike('domain', safeDomain);
        }

        const { count: contacts } = await contactsQuery;

        // Fetch Tenant Limits & Plan
        let tenantInfo = { limit: 10, plan: 'Free', daysLeft: 999 };

        if (safeDomain) {
            const { data: limitData } = await supabaseAdmin
                .from('tenant_limits')
                .select('user_limit')
                .eq('domain', safeDomain) // Assuming tenant_limits domain is normalized
                .single();
            if (limitData) tenantInfo.limit = limitData.user_limit;

            const { data: planData } = await supabaseAdmin
                .from('tenant_plans')
                .select('plan_name, expires_at')
                .eq('domain', safeDomain)
                .single();
            if (planData) {
                tenantInfo.plan = planData.plan_name;
                if (planData.expires_at) {
                    const diff = new Date(planData.expires_at) - new Date();
                    tenantInfo.daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));
                }
            }
        }

        // Generate signup trends data
        const signupTrends = await generateSignupTrends(profiles, null);

        const stats = {
            totalUsers,
            activeUsers,
            todayActiveUsers,
            todaySignups,
            contacts: contacts || 0,
            signupTrends,
            tenantStats: {
                user_count: tenantUserCount,
                user_limit: tenantInfo.limit,
                plan_name: tenantInfo.plan,
                days_left: tenantInfo.daysLeft
            },
            planExpiryStats
        };

        res.setHeader('Cache-Control', 'no-cache');
        console.log("Stats Response Debug:", JSON.stringify(stats));
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
