import React, { useState, useEffect } from 'react';
import Modal from '../../../components/Modal';

interface GlobalRatesModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

interface Rate {
    category: string;
    platform_rate: number;
    meta_cost: number;
    scope: 'GLOBAL';
}

const CATEGORIES = ['MARKETING', 'UTILITY', 'AUTHENTICATION', 'SERVICE'];

const GlobalRatesModal: React.FC<GlobalRatesModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [rates, setRates] = useState<Record<string, Rate>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchRates();
        }
    }, [isOpen]);

    const fetchRates = async () => {
        setIsLoading(true);
        setError('');
        try {
            const token = localStorage.getItem('adminToken');
            const res = await fetch(`/api/wallet/admin/global-rates`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                
                const processedRates: Record<string, Rate> = {};
                
                data.forEach((r: any) => {
                    if (r.scope === 'GLOBAL') {
                        processedRates[r.category] = r;
                    }
                });
                
                setRates(processedRates);
            } else {
                setError('Failed to fetch global rates');
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
                scope: 'GLOBAL' 
            }
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');

        try {
            const token = localStorage.getItem('adminToken');
            const ratesToSave = Object.values(rates).filter(r => r.scope === 'GLOBAL');
            
            const res = await fetch('/api/wallet/admin/global-rates', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ rates: ratesToSave })
            });

            if (res.ok) {
                onSuccess();
                onClose();
            } else {
                const data = await res.json();
                setError(data.error || 'Failed to update global rates');
            }
        } catch (err) {
            console.error(err);
            setError('Network error. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Set Global Default Rates`}>
            <div className="mb-6">
                <p className="text-sm text-slate-600">
                    Configure the default prices charged to all users. These prices will automatically apply to everyone unless they have a specific Workspace Override.
                </p>
            </div>

            {error && (
                <div className="mb-4 bg-red-50 text-red-700 p-3 rounded-lg text-sm font-medium border border-red-100">
                    {error}
                </div>
            )}

            {isLoading ? (
                <div className="flex justify-center py-8">
                    <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                    {CATEGORIES.map(cat => {
                        const rate = rates[cat];
                        return (
                            <div key={cat} className={`flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white shadow-sm`}>
                                <div>
                                    <div className="font-bold text-slate-900">{cat}</div>
                                    <div className="text-[10px] font-medium text-slate-500 flex items-center gap-1 mt-0.5">
                                        Meta Cost: ~₹{rate?.meta_cost || '---'}
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-slate-400">₹</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        required
                                        value={rate?.platform_rate !== undefined ? rate.platform_rate : ''}
                                        onChange={e => handleRateChange(cat, e.target.value)}
                                        className="w-24 px-3 py-1.5 border border-slate-200 rounded-lg text-right font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-shadow"
                                    />
                                </div>
                            </div>
                        );
                    })}

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
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
                            className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                        >
                            {isSubmitting ? 'Saving...' : 'Save Global Rates'}
                        </button>
                    </div>
                </form>
            )}
        </Modal>
    );
};

export default GlobalRatesModal;
