import React, { useState, useEffect } from 'react';

interface FeatureLimit {
    id: string;
    feature_name: string;
    target_type: 'USER' | 'DOMAIN';
    target_id: string;
    max_limit: number;
    updated_at: string;
}

const FeatureLimitsManager: React.FC = () => {
    const [limits, setLimits] = useState<FeatureLimit[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedFeature, setSelectedFeature] = useState('STAFF');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        target_type: 'USER',
        target_id: '',
        max_limit: 10
    });
    
    const [lookupData, setLookupData] = useState<{users: any[], domains: any[]}>({ users: [], domains: [] });
    const [domainFilter, setDomainFilter] = useState('');
    const [features, setFeatures] = useState<string[]>(['STAFF']);

    const fetchFeatures = async () => {
        try {
            console.log('[FeatureLimitsManager] Fetching features...');
            const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
            const res = await fetch('/api/admin/limits/features?_cb=' + Date.now(), {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            console.log('[FeatureLimitsManager] Fetch features status:', res.status);
            if (res.ok) {
                const data = await res.json();
                console.log('[FeatureLimitsManager] Features data:', data);
                if (Array.isArray(data) && data.length > 0) {
                    // Only show STAFF as requested
                    const filteredData = data.filter((f: string) => f === 'STAFF');
                    setFeatures(filteredData.length > 0 ? filteredData : ['STAFF']);
                }
            } else {
                console.error('[FeatureLimitsManager] Failed to fetch features, status:', res.status, await res.text());
            }
        } catch (error) {
            console.error('[FeatureLimitsManager] Error fetching features:', error);
        }
    };

    const fetchLookupData = async () => {
        try {
            const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
            const url = domainFilter ? `/api/admin/limits/targets/lookup?domain=${domainFilter}` : '/api/admin/limits/targets/lookup';
            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setLookupData(data);
            }
        } catch (error) {
            console.error('Error fetching lookup data', error);
        }
    };

    const fetchLimits = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
            const res = await fetch(`/api/admin/limits/${selectedFeature}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.ok) {
                const data = await res.json();
                setLimits(data);
            } else {
                console.error('Failed to fetch limits', await res.text());
            }
        } catch (error) {
            console.error('Error fetching limits:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFeatures();
    }, []);

    useEffect(() => {
        fetchLimits();
    }, [selectedFeature]);

    useEffect(() => {
        fetchLookupData();
    }, [domainFilter]);

    const handleSaveLimit = async () => {
        if (!formData.target_id) return alert('Target ID is required');

        try {
            const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
            const res = await fetch(`/api/admin/limits`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    feature_name: selectedFeature,
                    target_type: formData.target_type,
                    target_id: formData.target_id,
                    max_limit: formData.max_limit
                })
            });

            if (res.ok) {
                setIsModalOpen(false);
                setFormData({ ...formData, target_id: '' });
                fetchLimits();
            } else {
                const err = await res.json();
                alert(`Error: ${err.error}`);
            }
        } catch (error) {
            alert('Error saving limit');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to remove this limit override?')) return;

        try {
            const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
            const res = await fetch(`/api/admin/limits/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (res.ok) {
                fetchLimits();
            } else {
                alert('Failed to delete limit');
            }
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-lg p-6 mt-8 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Staff Limit Manager</h2>
                    <p className="text-gray-500">Override default limits for specific users or domains.</p>
                </div>
                
                <div className="flex items-center gap-4 mt-4 md:mt-0">
                    <select 
                        value={selectedFeature} 
                        onChange={(e) => setSelectedFeature(e.target.value)}
                        className="border-2 border-gray-200 rounded-lg px-4 py-2 focus:border-purple-500 outline-none"
                    >
                        {features.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>

                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium shadow-md hover:shadow-lg transition-all"
                    >
                        + Add Override
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-8 text-gray-500">Loading limits...</div>
            ) : limits.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
                    <p className="text-gray-500">No custom limits set for {selectedFeature}. Using defaults.</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Type</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Target ID</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Max Limit</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Last Updated</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {limits.map(limit => (
                                <tr key={limit.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${limit.target_type === 'USER' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                                            {limit.target_type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                                        {limit.target_id}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-purple-600">
                                        {limit.max_limit}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {new Date(limit.updated_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <button onClick={() => handleDelete(limit.id)} className="text-red-600 hover:text-red-900">Remove</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b border-gray-200 shrink-0">
                            <h3 className="text-xl font-bold text-gray-800">Add Limit Override</h3>
                            <p className="text-gray-500 text-sm mt-1">For Feature: <span className="font-bold text-purple-600">{selectedFeature}</span></p>
                        </div>
                        <div className="p-6 space-y-4 overflow-y-auto">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Target Type</label>
                                <select 
                                    className="w-full border-2 border-gray-200 rounded-xl p-2.5 outline-none focus:border-purple-500"
                                    value={formData.target_type}
                                    onChange={e => setFormData({ ...formData, target_type: e.target.value as 'USER' | 'DOMAIN' })}
                                >
                                    <option value="USER">Individual User (UUID)</option>
                                    <option value="DOMAIN">Domain Name (ID)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Target ID</label>
                                {formData.target_type === 'USER' ? (
                                    <>
                                        <select 
                                            className="w-full border-2 border-gray-200 rounded-xl p-2.5 outline-none focus:border-purple-500 text-sm mb-2"
                                            value={domainFilter}
                                            onChange={e => setDomainFilter(e.target.value)}
                                        >
                                            <option value="">-- All Domains (Filter) --</option>
                                            {lookupData.domains.map(d => (
                                                <option key={d.id || d.domain} value={d.domain}>
                                                    {d.domain}
                                                </option>
                                            ))}
                                        </select>
                                        <select 
                                            className="w-full border-2 border-gray-200 rounded-xl p-2.5 outline-none focus:border-purple-500 text-sm"
                                            value={formData.target_id}
                                            onChange={e => setFormData({ ...formData, target_id: e.target.value })}
                                        >
                                            <option value="">Select a User...</option>
                                            {lookupData.users.map(u => (
                                                <option key={u.id} value={u.id}>
                                                    {u.full_name || u.email} ({u.email}) - {u.signup_domain}
                                                </option>
                                            ))}
                                        </select>
                                    </>
                                ) : (
                                    <select 
                                        className="w-full border-2 border-gray-200 rounded-xl p-2.5 outline-none focus:border-purple-500 text-sm"
                                        value={formData.target_id}
                                        onChange={e => setFormData({ ...formData, target_id: e.target.value })}
                                    >
                                        <option value="">Select a Domain...</option>
                                        {lookupData.domains.length > 0 ? (
                                            lookupData.domains.map(d => (
                                                <option key={d.id} value={d.id}>
                                                    {d.domain}
                                                </option>
                                            ))
                                        ) : (
                                            // Fallback to typing if domains table isn't populated
                                            <option value="" disabled>No domains found in DB</option>
                                        )}
                                    </select>
                                )}
                                {/* Fallback manual input just in case */}
                                <input 
                                    type="text" 
                                    placeholder="Or paste UUID manually..."
                                    className="w-full border-2 border-gray-200 rounded-xl p-2.5 outline-none focus:border-purple-500 font-mono text-sm mt-2"
                                    value={formData.target_id}
                                    onChange={e => setFormData({ ...formData, target_id: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Max Limit</label>
                                <input 
                                    type="number" 
                                    className="w-full border-2 border-gray-200 rounded-xl p-2.5 outline-none focus:border-purple-500"
                                    value={formData.max_limit}
                                    onChange={e => setFormData({ ...formData, max_limit: parseInt(e.target.value) })}
                                />
                            </div>
                        </div>
                        <div className="p-6 bg-gray-50 rounded-b-2xl flex justify-end gap-3 shrink-0">
                            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-medium">Cancel</button>
                            <button onClick={handleSaveLimit} className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700">Save Override</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FeatureLimitsManager;
