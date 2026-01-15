import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

interface TenantSummary {
    domain: string;
    brand_name: string;
    user_count: number;
    user_limit: number;
    plan_name: string;
    plan_status: string;
    plan_expires_at: string;
    admin_email: string;
}

const SuperDashboard: React.FC = () => {
    const [tenants, setTenants] = useState<TenantSummary[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchTenants = async () => {
        try {
            // Call the RPC we just created
            const { data, error } = await supabase.rpc('get_all_tenants_summary' as any);
            if (error) throw error;
            setTenants(data as any);
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
            const token = localStorage.getItem('adminToken'); // Assuming Super Admin has this
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

    const [editingDomain, setEditingDomain] = useState<string | null>(null);
    const [newLimit, setNewLimit] = useState<number>(10);

    // New Tenant State
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newTenantDomain, setNewTenantDomain] = useState('');

    const addNewTenant = async () => {
        if (!newTenantDomain) return;
        try {
            const { error } = await supabase.rpc('add_new_tenant' as any, {
                new_domain: newTenantDomain,
                initial_limit: 10,
                plan_name: 'Free'
            } as any);

            if (error) throw error;

            fetchTenants();
            setIsAddModalOpen(false);
            setNewTenantDomain('');
        } catch (e) {
            alert('Failed to add tenant: ' + (e as Error).message);
        }
    };

    const openEditModal = (domain: string, currentLimit: number) => {
        setEditingDomain(domain);
        setNewLimit(currentLimit);
    };

    const saveLimit = async () => {
        if (!editingDomain) return;
        try {
            const { error } = await supabase.rpc('update_tenant_limit' as any, {
                target_domain: editingDomain,
                new_limit: newLimit
            } as any);
            if (error) throw error;

            // Refresh
            fetchTenants();
            setEditingDomain(null);
        } catch (e) {
            alert('Failed to update limit: ' + (e as Error).message);
        }
    };

    if (loading) return <div className="p-8">Loading Super Dashboard...</div>;

    return (
        <div className="p-8 bg-gray-50 min-h-screen">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Super Admin Dashboard</h1>
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 font-medium"
                >
                    + Add New Tenant
                </button>
            </div>

            {/* ADD TENANT MODAL */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-96">
                        <h3 className="text-xl font-bold mb-4">Register New Tenant</h3>
                        <p className="text-gray-600 mb-2 text-sm">Enter the domain name (e.g. myclient.com)</p>

                        <input
                            type="text"
                            className="w-full border p-2 rounded mb-4"
                            placeholder="example.com"
                            value={newTenantDomain}
                            onChange={(e) => setNewTenantDomain(e.target.value)}
                        />

                        <div className="flex justify-end gap-2">
                            <button onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                            <button onClick={addNewTenant} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Add Tenant</button>
                        </div>
                    </div>
                </div>
            )}


            {/* EDIT LIMIT MODAL */}
            {editingDomain && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-96">
                        <h3 className="text-xl font-bold mb-4">Edit User Limit</h3>
                        <p className="text-gray-600 mb-4">Set max users for <b>{editingDomain}</b></p>

                        <input
                            type="number"
                            className="w-full border p-2 rounded mb-4"
                            value={newLimit}
                            onChange={(e) => setNewLimit(parseInt(e.target.value))}
                        />

                        <div className="flex justify-end gap-2">
                            <button onClick={() => setEditingDomain(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                            <button onClick={saveLimit} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Save Limit</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Domain</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Brand</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Users / Limit</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plan Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {tenants.map((t) => (
                            <tr key={t.domain} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{t.domain}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{t.brand_name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    <span className={`font-bold ${t.user_count >= t.user_limit ? 'text-red-600' : 'text-green-600'}`}>
                                        {t.user_count}
                                    </span>
                                    <span className="text-gray-400"> / {t.user_limit}</span>
                                    <button
                                        onClick={() => openEditModal(t.domain, t.user_limit)}
                                        className="ml-2 text-xs text-blue-500 hover:underline"
                                    >
                                        Edit
                                    </button>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${t.plan_status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                        }`}>
                                        {t.plan_status} ({t.plan_name})
                                    </span>
                                    {t.plan_expires_at && (
                                        <div className="text-xs text-gray-400 mt-1">Exp: {new Date(t.plan_expires_at).toLocaleDateString()}</div>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    <button
                                        onClick={() => impersonate(t.domain)}
                                        className="text-indigo-600 hover:text-indigo-900 mr-4"
                                    >
                                        Impersonate Admin
                                    </button>
                                    <button className="text-gray-400 hover:text-gray-600" onClick={() => alert('Feature coming soon: Edit Plan')}>
                                        Edit Plan
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default SuperDashboard;
