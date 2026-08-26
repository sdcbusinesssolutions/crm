import React, { useState, useEffect } from 'react';
import Modal from '../../../components/Modal';

interface WalletRatesModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: any;
    onSuccess: () => void;
}

interface Rate {
    category: string;
    platform_rate: number | '';
    meta_cost: number;
    scope: 'GLOBAL' | 'WORKSPACE';
    country_code?: string;
}

const CATEGORIES = ['MARKETING', 'UTILITY', 'AUTHENTICATION', 'SERVICE'];

const WalletRatesModal: React.FC<WalletRatesModalProps> = ({ isOpen, onClose, user, onSuccess }) => {
    const [ratesByCountry, setRatesByCountry] = useState<Record<string, Record<string, Rate>>>({});
    const [globalRatesByCountry, setGlobalRatesByCountry] = useState<Record<string, Record<string, Rate>>>({});
    const [countries, setCountries] = useState<string[]>(['IN']);
    const [selectedCountry, setSelectedCountry] = useState<string>('IN');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen && user) {
            fetchRates();
        }
    }, [isOpen, user]);

    const fetchRates = async () => {
        setIsLoading(true);
        setError('');
        try {
            const token = localStorage.getItem('adminToken');
            const res = await fetch(`/api/wallet/admin/rates/${user.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                
                const uniqueCountries = Array.from(new Set(data.map((r: any) => r.country_code || 'IN'))) as string[];
                uniqueCountries.sort();
                
                const newRatesByCountry: Record<string, Record<string, Rate>> = {};
                const newGlobalRatesByCountry: Record<string, Record<string, Rate>> = {};
                
                uniqueCountries.forEach(cc => {
                    const countryRates = data.filter((r: any) => (r.country_code || 'IN') === cc);
                    const processed: Record<string, Rate> = {};
                    const globalProcessed: Record<string, Rate> = {};
                    
                    // First pass: add GLOBAL
                    countryRates.forEach((r: any) => {
                        if (r.scope === 'GLOBAL') {
                            processed[r.category] = r;
                            globalProcessed[r.category] = r;
                        }
                    });
                    
                    // Second pass: add WORKSPACE
                    countryRates.forEach((r: any) => {
                        if (r.scope === 'WORKSPACE' && r.user_id === user.id) {
                            processed[r.category] = r;
                        }
                    });
                    
                    newRatesByCountry[cc] = processed;
                    newGlobalRatesByCountry[cc] = globalProcessed;
                });
                
                setCountries(uniqueCountries.length ? uniqueCountries : ['IN']);
                if (!uniqueCountries.includes(selectedCountry) && uniqueCountries.length > 0) {
                    setSelectedCountry(uniqueCountries[0]);
                }
                
                setRatesByCountry(newRatesByCountry);
                setGlobalRatesByCountry(newGlobalRatesByCountry);
            } else {
                setError('Failed to fetch rates');
            }
        } catch (err) {
            console.error(err);
            setError('Network error. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRateChange = (category: string, value: string) => {
        setRatesByCountry(prev => ({
            ...prev,
            [selectedCountry]: {
                ...prev[selectedCountry],
                [category]: {
                    ...prev[selectedCountry]?.[category],
                    platform_rate: value === '' ? '' : parseFloat(value),
                    category,
                    country_code: selectedCountry,
                    scope: 'WORKSPACE'
                }
            }
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');

        try {
            const token = localStorage.getItem('adminToken');
            // We only send the ones that are WORKSPACE scope (the ones they edited or specifically want to set for this user)
            let ratesToSave: Rate[] = [];
            Object.values(ratesByCountry).forEach(countryRates => {
                ratesToSave = [...ratesToSave, ...Object.values(countryRates).filter(r => r.scope === 'WORKSPACE')];
            });

            // Validation: Cannot be 0, cannot be < globalRate
            const validationErrors: string[] = [];
            for (const r of ratesToSave) {
                if (r.platform_rate !== '') {
                    const globalRate = globalRatesByCountry[r.country_code || 'IN']?.[r.category];
                    const globalPlatformRate = globalRate && typeof globalRate.platform_rate === 'number' ? globalRate.platform_rate : 0;
                    const minAllowed = globalPlatformRate > 0 ? globalPlatformRate : 0.0001;
                    
                    if (r.platform_rate < minAllowed) {
                        validationErrors.push(`${r.category} (${r.country_code || 'IN'}) cannot be lower than ${minAllowed}`);
                    }
                }
            }
            
            if (validationErrors.length > 0) {
                setError(validationErrors.join(', '));
                setIsSubmitting(false);
                return;
            }
            
            const res = await fetch('/api/wallet/admin/rates', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: user.id,
                    rates: ratesToSave
                })
            });

            if (res.ok) {
                onSuccess();
                onClose();
            } else {
                const data = await res.json();
                setError(data.error || data.message || 'Failed to update rates');
            }
        } catch (err) {
            console.error(err);
            setError('Network error. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Set Message Rates: ${user?.name}`}>
            {isLoading ? (
                <div className="flex justify-center p-8">
                    <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                        <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm font-medium border border-red-100">
                            {error}
                        </div>
                    )}
                    
                    <p className="text-sm text-slate-500 mb-4">
                        Configure the price you charge this user per message category. 
                        Editing a value creates a <strong>Workspace Override</strong> for the selected country. Otherwise, it falls back to the Global default.
                    </p>

                    <div className="mb-4">
                        <label className="block text-sm font-bold text-slate-700 mb-1">Country</label>
                        <select
                            value={selectedCountry}
                            onChange={(e) => setSelectedCountry(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500"
                        >
                            {countries.map(cc => {
                                const hasOverride = Object.values(ratesByCountry[cc] || {}).some(r => r.scope === 'WORKSPACE');
                                return (
                                    <option key={cc} value={cc}>
                                        {cc === 'IN' ? 'India (IN)' : cc} {hasOverride ? ' (Custom Rates Active)' : ''}
                                    </option>
                                );
                            })}
                        </select>
                    </div>

                    <div className="space-y-3">
                        {CATEGORIES.map(category => {
                            const rate = ratesByCountry[selectedCountry]?.[category];
                            const isOverride = rate?.scope === 'WORKSPACE';
                            
                            return (
                                <div key={category} className={`flex items-center justify-between p-3 border rounded-lg ${isOverride ? 'bg-brand-50 border-brand-200' : 'bg-slate-50 border-slate-200'}`}>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-slate-800">{category}</span>
                                        <span className="text-xs text-slate-500">
                                            Meta Cost: ~₹{rate?.meta_cost || '...'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-slate-600">₹</span>
                                        {(() => {
                                            const globalRateObj = globalRatesByCountry[selectedCountry]?.[category];
                                            const globalPlatformRate = globalRateObj && typeof globalRateObj.platform_rate === 'number' ? globalRateObj.platform_rate : 0;
                                            const minAllowed = globalPlatformRate > 0 ? globalPlatformRate : 0.0001;
                                            return (
                                                <input
                                                    type="number"
                                                    step="0.0001"
                                                    min={minAllowed}
                                                    placeholder={minAllowed.toString()}
                                                    className={`w-24 px-2 py-1 text-right text-sm border rounded focus:ring-brand-500 outline-none ${isOverride ? 'border-brand-300 bg-white' : 'border-slate-300 bg-transparent'}`}
                                                    value={rate?.platform_rate !== undefined && rate?.platform_rate !== null ? rate.platform_rate : ''}
                                                    onChange={(e) => handleRateChange(category, e.target.value)}
                                                />
                                            );
                                        })()}
                                        {isOverride && (
                                            <span className="text-[10px] font-bold text-brand-600 bg-brand-100 px-1.5 py-0.5 rounded ml-1">
                                                OVERRIDE
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t mt-6 border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-4 py-2 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 transition-colors disabled:opacity-50"
                        >
                            {isSubmitting ? 'Saving...' : 'Save Rates'}
                        </button>
                    </div>
                </form>
            )}
        </Modal>
    );
};

export default WalletRatesModal;
