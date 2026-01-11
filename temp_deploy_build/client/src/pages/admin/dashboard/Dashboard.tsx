import React, { useEffect, useState } from 'react';

const Dashboard = () => {
    const [stats, setStats] = useState<any>(null);

    useEffect(() => {
        const fetchStats = async () => {
            const token = localStorage.getItem('adminToken');
            const response = await fetch('/api/admin/dashboard/stats', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                setStats(await response.json());
            }
        };
        fetchStats();
    }, []);

    if (!stats) return <div>Loading...</div>;

    return (
        <div className="dashboard-container">
            <h1>Dashboard</h1>

            {/* Widgets Section */}
            <div className="widgets-grid">
                <div className="widget">
                    <h3>{stats.totalUsers}</h3>
                    <p>Total Users</p>
                </div>
                <div className="widget">
                    <h3>{stats.activeUsers}</h3>
                    <p>Active Users</p>
                </div>
                <div className="widget">
                    <h3>{stats.contacts}</h3>
                    <p>Total Contacts</p>
                </div>
                <div className="widget">
                    <h3>{stats.totalCampaigns}</h3>
                    <p>Total Campaigns</p>
                </div>
                <div className="widget">
                    <h3>{stats.messagesInProcess}</h3>
                    <p>Messages in Process</p>
                </div>
                <div className="widget">
                    <h3>{stats.processedMessages}</h3>
                    <p>Processed Messages</p>
                </div>
            </div>

            {/* Graph Section */}
            <div className="graph-section">
                <h2>User Onboarding Analytics (Annual)</h2>
                <div className="graph-placeholder">
                    {/* Implement Chart.js or Recharts here */}
                    {stats?.graphData?.map((d: any, i: number) => (
                        <div key={i} style={{ display: 'inline-block', margin: '0 10px' }}>
                            <div style={{ height: `${d.value * 100}px`, background: 'green', width: '20px' }}></div>
                            <span>{d.month}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
