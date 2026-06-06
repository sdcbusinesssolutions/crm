import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import GlobalRatesModal from './dashboard/GlobalRatesModal';
import DomainWalletSettingsModal from './dashboard/DomainWalletSettingsModal';

interface TenantSummary {
    domain: string;
    brand_name: string;
    user_count: number;
    user_limit: number;
    plan_name: string;
    plan_status: string;
    plan_expires_at: string;
    wallet_balance?: number;
    wallet_enforced?: boolean;
    admin_email: string;
    default_billing_mode?: string;
    allow_tenant_billing_control?: boolean;
}

const SuperDashboard: React.FC = () => {
    const [tenants, setTenants] = useState<TenantSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingDomain, setEditingDomain] = useState<string | null>(null);
    const [newLimit, setNewLimit] = useState<number>(10);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isGlobalRatesModalOpen, setIsGlobalRatesModalOpen] = useState(false);
    const [newTenantDomain, setNewTenantDomain] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isWalletSettingsOpen, setIsWalletSettingsOpen] = useState(false);
    const [walletSettingsDomain, setWalletSettingsDomain] = useState('');

    const fetchTenants = async () => {
        try {
            const token = localStorage.getItem('adminToken');
            const res = await fetch('/api/admin/dashboard/tenants', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!res.ok) throw new Error('Failed to fetch tenants');
            const data = await res.json();
            setTenants(data);
        } catch (err) {
            console.error('Failed to load tenants:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTenants();
    }, []);

    const impersonate = async (domain: string) => {
        try {
            const token = localStorage.getItem('adminToken');
            const res = await fetch('/api/admin/auth/impersonate-admin', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ targetDomain: domain })
            });
            const data = await res.json();
            if (data.success && data.url) {
                window.open(data.url, '_blank');
            } else {
                alert('Failed to generate link: ' + data.message);
            }
        } catch (e) {
            alert('Error impersonating');
        }
    };

    const addNewTenant = async () => {
        if (!newTenantDomain) return;
        try {
            const token = localStorage.getItem('adminToken');
            const res = await fetch('/api/admin/dashboard/tenants/add', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    domain: newTenantDomain,
                    user_limit: 10,
                    plan_name: 'Free'
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to add tenant');
            }

            fetchTenants();
            setIsAddModalOpen(false);
            setNewTenantDomain('');
        } catch (e: any) {
            alert('Failed to add tenant: ' + e.message);
        }
    };

    const openEditModal = (domain: string, currentLimit: number) => {
        setEditingDomain(domain);
        setNewLimit(currentLimit);
    };

    const saveLimit = async () => {
        if (!editingDomain) return;
        try {
            const token = localStorage.getItem('adminToken');
            const res = await fetch('/api/admin/dashboard/tenants/limit', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    target_domain: editingDomain,
                    new_limit: parseInt(newLimit.toString())
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to update limit');
            }

            fetchTenants();
            setEditingDomain(null);
        } catch (e: any) {
            alert('Failed to update limit: ' + e.message);
        }
    };

    const deleteTenant = async (domain: string) => {
        if (!confirm(`Are you sure you want to completely delete ${domain} and all its data?`)) return;
        try {
            const token = localStorage.getItem('adminToken');
            const res = await fetch('/api/admin/dashboard/tenants/delete', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ target_domain: domain })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to delete tenant');
            }

            fetchTenants();
        } catch (e: any) {
            alert('Failed to delete tenant: ' + e.message);
        }
    };

    const filteredTenants = tenants.filter(t =>
        t.domain.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.brand_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const totalUsers = tenants.reduce((sum, t) => sum + t.user_count, 0);
    const activeTenants = tenants.filter(t => t.plan_status === 'active').length;
    const nearLimitTenants = tenants.filter(t => (t.user_count / t.user_limit) >= 0.8).length;

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-pink-50">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-purple-600"></div>
                    <p className="mt-4 text-gray-600 font-medium">Loading Super Dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-pink-50 p-4 md:p-8">
            {/* Header Section */}
            <div className="mb-8 animate-fade-in">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div>
                        <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 bg-clip-text text-transparent mb-2">
                            Super Admin Dashboard
                        </h1>
                        <p className="text-gray-600 text-lg">Manage all tenants and monitor system-wide metrics</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsGlobalRatesModalOpen(true)}
                            className="group relative px-6 py-3 bg-white text-brand-600 border border-slate-200 rounded-xl font-semibold shadow-sm hover:shadow-md hover:border-brand-300 transition-all duration-300 hover:scale-105 overflow-hidden"
                        >
                            <span className="relative z-10 flex items-center gap-2">
                                🪙 Global Rates
                            </span>
                        </button>
                        <button
                            onClick={() => setIsAddModalOpen(true)}
                        className="group relative px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 overflow-hidden"
                    >
                        <span className="relative z-10 flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add New Tenant
                        </span>
                        <div className="absolute inset-0 bg-gradient-to-r from-pink-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    </button>
                    </div>
                </div>

                {/* Stats Overview Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                            </div>
                            <span className="text-3xl font-black text-gray-800">{tenants.length}</span>
                        </div>
                        <p className="text-gray-600 font-medium">Total Tenants</p>
                    </div>

                    <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-gradient-to-br from-green-500 to-green-600 rounded-xl">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <span className="text-3xl font-black text-gray-800">{activeTenants}</span>
                        </div>
                        <p className="text-gray-600 font-medium">Active Tenants</p>
                    </div>

                    <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                            </div>
                            <span className="text-3xl font-black text-gray-800">{totalUsers}</span>
                        </div>
                        <p className="text-gray-600 font-medium">Total Users</p>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="bg-white rounded-2xl shadow-lg p-4">
                    <div className="relative">
                        <svg className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Search tenants by domain or brand name..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none transition-colors"
                        />
                    </div>
                </div>
            </div>

            {/* ADD TENANT MODAL */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md transform transition-all animate-scale-in">
                        <div className="p-6 border-b border-gray-200">
                            <h3 className="text-2xl font-bold text-gray-800">Register New Tenant</h3>
                            <p className="text-gray-600 mt-2">Enter the domain name for the new tenant</p>
                        </div>
                        <div className="p-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Domain Name</label>
                            <input
                                type="text"
                                className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-purple-500 focus:outline-none transition-colors"
                                placeholder="example.com"
                                value={newTenantDomain}
                                onChange={(e) => setNewTenantDomain(e.target.value)}
                            />
                        </div>
                        <div className="p-6 bg-gray-50 rounded-b-2xl flex justify-end gap-3">
                            <button
                                onClick={() => setIsAddModalOpen(false)}
                                className="px-6 py-2.5 text-gray-700 hover:bg-gray-200 rounded-xl font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={addNewTenant}
                                className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:from-purple-700 hover:to-pink-700 transition-colors shadow-lg hover:shadow-xl"
                            >
                                Add Tenant
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isGlobalRatesModalOpen && (
                <GlobalRatesModal 
                    isOpen={isGlobalRatesModalOpen} 
                    onClose={() => setIsGlobalRatesModalOpen(false)} 
                    onSuccess={() => {}} 
                />
            )}

            {/* EDIT LIMIT MODAL */}
            {editingDomain && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md transform transition-all animate-scale-in">
                        <div className="p-6 border-b border-gray-200">
                            <h3 className="text-2xl font-bold text-gray-800">Edit User Limit</h3>
                            <p className="text-gray-600 mt-2">Set maximum users for <span className="font-semibold text-purple-600">{editingDomain}</span></p>
                        </div>
                        <div className="p-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">User Limit</label>
                            <input
                                type="number"
                                className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-purple-500 focus:outline-none transition-colors"
                                value={newLimit}
                                onChange={(e) => setNewLimit(parseInt(e.target.value))}
                            />
                        </div>
                        <div className="p-6 bg-gray-50 rounded-b-2xl flex justify-end gap-3">
                            <button
                                onClick={() => setEditingDomain(null)}
                                className="px-6 py-2.5 text-gray-700 hover:bg-gray-200 rounded-xl font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={saveLimit}
                                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium hover:shadow-lg transition-all"
                            >
                                Save Limit
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isWalletSettingsOpen && (
                <DomainWalletSettingsModal
                    isOpen={isWalletSettingsOpen}
                    onClose={() => setIsWalletSettingsOpen(false)}
                    domain={walletSettingsDomain}
                    onSuccess={() => {
                        // Settings saved, they don't affect table directly but it's good UX
                        fetchTenants();
                    }}
                />
            )}

            {/* Tenants Table */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gradient-to-r from-purple-50 to-pink-50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Domain</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Brand</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Users / Limit</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Wallet</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Plan Status</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredTenants.map((t) => {
                                const usagePercent = (t.user_count / t.user_limit) * 100;
                                const isNearLimit = usagePercent >= 80;

                                return (
                                    <tr key={t.domain} className="hover:bg-purple-50/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <div className="p-2 bg-purple-100 rounded-lg">
                                                    <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                                                    </svg>
                                                </div>
                                                <span className="text-sm font-semibold text-gray-900">{t.domain}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{t.brand_name || 'N/A'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-3">
                                                <div className="flex-1">
                                                    <div className="flex items-baseline gap-1 mb-1">
                                                        <span className={`text-sm font-bold ${isNearLimit ? 'text-red-600' : 'text-green-600'}`}>
                                                            {t.user_count}
                                                        </span>
                                                        <span className="text-xs text-gray-400">/ {t.user_limit}</span>
                                                    </div>
                                                    <div className="w-24 bg-gray-200 rounded-full h-1.5">
                                                        <div
                                                            className={`h-1.5 rounded-full transition-all ${isNearLimit ? 'bg-red-500' : 'bg-green-500'}`}
                                                            style={{ width: `${Math.min(usagePercent, 100)}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => openEditModal(t.domain, t.user_limit)}
                                                    className="text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline"
                                                >
                                                    Edit
                                                </button>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-sm font-bold text-gray-900">₹{Number(t.wallet_balance || 0).toFixed(2)}</span>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full w-fit ${t.wallet_enforced ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                        {t.wallet_enforced ? 'ENFORCED' : 'REPORT ONLY'}
                                                    </span>
                                                    {t.default_billing_mode === 'DIRECT_META' && (
                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full w-fit bg-blue-100 text-blue-700">💳 Direct</span>
                                                    )}
                                                    {t.default_billing_mode === 'CREDIT_LINE_TENANT' && (
                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full w-fit bg-purple-100 text-purple-700">🏢 Tenant</span>
                                                    )}
                                                    {t.default_billing_mode === 'CREDIT_LINE_SUPER' && (
                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full w-fit bg-slate-100 text-slate-700">🏛 Super</span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div>
                                                <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${t.plan_status === 'active'
                                                        ? 'bg-green-100 text-green-800'
                                                        : 'bg-red-100 text-red-800'
                                                    }`}>
                                                    {t.plan_status}
                                                </span>
                                                <div className="text-xs text-gray-500 mt-1">{t.plan_name}</div>
                                                {t.plan_expires_at && (
                                                    <div className="text-xs text-gray-400 mt-1">
                                                        Exp: {new Date(t.plan_expires_at).toLocaleDateString()}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => {
                                                        setWalletSettingsDomain(t.domain);
                                                        setIsWalletSettingsOpen(true);
                                                    }}
                                                    className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors font-medium"
                                                >
                                                    Wallet Config
                                                </button>
                                                <button
                                                    onClick={() => impersonate(t.domain)}
                                                    className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors font-medium"
                                                >
                                                    Impersonate
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (confirm(`Are you sure you want to PERMANENTLY DELETE tenant ${t.domain}? This cannot be undone.`)) {
                                                            deleteTenant(t.domain);
                                                        }
                                                    }}
                                                    className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors font-medium"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {filteredTenants.length === 0 && (
                    <div className="text-center py-12">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
                        <h3 className="mt-2 text-sm font-medium text-gray-900">No tenants found</h3>
                        <p className="mt-1 text-sm text-gray-500">Try adjusting your search query</p>
                    </div>
                )}
            </div>

            {/* Custom Animations */}
            <style>{`
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                
                @keyframes scale-in {
                    from {
                        opacity: 0;
                        transform: scale(0.95);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1);
                    }
                }
                
                .animate-fade-in {
                    animation: fade-in 0.3s ease-out;
                }
                
                .animate-scale-in {
                    animation: scale-in 0.3s ease-out;
                }
            `}</style>
        </div>
    );
};

export default SuperDashboard;
