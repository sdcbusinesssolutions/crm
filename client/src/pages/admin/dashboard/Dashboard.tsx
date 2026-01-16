import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

const Dashboard = () => {
    const [stats, setStats] = useState<any>(null);
    const [tenantStats, setTenantStats] = useState<any>(null);

    useEffect(() => {
        const fetchStats = async () => {
            // Existing Legacy Stats
            const token = localStorage.getItem('adminToken');
            try {
                const response = await fetch('/api/admin/dashboard/stats', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    setStats(await response.json());
                }
            } catch (e) { console.error("Legacy stats failed", e); }

            // New Tenant Stats (Supabase)
            try {
                const { data, error } = await supabase.rpc('get_my_tenant_stats' as any);
                if (!error && data && (data as any[]).length > 0) {
                    setTenantStats((data as any[])[0]);
                }
            } catch (e) {
                console.error("Tenant stats failed", e);
            }
        };
        fetchStats();
    }, []);

    if (!stats && !tenantStats) return <div>Loading...</div>;

    return (
        <div className="dashboard-container p-8">
            <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

            {/* TENANT LIMITS CARD */}
            {tenantStats && (
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg mb-8 flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-semibold opacity-90">Workspace Limit</h2>
                        <div className="text-4xl font-bold mt-1">
                            {tenantStats.user_count} <span className="text-xl opacity-60">/ {tenantStats.user_limit} Users</span>
                        </div>
                        <div className="mt-2 text-sm opacity-80">
                            Plan: <span className="font-bold">{tenantStats.plan_name}</span>
                            {tenantStats.days_left < 100 && ` (Expires in ${tenantStats.days_left} days)`}
                        </div>
                    </div>
                    <div className="text-5xl opacity-20">👥</div>
                </div>
            )}

            {/* Widgets Section */}
            {stats && (
                <div className="widgets-grid grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="widget bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h3 className="text-3xl font-bold text-gray-800">{stats.totalUsers}</h3>
                        <p className="text-gray-500">Total Users</p>
                    </div>
                    {/* ... other legacy widgets if needed ... */}
                    <div className="widget bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h3 className="text-3xl font-bold text-gray-800">{stats.activeUsers}</h3>
                        <p className="text-gray-500">Active Users</p>
                    </div>
                    <div className="widget bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h3 className="text-3xl font-bold text-gray-800">{stats.contacts}</h3>
                        <p className="text-gray-500">Total Contacts</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
