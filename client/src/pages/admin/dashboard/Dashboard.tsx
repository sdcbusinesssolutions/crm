import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface SignupTrends {
    daily: Array<{ label: string; date: string; value: number }>;
    weekly: Array<{ label: string; dateRange: string; value: number }>;
    monthly: Array<{ label: string; month: string; value: number }>;
}

interface DashboardStats {
    totalUsers: number;
    activeUsers: number;
    todayActiveUsers: number;
    todaySignups: number;
    contacts: number;
    signupTrends: SignupTrends;
}

const Dashboard = () => {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [tenantStats, setTenantStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [chartView, setChartView] = useState<'daily' | 'weekly' | 'monthly'>('daily');

    useEffect(() => {
        const fetchStats = async () => {
            const token = localStorage.getItem('adminToken');
            try {
                const response = await fetch('/api/admin/dashboard/stats', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    setStats(await response.json());
                }
            } catch (e) {
                console.error("Stats fetch failed", e);
            }

            // Tenant Stats
            try {
                const { data, error } = await supabase.rpc('get_my_tenant_stats' as any);
                if (!error && data && (data as any[]).length > 0) {
                    setTenantStats((data as any[])[0]);
                }
            } catch (e) {
                console.error("Tenant stats failed", e);
            }
            setLoading(false);
        };
        fetchStats();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600"></div>
                    <p className="mt-4 text-gray-600 font-medium">Loading Dashboard...</p>
                </div>
            </div>
        );
    }

    const usagePercentage = tenantStats ? (tenantStats.user_count / tenantStats.user_limit) * 100 : 0;
    const isNearLimit = usagePercentage >= 80;

    // Calculate growth percentages
    const todayGrowth = stats && stats.totalUsers > 0
        ? ((stats.todaySignups / stats.totalUsers) * 100).toFixed(1)
        : '0';

    const activeRate = stats && stats.totalUsers > 0
        ? ((stats.activeUsers / stats.totalUsers) * 100).toFixed(1)
        : '0';

    // Get current chart data
    const currentChartData = stats?.signupTrends?.[chartView] || [];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 md:p-8">
            {/* Header Section */}
            <div className="mb-8 animate-fade-in">
                <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
                    Dashboard
                </h1>
                <p className="text-gray-600 text-lg">Welcome back! Here's what's happening today.</p>
            </div>

            {/* Workspace Limit Card */}
            {tenantStats && (
                <div className="mb-8 group animate-slide-up">
                    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 p-8 shadow-2xl transition-all duration-300 hover:shadow-blue-500/50 hover:scale-[1.02]">
                        <div className="absolute inset-0 opacity-10">
                            <div className="absolute top-0 -left-4 w-72 h-72 bg-white rounded-full mix-blend-overlay filter blur-3xl animate-blob"></div>
                            <div className="absolute top-0 -right-4 w-72 h-72 bg-purple-300 rounded-full mix-blend-overlay filter blur-3xl animate-blob animation-delay-2000"></div>
                            <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-overlay filter blur-3xl animate-blob animation-delay-4000"></div>
                        </div>

                        <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                        </svg>
                                    </div>
                                    <h2 className="text-xl md:text-2xl font-bold text-white">Workspace Usage</h2>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <div className="flex items-baseline gap-2 mb-2">
                                            <span className="text-5xl md:text-6xl font-black text-white">{tenantStats.user_count}</span>
                                            <span className="text-2xl md:text-3xl text-white/70">/ {tenantStats.user_limit}</span>
                                            <span className="text-lg text-white/90 ml-2">users</span>
                                        </div>

                                        <div className="w-full bg-white/20 backdrop-blur-sm rounded-full h-3 overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-1000 ease-out ${isNearLimit ? 'bg-gradient-to-r from-yellow-400 to-red-500' : 'bg-gradient-to-r from-green-400 to-emerald-500'
                                                    }`}
                                                style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                                            ></div>
                                        </div>
                                        <p className="text-sm text-white/80 mt-2">
                                            {usagePercentage.toFixed(1)}% capacity used
                                            {isNearLimit && <span className="ml-2 font-semibold text-yellow-300">⚠️ Approaching limit</span>}
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap gap-4 pt-4 border-t border-white/20">
                                        <div className="flex items-center gap-2">
                                            <div className="p-2 bg-white/20 backdrop-blur-sm rounded-lg">
                                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <p className="text-xs text-white/70">Current Plan</p>
                                                <p className="text-lg font-bold text-white">{tenantStats.plan_name}</p>
                                            </div>
                                        </div>

                                        {tenantStats.days_left < 100 && (
                                            <div className="flex items-center gap-2">
                                                <div className="p-2 bg-white/20 backdrop-blur-sm rounded-lg">
                                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-white/70">Expires In</p>
                                                    <p className="text-lg font-bold text-white">{tenantStats.days_left} days</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="hidden lg:block">
                                <div className="relative">
                                    <div className="absolute inset-0 bg-white/20 rounded-full blur-2xl"></div>
                                    <div className="relative text-9xl opacity-30 group-hover:opacity-40 transition-opacity duration-300">
                                        👥
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Today's Metrics - New Section */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {/* Total Users */}
                    <div className="group relative overflow-hidden bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 animate-slide-up animation-delay-100">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-transparent rounded-bl-full"></div>
                        <div className="relative p-6">
                            <div className="flex items-start justify-between mb-4">
                                <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                    </svg>
                                </div>
                                <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                                    All Time
                                </span>
                            </div>
                            <h3 className="text-4xl font-black text-gray-800 mb-2 group-hover:text-blue-600 transition-colors">
                                {stats.totalUsers.toLocaleString()}
                            </h3>
                            <p className="text-gray-600 font-medium">Total Users</p>
                            <div className="mt-4 pt-4 border-t border-gray-100">
                                <p className="text-sm text-gray-500">
                                    <span className="text-green-600 font-semibold">+{stats.todaySignups}</span> today
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Active Users (7 days) */}
                    <div className="group relative overflow-hidden bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 animate-slide-up animation-delay-200">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-500/10 to-transparent rounded-bl-full"></div>
                        <div className="relative p-6">
                            <div className="flex items-start justify-between mb-4">
                                <div className="p-3 bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                                    7 Days
                                </span>
                            </div>
                            <h3 className="text-4xl font-black text-gray-800 mb-2 group-hover:text-green-600 transition-colors">
                                {stats.activeUsers.toLocaleString()}
                            </h3>
                            <p className="text-gray-600 font-medium">Active Users</p>
                            <div className="mt-4 pt-4 border-t border-gray-100">
                                <p className="text-sm text-gray-500">
                                    <span className="text-green-600 font-semibold">{activeRate}%</span> of total
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Today's Active Users */}
                    <div className="group relative overflow-hidden bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 animate-slide-up animation-delay-300">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/10 to-transparent rounded-bl-full"></div>
                        <div className="relative p-6">
                            <div className="flex items-start justify-between mb-4">
                                <div className="p-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">
                                    Today
                                </span>
                            </div>
                            <h3 className="text-4xl font-black text-gray-800 mb-2 group-hover:text-purple-600 transition-colors">
                                {stats.todayActiveUsers.toLocaleString()}
                            </h3>
                            <p className="text-gray-600 font-medium">Active Today</p>
                            <div className="mt-4 pt-4 border-t border-gray-100">
                                <p className="text-sm text-gray-500">
                                    Users logged in today
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Today's Signups */}
                    <div className="group relative overflow-hidden bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 animate-slide-up animation-delay-400">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-orange-500/10 to-transparent rounded-bl-full"></div>
                        <div className="relative p-6">
                            <div className="flex items-start justify-between mb-4">
                                <div className="p-3 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                    </svg>
                                </div>
                                <span className="px-3 py-1 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full">
                                    New
                                </span>
                            </div>
                            <h3 className="text-4xl font-black text-gray-800 mb-2 group-hover:text-orange-600 transition-colors">
                                {stats.todaySignups.toLocaleString()}
                            </h3>
                            <p className="text-gray-600 font-medium">New Signups</p>
                            <div className="mt-4 pt-4 border-t border-gray-100">
                                <p className="text-sm text-gray-500">
                                    <span className="text-green-600 font-semibold">+{todayGrowth}%</span> growth
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Charts Section */}
            {stats?.signupTrends && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                    {/* Main Chart */}
                    <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg p-6 animate-slide-up animation-delay-500">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                            <div>
                                <h3 className="text-2xl font-bold text-gray-800">User Signup Trends</h3>
                                <p className="text-gray-600 text-sm mt-1">Track new user registrations over time</p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setChartView('daily')}
                                    className={`px-4 py-2 rounded-lg font-medium transition-all ${chartView === 'daily'
                                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                >
                                    Daily
                                </button>
                                <button
                                    onClick={() => setChartView('weekly')}
                                    className={`px-4 py-2 rounded-lg font-medium transition-all ${chartView === 'weekly'
                                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                >
                                    Weekly
                                </button>
                                <button
                                    onClick={() => setChartView('monthly')}
                                    className={`px-4 py-2 rounded-lg font-medium transition-all ${chartView === 'monthly'
                                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                >
                                    Monthly
                                </button>
                            </div>
                        </div>

                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={currentChartData}>
                                <defs>
                                    <linearGradient id="colorSignups" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#6366F1" stopOpacity={0.3} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                <XAxis
                                    dataKey="label"
                                    stroke="#6B7280"
                                    style={{ fontSize: '12px' }}
                                />
                                <YAxis
                                    stroke="#6B7280"
                                    style={{ fontSize: '12px' }}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'white',
                                        border: 'none',
                                        borderRadius: '12px',
                                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                                    }}
                                />
                                <Bar
                                    dataKey="value"
                                    fill="url(#colorSignups)"
                                    radius={[8, 8, 0, 0]}
                                    name="New Signups"
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Contacts Card */}
                    <div className="bg-gradient-to-br from-pink-500 to-rose-600 rounded-2xl shadow-lg p-6 text-white animate-slide-up animation-delay-600">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            </div>
                            <h3 className="text-2xl font-bold">Total Contacts</h3>
                        </div>

                        <div className="mb-6">
                            <h2 className="text-6xl font-black mb-2">{stats.contacts.toLocaleString()}</h2>
                            <p className="text-white/80">Contacts in database</p>
                        </div>

                        <div className="space-y-3 pt-6 border-t border-white/20">
                            <div className="flex justify-between items-center">
                                <span className="text-white/80">Avg per user</span>
                                <span className="font-bold text-lg">
                                    {stats.totalUsers > 0 ? Math.round(stats.contacts / stats.totalUsers) : 0}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-white/80">Growth trend</span>
                                <span className="font-bold text-lg">
                                    {stats.todaySignups > 0 ? '📈 Active' : '📊 Stable'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Actions Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-slide-up animation-delay-700">
                {/* Recent Activity Card */}
                <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-300">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-bold text-gray-800">Recent Activity</h3>
                        <button className="text-blue-600 hover:text-blue-700 font-medium text-sm">View All →</button>
                    </div>
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex items-start gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                                <div className="p-2 bg-blue-100 rounded-lg">
                                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-800">New user registered</p>
                                    <p className="text-xs text-gray-500">2 minutes ago</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Performance Overview */}
                <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl shadow-lg p-6 text-white hover:shadow-xl transition-shadow duration-300">
                    <h3 className="text-xl font-bold mb-6">Performance Overview</h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-white/80">Response Time</span>
                            <span className="font-bold text-lg">1.2s</span>
                        </div>
                        <div className="w-full bg-white/20 rounded-full h-2">
                            <div className="bg-white rounded-full h-2 w-3/4"></div>
                        </div>

                        <div className="flex justify-between items-center mt-4">
                            <span className="text-white/80">Uptime</span>
                            <span className="font-bold text-lg">99.9%</span>
                        </div>
                        <div className="w-full bg-white/20 rounded-full h-2">
                            <div className="bg-green-400 rounded-full h-2 w-full"></div>
                        </div>

                        <div className="flex justify-between items-center mt-4">
                            <span className="text-white/80">Success Rate</span>
                            <span className="font-bold text-lg">98.5%</span>
                        </div>
                        <div className="w-full bg-white/20 rounded-full h-2">
                            <div className="bg-yellow-400 rounded-full h-2 w-11/12"></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Custom Animations */}
            <style>{`
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                
                @keyframes slide-up {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                
                @keyframes blob {
                    0%, 100% { transform: translate(0, 0) scale(1); }
                    33% { transform: translate(30px, -50px) scale(1.1); }
                    66% { transform: translate(-20px, 20px) scale(0.9); }
                }
                
                .animate-fade-in {
                    animation: fade-in 0.6s ease-out;
                }
                
                .animate-slide-up {
                    animation: slide-up 0.6s ease-out;
                }
                
                .animate-blob {
                    animation: blob 7s infinite;
                }
                
                .animation-delay-100 {
                    animation-delay: 100ms;
                }
                
                .animation-delay-200 {
                    animation-delay: 200ms;
                }
                
                .animation-delay-300 {
                    animation-delay: 300ms;
                }
                
                .animation-delay-400 {
                    animation-delay: 400ms;
                }
                
                .animation-delay-500 {
                    animation-delay: 500ms;
                }
                
                .animation-delay-600 {
                    animation-delay: 600ms;
                }
                
                .animation-delay-700 {
                    animation-delay: 700ms;
                }
                
                .animation-delay-2000 {
                    animation-delay: 2s;
                }
                
                .animation-delay-4000 {
                    animation-delay: 4s;
                }
            `}</style>
        </div>
    );
};

export default Dashboard;
