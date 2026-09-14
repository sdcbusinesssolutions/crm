import React, { useState, useEffect } from 'react';
import Toast from '../../components/Toast';

interface Rate {
    id?: string;
    scope: string;
    user_id: string | null;
    category: string;
    country_code: string;
    meta_cost: number;
    platform_rate: number;
    currency?: string;
    is_active: boolean;
}

interface GroupedCountryRates {
    country_code: string;
    is_active: boolean;
    MARKETING: Rate | null;
    UTILITY: Rate | null;
    AUTHENTICATION: Rate | null;
    SERVICE: Rate | null;
}

const CATEGORIES = ['MARKETING', 'UTILITY', 'AUTHENTICATION', 'SERVICE'] as const;

const PricingManager = () => {
    const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info' | 'warning', title: string, message: string } | null>(null);
    const [groupedRates, setGroupedRates] = useState<Record<string, GroupedCountryRates>>({});
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [selectedCurrency, setSelectedCurrency] = useState('INR');
    const AVAILABLE_CURRENCIES = ['INR'];

    // Form state
    const [formData, setFormData] = useState({
        country_code: '',
        is_active: true,
        MARKETING: { meta_cost: 0, platform_rate: 0 },
        UTILITY: { meta_cost: 0, platform_rate: 0 },
        AUTHENTICATION: { meta_cost: 0, platform_rate: 0 },
        SERVICE: { meta_cost: 0, platform_rate: 0 },
    });

    const fetchRates = async (currency: string) => {
        try {
            setLoading(true);
            const token = localStorage.getItem('adminToken');
            const res = await fetch(`/api/admin/pricing?currency=${currency}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const { data } = await res.json();
            
            const grouped: Record<string, GroupedCountryRates> = {};
            
            (data || []).forEach((rate: Rate) => {
                if (rate.scope !== 'GLOBAL') return;
                
                if (!grouped[rate.country_code]) {
                    grouped[rate.country_code] = {
                        country_code: rate.country_code,
                        is_active: rate.is_active,
                        MARKETING: null,
                        UTILITY: null,
                        AUTHENTICATION: null,
                        SERVICE: null
                    };
                }
                
                // If any category is active, we consider the country active
                if (rate.is_active) {
                    grouped[rate.country_code].is_active = true;
                }
                
                if (CATEGORIES.includes(rate.category as any)) {
                    grouped[rate.country_code][rate.category as keyof GroupedCountryRates] = rate as any;
                }
            });
            
            setGroupedRates(grouped);
        } catch (error) {
            setToast({ type: 'error', title: 'Error', message: 'Failed to load rates' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRates(selectedCurrency);
    }, [selectedCurrency]);

    const openAddModal = () => {
        setIsEditing(false);
        setFormData({
            country_code: '',
            is_active: true,
            MARKETING: { meta_cost: 0, platform_rate: 0 },
            UTILITY: { meta_cost: 0, platform_rate: 0 },
            AUTHENTICATION: { meta_cost: 0, platform_rate: 0 },
            SERVICE: { meta_cost: 0, platform_rate: 0 },
        });
        setIsModalOpen(true);
    };

    const openEditModal = (countryCode: string) => {
        const countryData = groupedRates[countryCode];
        setIsEditing(true);
        setFormData({
            country_code: countryCode,
            is_active: countryData.is_active,
            MARKETING: { 
                meta_cost: countryData.MARKETING?.meta_cost || 0, 
                platform_rate: countryData.MARKETING?.platform_rate || 0 
            },
            UTILITY: { 
                meta_cost: countryData.UTILITY?.meta_cost || 0, 
                platform_rate: countryData.UTILITY?.platform_rate || 0 
            },
            AUTHENTICATION: { 
                meta_cost: countryData.AUTHENTICATION?.meta_cost || 0, 
                platform_rate: countryData.AUTHENTICATION?.platform_rate || 0 
            },
            SERVICE: { 
                meta_cost: countryData.SERVICE?.meta_cost || 0, 
                platform_rate: countryData.SERVICE?.platform_rate || 0 
            }
        });
        setIsModalOpen(true);
    };

    const handleCategoryChange = (category: string, field: 'meta_cost' | 'platform_rate', value: string) => {
        const numValue = parseFloat(value) || 0;
        setFormData(prev => ({
            ...prev,
            [category]: {
                ...prev[category as keyof typeof prev],
                [field]: numValue
            }
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.country_code.trim()) {
            setToast({ type: 'warning', title: 'Validation', message: 'Country code is required' });
            return;
        }

        try {
            const token = localStorage.getItem('adminToken');
            
            const ratesToSave = CATEGORIES.map(cat => ({
                scope: 'GLOBAL',
                category: cat,
                country_code: formData.country_code.toUpperCase(),
                meta_cost: (formData as any)[cat].meta_cost,
                platform_rate: (formData as any)[cat].platform_rate,
                is_active: formData.is_active
            }));

            const res = await fetch('/api/admin/pricing/bulk', {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ rates: ratesToSave, currency: selectedCurrency })
            });

            if (!res.ok) throw new Error('Failed to save rates');
            
            setToast({ type: 'success', title: 'Success', message: `Rates for ${formData.country_code.toUpperCase()} saved successfully` });
            setIsModalOpen(false);
            fetchRates(selectedCurrency);
        } catch (error) {
            setToast({ type: 'error', title: 'Error', message: 'Error saving rates' });
        }
    };

    // To delete a country, we have to delete all its global rates
    const handleDeleteCountry = async (countryCode: string) => {
        if (!confirm(`Are you sure you want to delete ALL rates for ${countryCode}? Messages to this country might fail if no active rate exists.`)) return;
        
        try {
            const countryData = groupedRates[countryCode];
            const idsToDelete = [
                countryData.MARKETING?.id,
                countryData.UTILITY?.id,
                countryData.AUTHENTICATION?.id,
                countryData.SERVICE?.id
            ].filter(Boolean) as string[];

            const token = localStorage.getItem('adminToken');
            
            // Delete sequentially or via a Promise.all
            await Promise.all(idsToDelete.map(id => 
                fetch(`/api/admin/pricing/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            ));
            
            setToast({ type: 'success', title: 'Deleted', message: `Rates for ${countryCode} deleted successfully` });
            fetchRates(selectedCurrency);
        } catch (error) {
            setToast({ type: 'error', title: 'Error', message: 'Failed to delete country rates' });
        }
    };

    const groupedArray = Object.values(groupedRates).sort((a, b) => a.country_code.localeCompare(b.country_code));

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Pricing & Countries</h1>
                    <p className="text-sm text-slate-500 mt-1">Manage allowed countries and WhatsApp message rates.</p>
                </div>
                <button 
                    onClick={openAddModal}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors shadow-sm"
                >
                    + Add Country
                </button>
            </div>

            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 rounded-r-lg shadow-sm">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <span className="text-yellow-400 text-xl">⚠️</span>
                    </div>
                    <div className="ml-3">
                        <h3 className="text-sm font-medium text-yellow-800">Strict Allow-List Mode Active</h3>
                        <div className="mt-1 text-sm text-yellow-700">
                            Users can ONLY send messages to the countries listed below with an <b>Active</b> status. Messages to any other country will be instantly blocked.
                        </div>
                    </div>
                </div>
            </div>

            {/* Currency Tabs */}
            <div className="flex overflow-x-auto gap-2 mb-4 pb-2 scrollbar-hide">
                {AVAILABLE_CURRENCIES.map(currency => (
                    <button
                        key={currency}
                        onClick={() => setSelectedCurrency(currency)}
                        className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${
                            selectedCurrency === currency 
                            ? 'bg-brand-600 text-white shadow-sm' 
                            : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                        }`}
                    >
                        {currency}
                    </button>
                ))}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-xs border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3">Country Code</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Marketing (Platform / Meta)</th>
                                <th className="px-4 py-3">Utility (Platform / Meta)</th>
                                <th className="px-4 py-3">Auth (Platform / Meta)</th>
                                <th className="px-4 py-3">Service (Platform / Meta)</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan={7} className="text-center py-8 text-slate-400">Loading...</td></tr>
                            ) : groupedArray.length === 0 ? (
                                <tr><td colSpan={7} className="text-center py-8 text-slate-400">No countries configured.</td></tr>
                            ) : (
                                groupedArray.map(country => (
                                    <tr key={country.country_code} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-4 font-bold text-slate-800">{country.country_code}</td>
                                        <td className="px-4 py-4">
                                            {country.is_active ? (
                                                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Allowed
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded-full">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Blocked
                                                </span>
                                            )}
                                        </td>
                                        
                                        {[country.MARKETING, country.UTILITY, country.AUTHENTICATION, country.SERVICE].map((rate, idx) => (
                                            <td key={idx} className="px-4 py-4">
                                                {rate ? (
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-emerald-600">₹{Number(rate.platform_rate).toFixed(4)}</span>
                                                        <span className="text-xs text-slate-400">Meta: ₹{Number(rate.meta_cost).toFixed(4)}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-300">-</span>
                                                )}
                                            </td>
                                        ))}

                                        <td className="px-4 py-4 text-right whitespace-nowrap">
                                            <button onClick={() => openEditModal(country.country_code)} className="text-blue-600 hover:text-blue-800 mr-3 font-medium">Edit</button>
                                            <button onClick={() => handleDeleteCountry(country.country_code)} className="text-rose-500 hover:text-rose-700 font-medium">Delete</button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Bulk Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="text-lg font-bold text-slate-800">{isEditing ? `Edit Rates for ${formData.country_code}` : 'Add New Country'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto">
                            <form id="bulkPricingForm" onSubmit={handleSubmit} className="space-y-6">
                                
                                <div className="flex items-start gap-6 border-b border-slate-100 pb-6">
                                    <div className="flex-1">
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Country Code (e.g. IN)</label>
                                        <input 
                                            type="text" 
                                            required 
                                            maxLength={2}
                                            value={formData.country_code}
                                            onChange={e => setFormData({...formData, country_code: e.target.value.toUpperCase()})}
                                            className="w-48 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none uppercase"
                                            placeholder="IN"
                                            disabled={isEditing} 
                                        />
                                        {isEditing && <p className="text-xs text-slate-400 mt-1">Country code cannot be changed after creation.</p>}
                                    </div>
                                    <div className="flex-1 pt-6">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={formData.is_active}
                                                onChange={e => setFormData({...formData, is_active: e.target.checked})}
                                                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                            />
                                            <span className="text-sm font-bold text-slate-700">Allow traffic to this country (Active)</span>
                                        </label>
                                        <p className="text-xs text-slate-500 ml-6 mt-1">Uncheck to strictly block messages to this country globally.</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="font-bold text-slate-700">Message Category Rates</h4>
                                    
                                    <div className="grid grid-cols-12 gap-4 text-xs font-bold text-slate-500 uppercase px-4">
                                        <div className="col-span-4">Category</div>
                                        <div className="col-span-4">Meta Cost (₹)</div>
                                        <div className="col-span-4">Platform Rate (₹)</div>
                                    </div>

                                    {CATEGORIES.map(category => (
                                        <div key={category} className="grid grid-cols-12 gap-4 items-center bg-slate-50 p-4 rounded-lg border border-slate-100">
                                            <div className="col-span-4">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                    category === 'MARKETING' ? 'bg-purple-100 text-purple-700' :
                                                    category === 'UTILITY' ? 'bg-blue-100 text-blue-700' :
                                                    category === 'AUTHENTICATION' ? 'bg-amber-100 text-amber-700' :
                                                    'bg-slate-200 text-slate-700'
                                                }`}>
                                                    {category}
                                                </span>
                                            </div>
                                            <div className="col-span-4 relative">
                                                <span className="absolute left-3 top-2.5 text-slate-400 font-medium">₹</span>
                                                <input 
                                                    type="number" 
                                                    step="0.0001" 
                                                    required 
                                                    value={(formData as any)[category].meta_cost}
                                                    onChange={e => handleCategoryChange(category, 'meta_cost', e.target.value)}
                                                    className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                                />
                                            </div>
                                            <div className="col-span-4 relative">
                                                <span className="absolute left-3 top-2.5 text-emerald-600 font-bold">₹</span>
                                                <input 
                                                    type="number" 
                                                    step="0.0001" 
                                                    required 
                                                    value={(formData as any)[category].platform_rate}
                                                    onChange={e => handleCategoryChange(category, 'platform_rate', e.target.value)}
                                                    className="w-full pl-7 pr-3 py-2 border border-emerald-300 bg-white rounded-lg text-sm font-bold text-emerald-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </form>
                        </div>
                        
                        <div className="px-6 py-4 flex justify-end gap-3 border-t border-slate-100 bg-slate-50">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">Cancel</button>
                            <button form="bulkPricingForm" type="submit" className="px-6 py-2 text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg transition-colors shadow-sm">
                                Save All Rates
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {toast && (
                <Toast
                    type={toast.type}
                    title={toast.title}
                    message={toast.message}
                    onClose={() => setToast(null)}
                />
            )}
        </div>
    );
};

export default PricingManager;
