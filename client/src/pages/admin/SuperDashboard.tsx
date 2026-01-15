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

    if (loading) return <div className="p-8">Loading Super Dashboard...</div>;

    return (
        <div className="p-8 bg-gray-50 min-h-screen">
            <h1 className="text-3xl font-bold mb-6 text-gray-800">Super Admin Dashboard</h1>

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
