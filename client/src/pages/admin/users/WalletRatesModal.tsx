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
    platform_rate: number;
    meta_cost: number;
    scope: 'GLOBAL' | 'WORKSPACE';
}

const CATEGORIES = ['MARKETING', 'UTILITY', 'AUTHENTICATION', 'SERVICE'];

const WalletRatesModal: React.FC<WalletRatesModalProps> = ({ isOpen, onClose, user, onSuccess }) => {
    const [rates, setRates] = useState<Record<string, Rate>>({});
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
                
                // Process the data: Prefer WORKSPACE rates over GLOBAL rates
                const processedRates: Record<string, Rate> = {};
                
                // First pass: add all GLOBAL rates
                data.forEach((r: any) => {
                    if (r.scope === 'GLOBAL') {
                        processedRates[r.category] = r;
                    }
                });
                
                // Second pass: override with WORKSPACE rates
                data.forEach((r: any) => {
                    if (r.scope === 'WORKSPACE' && r.user_id === user.id) {
                        processedRates[r.category] = r;
                    }
                });
                
                setRates(processedRates);
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
        const val = parseFloat(value);
        setRates(prev => ({
            ...prev,
            [category]: {
                ...prev[category],
                platform_rate: isNaN(val) ? 0 : val,
                category,
                // If they edit it, we implicitly treat it as a WORKSPACE override now
                scope: 'WORKSPACE' 
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
            const ratesToSave = Object.values(rates).filter(r => r.scope === 'WORKSPACE');
            
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
                setError(data.message || 'Failed to update rates');
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
                        Editing a value creates a <strong>Workspace Override</strong>. Otherwise, it falls back to the Global default.
                    </p>

                    <div className="space-y-3">
                        {CATEGORIES.map(category => {
                            const rate = rates[category];
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
                                        <input
                                            type="number"
                                            step="0.0001"
                                            min="0"
                                            className={`w-24 px-2 py-1 text-right text-sm border rounded focus:ring-brand-500 outline-none ${isOverride ? 'border-brand-300 bg-white' : 'border-slate-300 bg-transparent'}`}
                                            value={rate?.platform_rate || ''}
                                            onChange={(e) => handleRateChange(category, e.target.value)}
                                        />
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
