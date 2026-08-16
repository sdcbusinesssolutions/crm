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
        label: '🏛 You Pay Meta (Wholesale Model)',
        description: 'You pay Meta. Tenant buys wholesale credits from you. (Tenant is pre-paid).',
        color: 'border-blue-300 bg-blue-50',
    },
    {
        value: 'CREDIT_LINE_TENANT',
        label: '🏢 Tenant Pays Meta (Agency Model)',
        description: 'Tenant connects their own card to Meta. (No wholesale credits needed from you).',
        color: 'border-emerald-300 bg-emerald-50',
    },
    {
        value: 'DIRECT_META',
        label: '💳 End-User Pays Meta (Retail Model)',
        description: 'End-user connects their own card directly to Meta. (Tenant only collects software fees).',
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
    const [allowedCreditCurrencies, setAllowedCreditCurrencies] = useState<string[]>(['INR']);
    
    const AVAILABLE_CURRENCIES = ['INR', 'USD', 'AED', 'EUR', 'GBP', 'SGD', 'IDR', 'MYR', 'BRL', 'MXN', 'ARS', 'CLP', 'COP', 'PEN', 'SAR', 'AUD'];
    
    // Domain Admins State
    const [domainAdmins, setDomainAdmins] = useState<{id: string, name: string, email: string}[]>([]);
    const [selectedAdminId, setSelectedAdminId] = useState<string>('');

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
            
            const [settingsRes, adminsRes] = await Promise.all([
                fetch(`/api/wallet/admin/domain-settings/${domain}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch(`/api/wallet/admin/domain-admins/${domain}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            ]);

            if (settingsRes.ok) {
                const data = await settingsRes.json();
                if (data) {
                    setDefaultBillingMode(data.default_billing_mode || 'CREDIT_LINE_SUPER');
                    setAllowTenantControl(data.allow_tenant_billing_control ?? true);
                    setAllowedCreditCurrencies(data.allowed_credit_currencies || ['INR']);
                }
            } else {
                const err = await settingsRes.json();
                setError(err.error || 'Failed to fetch domain settings');
            }

            if (adminsRes.ok) {
                const adminsData = await adminsRes.json();
                setDomainAdmins(adminsData);
                if (adminsData.length > 0) {
                    setSelectedAdminId(adminsData[0].id);
                }
            }
        } catch (err) {
            console.error(err);
            setError('Network error loading settings.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCurrencyToggle = (currency: string) => {
        setAllowedCreditCurrencies(prev => {
            if (prev.includes(currency)) {
                if (prev.length === 1) return prev; // Don't allow empty array
                return prev.filter(c => c !== currency);
            }
            return [...prev, currency];
        });
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
                    allow_tenant_billing_control: allowTenantControl,
                    tenant_admin_user_id: selectedAdminId,
                    allowed_credit_currencies: allowedCreditCurrencies
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
                    tenantAdminUserId: selectedAdminId,
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
        <Modal isOpen={isOpen} onClose={onClose} title={`Wallet Config: ${domain}`} size="3xl">
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
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {BILLING_MODE_OPTIONS.map(mode => (
                                <div key={mode.value} className="flex flex-col gap-2">
                                    <label
                                        className={`flex flex-col items-start gap-2 p-3 border-2 rounded-lg cursor-pointer transition-all h-full ${
                                            defaultBillingMode === mode.value ? mode.color + ' border-opacity-100' : 'border-slate-200 bg-white hover:bg-slate-50'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="radio"
                                                name="default_billing_mode"
                                                value={mode.value}
                                                checked={defaultBillingMode === mode.value}
                                                onChange={() => setDefaultBillingMode(mode.value)}
                                            />
                                            <div className="text-xs font-bold text-slate-900 leading-tight">{mode.label}</div>
                                        </div>
                                        <div className="text-[10px] text-slate-500 mt-1 pl-5">{mode.description}</div>
                                    </label>
                                    
                                    {/* Nested Checkbox for specific modes */}
                                    {defaultBillingMode === mode.value && mode.value !== 'CREDIT_LINE_TENANT' && (
                                        <div className="p-2.5 bg-white border border-slate-200 rounded-lg shadow-sm mt-1">
                                            <label className="flex items-start gap-2 cursor-pointer">
                                                <div className="flex items-center h-4">
                                                    <input
                                                        type="checkbox"
                                                        checked={allowTenantControl}
                                                        onChange={(e) => setAllowTenantControl(e.target.checked)}
                                                        className="w-3.5 h-3.5 text-brand-600 border-gray-300 rounded focus:ring-brand-500 mt-0.5"
                                                    />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-bold text-slate-900 leading-tight">Allow Tenant Override</span>
                                                    <span className="text-[9px] text-slate-500 leading-tight mt-0.5">
                                                        Tenant can migrate users to their own Meta account.
                                                    </span>
                                                </div>
                                            </label>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Allowed Currencies */}
                    <div className="pt-4 border-t border-slate-200">
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                            Allowed Currencies for Wallet
                        </label>
                        <p className="text-xs text-slate-500 mb-3">
                            Select which currencies this Tenant is allowed to use for Wallet billing. If a user connects a WABA with a currency not checked here, they will be forced into Direct Meta billing.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {AVAILABLE_CURRENCIES.map(currency => {
                                const isSelected = allowedCreditCurrencies.includes(currency);
                                return (
                                    <button
                                        type="button"
                                        key={currency}
                                        onClick={() => handleCurrencyToggle(currency)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors flex items-center gap-1.5 ${
                                            isSelected 
                                            ? 'bg-brand-50 border-brand-200 text-brand-700' 
                                            : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                                        }`}
                                    >
                                        <div className={`w-3 h-3 rounded-full flex items-center justify-center border ${
                                            isSelected ? 'border-brand-500 bg-brand-500 text-white' : 'border-slate-300'
                                        }`}>
                                            {isSelected && <span className="text-[8px]">✓</span>}
                                        </div>
                                        {currency}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Agency Wallet Recharge Section */}
                    {defaultBillingMode === 'CREDIT_LINE_SUPER' && (
                        <div className="pt-4 border-t border-slate-200 bg-blue-50/50 -mx-6 px-6 pb-6 -mb-6 rounded-b-xl">
                            <label className="block text-sm font-bold text-blue-900 mb-2 mt-4">
                                Add Wholesale Credits for this Tenant
                            </label>
                            <p className="text-xs text-blue-700 mb-3">
                                Since this Tenant's users will be messaging via YOUR Meta account, you must allocate wholesale credits to the Tenant Admin so they can fund their users.
                            </p>
                            
                            {domainAdmins.length > 0 ? (
                                <div className="mb-3">
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Select Admin to Receive Funds</label>
                                    <select
                                        value={selectedAdminId}
                                        onChange={(e) => setSelectedAdminId(e.target.value)}
                                        className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-brand-500 focus:border-brand-500"
                                    >
                                        {domainAdmins.map(admin => (
                                            <option key={admin.id} value={admin.id}>
                                                {admin.name || 'Unnamed Admin'} ({admin.email})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            ) : (
                                <div className="mb-3 p-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-medium">
                                    Warning: No Admin accounts found for this domain. Please ask them to register first.
                                </div>
                            )}

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
                    )}

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
