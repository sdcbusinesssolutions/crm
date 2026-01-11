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
