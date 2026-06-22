import React, { useState, useEffect } from 'react';
import Modal from '../../../components/Modal';

interface WalletTopupModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: any;
    onSuccess: () => void;
    isSuperAdmin?: boolean;
}

const BILLING_MODE_OPTIONS = [
    {
        value: 'CREDIT_LINE_SUPER',
        label: '🏛 Super Admin Pays Meta (Wholesale)',
        description: 'You (Tenant) buy wholesale credits from Super Admin. User buys retail credits from you.',
        color: 'border-blue-300 bg-blue-50',
        badge: 'bg-blue-100 text-blue-800'
    },
    {
        value: 'CREDIT_LINE_TENANT',
        label: '🏢 You Pay Meta (Agency Model)',
        description: 'You connect your own card to Meta. User buys retail credits from you to cover your Meta bill.',
        color: 'border-emerald-300 bg-emerald-50',
        badge: 'bg-emerald-100 text-emerald-800'
    },
    {
        value: 'DIRECT_META',
        label: '💳 End-User Pays Meta (Retail Model)',
        description: 'User connects their own card directly to Meta. You only charge them a software fee.',
        color: 'border-amber-300 bg-amber-50',
        badge: 'bg-amber-100 text-amber-800'
    }
];

const WalletTopupModal: React.FC<WalletTopupModalProps> = ({ isOpen, onClose, user, onSuccess, isSuperAdmin = false }) => {
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('Admin Top-up');
    const [walletEnforced, setWalletEnforced] = useState(false);
    const [billingMode, setBillingMode] = useState('CREDIT_LINE_SUPER');
    const [initialBillingMode, setInitialBillingMode] = useState('CREDIT_LINE_SUPER');
    const [currentBalance, setCurrentBalance] = useState<string | number>('Loading...');
    const [masterBalance, setMasterBalance] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [allowTenantControl, setAllowTenantControl] = useState(true);
    const [domainDefaultBillingMode, setDomainDefaultBillingMode] = useState('CREDIT_LINE_SUPER');

    useEffect(() => {
        if (isOpen && user) {
            fetchWalletBalance();
            if (!isSuperAdmin) fetchMasterBalance();
        }
    }, [isOpen, user]);

    const fetchWalletBalance = async () => {
        try {
            const token = localStorage.getItem('adminToken');
            const res = await fetch(`/api/wallet/admin/balance/${user.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setCurrentBalance(data.balance);
                setWalletEnforced(data.wallet_enforced);
                const fetchedBillingMode = data.billing_mode || data.default_billing_mode || 'CREDIT_LINE_SUPER';
                const domainDefault = data.default_billing_mode || 'CREDIT_LINE_SUPER';
                
                // 🛠 STRICT ENFORCEMENT: Force the active billing mode to match the domain's default,
                // because we are now strictly isolating modes to ONLY show the one assigned to the domain.
                let activeBillingMode = domainDefault;

                setBillingMode(activeBillingMode);
                setInitialBillingMode(fetchedBillingMode);
                setAllowTenantControl(data.allow_tenant_billing_control ?? true);
                setDomainDefaultBillingMode(domainDefault);
            } else {
                setCurrentBalance('Error');
            }
        } catch (err) {
            console.error(err);
            setCurrentBalance('Error');
        }
    };

    const fetchMasterBalance = async () => {
        try {
            const token = localStorage.getItem('adminToken');
            const res = await fetch('/api/wallet/admin/master-balance', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setMasterBalance(Number(data.balance || 0));
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const parsedAmount = Number(amount) || 0;
        if (parsedAmount < 0) {
            setError('Amount cannot be negative.');
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            const token = localStorage.getItem('adminToken');
            const res = await fetch('/api/wallet/admin/topup', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: user.id,
                    amount: parsedAmount,
                    description,
                    wallet_enforced: walletEnforced,
                    billing_mode: billingMode
                })
            });

            if (res.ok) {
                onSuccess();
                onClose();
                setAmount('');
            } else {
                const data = await res.json();
                setError(data.error || data.message || 'Failed to top up wallet');
            }
        } catch (err) {
            console.error(err);
            setError('Network error. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleReset = async () => {
        if (!window.confirm(`Are you sure you want to reset ${user?.name}'s balance to ₹0.00?`)) return;
        
        setIsSubmitting(true);
        setError('');

        try {
            const token = localStorage.getItem('adminToken');
            const res = await fetch('/api/wallet/admin/reset', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId: user.id })
            });

            if (res.ok) {
                onSuccess();
                onClose();
                setAmount('');
            } else {
                const data = await res.json();
                setError(data.message || 'Failed to reset wallet');
            }
        } catch (err) {
            console.error(err);
            setError('Network error. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const selectedMode = BILLING_MODE_OPTIONS.find(m => m.value === billingMode);
    const isResellerTransfer = !isSuperAdmin && billingMode === 'CREDIT_LINE_SUPER';

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={currentBalance === 'Loading...' ? 'Loading...' : (domainDefaultBillingMode === 'DIRECT_META' ? `Billing Settings: ${user?.name}` : `Top-up Wallet: ${user?.name}`)}>
            {currentBalance === 'Loading...' ? (
                <div className="flex justify-center items-center py-20">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600"></div>
                </div>
            ) : (
                <>
            {/* Premium Balance Summary Card */}
            <div className="mb-6 relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-5 rounded-2xl shadow-xl border border-slate-700 transition-all duration-300 hover:shadow-2xl">
                {/* Decorative background glow */}
                <div className="absolute -right-10 -top-10 w-32 h-32 bg-brand-500 rounded-full blur-3xl opacity-20 pointer-events-none"></div>
                <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-emerald-500 rounded-full blur-3xl opacity-20 pointer-events-none"></div>
                
                <div className="relative z-10">
                    <div className="flex justify-between items-end mb-4">
                        <div>
                            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">User Balance</span>
                            <div className="text-3xl font-black text-white mt-1 drop-shadow-md tracking-tight">
                                ₹{typeof currentBalance === 'number' ? currentBalance.toFixed(2) : currentBalance}
                            </div>
                        </div>
                        <span className={`text-xs font-bold px-3 py-1.5 rounded-full shadow-sm border border-white/10 ${selectedMode?.badge || 'bg-slate-800 text-slate-300'}`}>
                            {selectedMode?.label || billingMode}
                        </span>
                    </div>

                    {/* Only show Agency Wallet balance if they are actually using the Wholesale model */}
                    {!isSuperAdmin && masterBalance !== null && billingMode === 'CREDIT_LINE_SUPER' && (
                        <div className="flex justify-between items-center pt-4 border-t border-slate-700/50 mt-2 transition-all duration-300 ease-in-out">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-slate-800 rounded-lg border border-slate-700 shadow-inner">
                                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
                                </div>
                                <span className="text-sm font-medium text-slate-300">Your Wholesale Credit Balance</span>
                            </div>
                            <span className={`text-lg font-bold drop-shadow-md ${masterBalance <= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                ₹{masterBalance.toFixed(2)}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                    <div className="bg-red-50/80 backdrop-blur-sm text-red-700 p-4 rounded-xl text-sm font-medium border border-red-100 shadow-sm flex items-start gap-3">
                        <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        {error}
                    </div>
                )}

                {/* Billing Mode Selector */}
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-3">Credit Line / Billing Mode</label>
                    <div className="space-y-3">
                        {BILLING_MODE_OPTIONS.filter(mode => {
                            // STRICT ISOLATION: Only show the EXACT billing mode assigned to the domain
                            return mode.value === domainDefaultBillingMode;
                        }).map(mode => (
                            <label
                                key={mode.value}
                                className={`relative flex items-start gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 ease-out hover:shadow-md hover:-translate-y-0.5 ${
                                    billingMode === mode.value 
                                        ? `${mode.color} border-opacity-100 shadow-sm ring-4 ring-opacity-20 ${mode.color.split(' ')[0].replace('border', 'ring')}` 
                                        : 'border-slate-200 bg-white hover:border-slate-300'
                                }`}
                            >
                                <div className="flex items-center h-5 mt-0.5">
                                    <input
                                        type="radio"
                                        name="billing_mode"
                                        value={mode.value}
                                        checked={billingMode === mode.value}
                                        onChange={() => setBillingMode(mode.value)}
                                        className="w-4 h-4 text-brand-600 border-gray-300 focus:ring-brand-500 transition-colors"
                                    />
                                </div>
                                <div className="flex-1">
                                    <div className="text-sm font-bold text-slate-900">{mode.label}</div>
                                    <div className="text-xs text-slate-500 mt-1 leading-relaxed">{mode.description}</div>
                                </div>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Reseller Warning */}
                {isResellerTransfer && (
                    <div className="bg-blue-50/80 backdrop-blur-sm border-l-4 border-blue-500 rounded-r-xl p-4 shadow-sm">
                        <p className="text-sm text-blue-800 font-medium">
                            <span className="mr-2">🏦</span> <strong>Wholesale Deduction:</strong> This amount will be deducted from your Wholesale Credit Balance (Current: ₹{masterBalance?.toFixed(2) ?? '...'}).
                            {masterBalance !== null && Number(amount) > masterBalance && (
                                <span className="block text-red-600 font-bold mt-2 bg-red-100/50 px-3 py-2 rounded-lg border border-red-100">
                                    ❌ You don't have enough Wholesale Credits to cover ₹{amount}.
                                </span>
                            )}
                        </p>
                    </div>
                )}
                {billingMode === 'DIRECT_META' && (
                    <div className="bg-amber-50/80 backdrop-blur-sm border-l-4 border-amber-500 rounded-r-xl p-4 shadow-sm">
                        <p className="text-sm text-amber-800 font-medium leading-relaxed">
                            <span className="mr-2">💳</span> <strong>User Pays Meta:</strong> Meta charges this user directly for messages. No wallet balance is required or deducted for this user.
                        </p>
                    </div>
                )}
                {billingMode === 'CREDIT_LINE_TENANT' && (
                    <div className="bg-emerald-50/80 backdrop-blur-sm border-l-4 border-emerald-500 rounded-r-xl p-4 shadow-sm space-y-2 mt-4">
                        <p className="text-sm text-emerald-800 font-medium leading-relaxed">
                            <span className="mr-2">🏢</span> <strong>Your Meta Card:</strong> Meta will charge your own credit card for this user's messages. You can top-up this user freely here without needing Wholesale Credits.
                        </p>
                        <p className="text-xs text-emerald-700 font-medium leading-relaxed">
                            <em>Note: Only the software markup fee (₹0.20) will be automatically deducted from your Agency Wallet when the user sends a message.</em>
                        </p>
                    </div>
                )}

                {billingMode !== 'DIRECT_META' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                        {/* Amount */}
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1.5">Add Amount (₹)</label>
                            <div className="relative shadow-sm rounded-xl">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <span className="text-slate-400 sm:text-sm font-medium">₹</span>
                                </div>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    className="block w-full pl-8 pr-3 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none text-slate-800 font-medium transition-shadow hover:border-slate-400"
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1.5">Description</label>
                            <input
                                type="text"
                                className="block w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none text-slate-800 font-medium transition-shadow hover:border-slate-400 shadow-sm"
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder="e.g. Monthly Top-up"
                            />
                        </div>
                    </div>
                )}

                {/* Enforcement Toggle */}
                {billingMode !== 'DIRECT_META' && (
                <div className="pt-2">
                    <label className="relative flex items-start gap-4 p-4 border border-slate-200 rounded-xl bg-white cursor-pointer hover:bg-slate-50 hover:shadow-sm transition-all duration-200 hover:border-slate-300">
                        <div className="flex items-center h-5 mt-0.5">
                            <input
                                type="checkbox"
                                checked={walletEnforced}
                                onChange={(e) => setWalletEnforced(e.target.checked)}
                                className="w-5 h-5 text-brand-600 border-gray-300 rounded focus:ring-brand-500 focus:ring-2 transition-colors"
                            />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-900">Enforce Wallet Balance Limit</span>
                            <span className="text-xs text-slate-500 mt-1 leading-relaxed">
                                If enabled, the user cannot send messages when balance reaches zero. If disabled, messages always send and costs are only logged (Unlimited).
                            </span>
                        </div>
                    </label>
                </div>
                )}

                {/* 🔒 UI Security: Prevent submission if Agency Balance is too low */}
                {!isSuperAdmin && billingMode === 'CREDIT_LINE_SUPER' && Number(amount) > (masterBalance || 0) && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-3 shadow-sm animate-pulse">
                        <svg className="w-5 h-5 shrink-0 text-red-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                        <div>
                            <strong>Insufficient Agency Balance.</strong> You only have ₹{(masterBalance || 0).toFixed(2)} available. 
                            You cannot give this user ₹{Number(amount).toFixed(2)}. Please contact the Super Admin to recharge your wallet.
                        </div>
                    </div>
                )}

                <div className="flex flex-col-reverse sm:flex-row justify-between items-center pt-6 border-t border-slate-100 gap-4">
                    {billingMode !== 'DIRECT_META' ? (
                        <button
                            type="button"
                            onClick={handleReset}
                            disabled={isSubmitting}
                            className="w-full sm:w-auto px-4 py-2.5 text-red-600 hover:bg-red-50 rounded-xl font-bold text-sm transition-all border border-transparent hover:border-red-200 hover:shadow-sm"
                        >
                            Reset Balance to ₹0.00
                        </button>
                    ) : <div />}
                    <div className="flex w-full sm:w-auto gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 sm:flex-none px-6 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-bold transition-all hover:shadow-sm"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || (!isSuperAdmin && billingMode === 'CREDIT_LINE_SUPER' && Number(amount) > (masterBalance || 0))}
                            className="flex-1 sm:flex-none px-6 py-2.5 bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-xl font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
                        >
                            {isSubmitting ? 'Saving...' : (domainDefaultBillingMode === 'DIRECT_META' ? 'Save Settings' : 'Confirm')}
                        </button>
                    </div>
                </div>
            </form>
                </>
            )}
        </Modal>
    );
};

export default WalletTopupModal;
