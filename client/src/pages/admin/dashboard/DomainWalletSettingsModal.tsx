import React, { useState, useEffect } from 'react';
import Modal from '../../../components/Modal';

interface DomainWalletSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    domain: string;
    onSuccess: () => void;
}

const BILLING_MODE_OPTIONS = [
    {
        value: 'CREDIT_LINE_SUPER',
        label: '🏛 Super Admin Credit Line (Default)',
        description: 'New users use the Super Admin\'s Meta account. Deducts from Tenant\'s Master Wallet.',
        color: 'border-blue-300 bg-blue-50',
    },
    {
        value: 'CREDIT_LINE_TENANT',
        label: '🏢 Tenant Agency Credit Line',
        description: 'New users use the Tenant Admin\'s own Meta credit line. Free/Unlimited top-ups for the Tenant.',
        color: 'border-emerald-300 bg-emerald-50',
    },
    {
        value: 'DIRECT_META',
        label: '💳 Direct Meta Billing',
        description: 'New users pay Meta directly. Tenant Wallet only charges software markup.',
        color: 'border-amber-300 bg-amber-50',
    }
];

const DomainWalletSettingsModal: React.FC<DomainWalletSettingsModalProps> = ({ isOpen, onClose, domain, onSuccess }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    
    // Form State
    const [defaultBillingMode, setDefaultBillingMode] = useState('CREDIT_LINE_SUPER');
    const [allowTenantControl, setAllowTenantControl] = useState(true);
    
    // Recharge State
    const [rechargeAmount, setRechargeAmount] = useState('');
    const [isRecharging, setIsRecharging] = useState(false);
    const [rechargeSuccess, setRechargeSuccess] = useState('');

    useEffect(() => {
        if (isOpen && domain) {
            fetchSettings();
        }
    }, [isOpen, domain]);

    const fetchSettings = async () => {
        setIsLoading(true);
        setError('');
        try {
            const token = localStorage.getItem('adminToken');
            const res = await fetch(`/api/wallet/admin/domain-settings/${domain}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                if (data) {
                    setDefaultBillingMode(data.default_billing_mode || 'CREDIT_LINE_SUPER');
                    setAllowTenantControl(data.allow_tenant_billing_control ?? true);
                }
            } else {
                const err = await res.json();
                setError(err.error || 'Failed to fetch domain settings');
            }
        } catch (err) {
            console.error(err);
            setError('Network error loading settings.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');

        try {
            const token = localStorage.getItem('adminToken');
            const res = await fetch('/api/wallet/admin/domain-settings', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    domain,
                    default_billing_mode: defaultBillingMode,
                    allow_tenant_billing_control: allowTenantControl
                })
            });

            if (res.ok) {
                onSuccess();
                onClose();
            } else {
                const data = await res.json();
                setError(data.error || 'Failed to save settings');
            }
        } catch (err) {
            console.error(err);
            setError('Network error. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRecharge = async () => {
        if (!rechargeAmount || Number(rechargeAmount) <= 0) {
            setError('Please enter a valid recharge amount');
            return;
        }

        setIsRecharging(true);
        setError('');
        setRechargeSuccess('');

        try {
            const token = localStorage.getItem('adminToken');
            const res = await fetch('/api/wallet/admin/topup-master', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    domain,
                    amount: Number(rechargeAmount)
                })
            });

            const data = await res.json();
            if (res.ok) {
                setRechargeSuccess(`Successfully added ₹${rechargeAmount} to the Agency Wallet!`);
                setRechargeAmount('');
                onSuccess(); // refresh table data
            } else {
                setError(data.error || 'Failed to recharge Agency Wallet');
            }
        } catch (err) {
            console.error(err);
            setError('Network error. Please try again.');
        } finally {
            setIsRecharging(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Wallet Config: ${domain}`}>
            {isLoading ? (
                <div className="p-8 flex justify-center items-center">
                    <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                    {error && (
                        <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm font-medium border border-red-100">
                            {error}
                        </div>
                    )}

                    {/* Default Billing Mode */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                            Default Billing Mode (For New Users)
                        </label>
                        <p className="text-xs text-slate-500 mb-3">
                            When a new user signs up under this domain, they will automatically be assigned this billing mode.
                        </p>
                        <div className="space-y-2">
                            {BILLING_MODE_OPTIONS.map(mode => (
                                <label
                                    key={mode.value}
                                    className={`flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                                        defaultBillingMode === mode.value ? mode.color + ' border-opacity-100' : 'border-slate-200 bg-white hover:bg-slate-50'
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="default_billing_mode"
                                        value={mode.value}
                                        checked={defaultBillingMode === mode.value}
                                        onChange={() => setDefaultBillingMode(mode.value)}
                                        className="mt-1"
                                    />
                                    <div>
                                        <div className="text-sm font-bold text-slate-900">{mode.label}</div>
                                        <div className="text-xs text-slate-500 mt-0.5">{mode.description}</div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Allow Tenant Control Toggle */}
                    <div className="pt-2 border-t border-slate-200">
                        <label className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg bg-white cursor-pointer hover:bg-slate-50 transition-colors">
                            <div className="flex items-center h-5">
                                <input
                                    type="checkbox"
                                    checked={allowTenantControl}
                                    onChange={(e) => setAllowTenantControl(e.target.checked)}
                                    className="w-4 h-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500"
                                />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-slate-900">Allow Tenant Admin Control</span>
                                <span className="text-xs text-slate-500">
                                    If enabled, the Tenant Admin for this domain can manually change their users' billing modes to the Tenant Agency Credit Line via their Top-up Modal.
                                </span>
                            </div>
                        </label>
                    </div>

                    {/* Agency Wallet Recharge Section */}
                    <div className="pt-4 border-t border-slate-200">
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                            Recharge Agency Master Wallet
                        </label>
                        <p className="text-xs text-slate-500 mb-3">
                            Add funds to the Tenant Admin's master wallet. They use these funds to top-up their users when on the Super Admin Credit Line.
                        </p>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 font-medium">₹</span>
                                <input
                                    type="number"
                                    min="1"
                                    step="0.01"
                                    value={rechargeAmount}
                                    onChange={(e) => setRechargeAmount(e.target.value)}
                                    placeholder="Enter amount"
                                    className="pl-7 w-full p-2 border border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={handleRecharge}
                                disabled={isRecharging || !rechargeAmount}
                                className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 text-sm whitespace-nowrap"
                            >
                                {isRecharging ? 'Adding...' : 'Add Funds'}
                            </button>
                        </div>
                        {rechargeSuccess && (
                            <p className="mt-2 text-xs font-bold text-emerald-600 bg-emerald-50 p-2 rounded border border-emerald-100">
                                ✅ {rechargeSuccess}
                            </p>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
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
                            className="px-4 py-2 bg-brand-600 text-white rounded-lg font-bold hover:bg-brand-700 transition-colors disabled:opacity-50"
                        >
                            {isSubmitting ? 'Saving...' : 'Save Config'}
                        </button>
                    </div>
                </form>
            )}
        </Modal>
    );
};

export default DomainWalletSettingsModal;
