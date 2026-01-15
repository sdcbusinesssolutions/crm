exports.getDashboardStats = (req, res) => {
    // Mock data based on screenshots
    const stats = {
        totalUsers: 3,
        activeUsers: 3,
        contacts: 7668,
        totalCampaigns: 14,
        messagesInProcess: 0,
        processedMessages: 2610,
        graphData: [ // Example annual data
            { month: 'Jan', value: 0 },
            { month: 'May', value: 0.1 },
            { month: 'Jun', value: 1.0 },
            { month: 'Aug', value: 1.0 },
            { month: 'Sep', value: 0 }
        ]
    };
    res.json(stats);
};

const { supabaseAdmin } = require('../../lib/supabaseClient');

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
