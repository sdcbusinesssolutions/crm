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
        label: '🏛 Super Admin Credit Line',
        description: 'User is billed via Super Admin\'s Meta account. Tenant Admin must use their Agency Master Wallet to top-up this user. Strict balance enforcement.',
        color: 'border-blue-300 bg-blue-50',
        badge: 'bg-blue-100 text-blue-800'
    },
    {
        value: 'CREDIT_LINE_TENANT',
        label: '🏢 Tenant Agency Credit Line',
        description: 'User\'s costs are covered by the Tenant Admin\'s own Meta credit line. Tenant Admin can top-up unlimited. Tenant owns the billing liability.',
        color: 'border-emerald-300 bg-emerald-50',
        badge: 'bg-emerald-100 text-emerald-800'
    },
    {
        value: 'DIRECT_META',
        label: '💳 Direct Meta Billing',
        description: 'User has their own Meta Business account and pays Meta directly with their own card. Your wallet only charges the platform markup (not Meta\'s cost).',
        color: 'border-amber-300 bg-amber-50',
        badge: 'bg-amber-100 text-amber-800'
    }
];

const WalletTopupModal: React.FC<WalletTopupModalProps> = ({ isOpen, onClose, user, onSuccess, isSuperAdmin = false }) => {
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('Admin Top-up');
    const [walletEnforced, setWalletEnforced] = useState(false);
    const [billingMode, setBillingMode] = useState('CREDIT_LINE_SUPER');
    const [currentBalance, setCurrentBalance] = useState<string | number>('Loading...');
    const [masterBalance, setMasterBalance] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

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
                setBillingMode(data.billing_mode || 'CREDIT_LINE_SUPER');
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
        <Modal isOpen={isOpen} onClose={onClose} title={`Top-up Wallet: ${user?.name}`}>
            {/* Current Balance Summary */}
            <div className="mb-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-slate-500">User Balance:</span>
                    <span className="text-lg font-bold text-slate-900">₹{typeof currentBalance === 'number' ? currentBalance.toFixed(2) : currentBalance}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-slate-500">Billing Mode:</span>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${selectedMode?.badge || 'bg-slate-100 text-slate-600'}`}>
                        {selectedMode?.label || billingMode}
                    </span>
                </div>
                {/* Show Master Wallet balance to Tenant Admins when in Reseller mode */}
                {!isSuperAdmin && masterBalance !== null && (
                    <div className="flex justify-between items-center pt-2 border-t border-slate-200 mt-2">
                        <span className="text-sm font-medium text-slate-500">Your Agency Wallet:</span>
                        <span className={`text-sm font-bold ${masterBalance <= 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                            ₹{masterBalance.toFixed(2)}
                        </span>
                    </div>
                )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                    <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm font-medium border border-red-100">
                        {error}
                    </div>
                )}

                {/* Billing Mode Selector */}
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Credit Line / Billing Mode</label>
                    <div className="space-y-2">
                        {BILLING_MODE_OPTIONS.map(mode => (
                            <label
                                key={mode.value}
                                className={`flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                                    billingMode === mode.value ? mode.color + ' border-opacity-100' : 'border-slate-200 bg-white hover:bg-slate-50'
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="billing_mode"
                                    value={mode.value}
                                    checked={billingMode === mode.value}
                                    onChange={() => setBillingMode(mode.value)}
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

                {/* Reseller Warning */}
                {isResellerTransfer && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-xs text-blue-800 font-medium">
                            ⚠️ <strong>Agency Transfer:</strong> This amount will be deducted from your Agency Master Wallet (Current: ₹{masterBalance?.toFixed(2) ?? '...'}).
                            {masterBalance !== null && Number(amount) > masterBalance && (
                                <span className="block text-red-600 font-bold mt-1">
                                    ❌ You don't have enough Agency balance to cover ₹{amount}.
                                </span>
                            )}
                        </p>
                    </div>
                )}
                {billingMode === 'DIRECT_META' && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <p className="text-xs text-amber-800 font-medium">
                            💳 <strong>Direct Meta Billing:</strong> Meta charges this user's card directly. Your wallet will only deduct the platform software markup fee (not Meta's message cost).
                        </p>
                    </div>
                )}
                {billingMode === 'CREDIT_LINE_TENANT' && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                        <p className="text-xs text-emerald-800 font-medium">
                            🏢 <strong>Agency Credit Line:</strong> You own this user's billing liability. Top-up amounts come from your own funds. Meta will bill your agency's credit line.
                        </p>
                    </div>
                )}

                {/* Amount */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Add Amount (₹)</label>
                    <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 outline-none text-slate-800"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        placeholder="e.g. 500.00 (Leave 0 to only change mode/enforcement)"
                    />
                </div>

                {/* Description */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Description (Optional)</label>
                    <input
                        type="text"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 outline-none text-slate-800"
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="e.g. Monthly Top-up"
                    />
                </div>

                {/* Enforcement Toggle */}
                <div className="pt-2">
                    <label className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg bg-white cursor-pointer hover:bg-slate-50 transition-colors">
                        <div className="flex items-center h-5">
                            <input
                                type="checkbox"
                                checked={walletEnforced}
                                onChange={(e) => setWalletEnforced(e.target.checked)}
                                className="w-4 h-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500"
                            />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-900">Enforce Wallet Balance</span>
                            <span className="text-xs text-slate-500">
                                If enabled, the user cannot send messages when balance reaches zero. If disabled, messages always send and costs are only logged.
                            </span>
                        </div>
                    </label>
                </div>

                {/* 🔒 UI Security: Prevent submission if Agency Balance is too low */}

                {!isSuperAdmin && billingMode === 'CREDIT_LINE_SUPER' && Number(amount) > (masterBalance || 0) && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
                        <span className="mt-0.5">🚨</span>
                        <div>
                            <strong>Insufficient Agency Balance.</strong> You only have ₹{(masterBalance || 0).toFixed(2)} available. 
                            You cannot give this user ₹{Number(amount).toFixed(2)}. Please contact the Super Admin to recharge your wallet.
                        </div>
                    </div>
                )}

                <div className="flex justify-between items-center pt-4">
                    <button
                        type="button"
                        onClick={handleReset}
                        disabled={isSubmitting}
                        className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg font-medium text-sm transition-colors border border-transparent hover:border-red-200"
                    >
                        Reset Balance to ₹0.00
                    </button>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || (!isSuperAdmin && billingMode === 'CREDIT_LINE_SUPER' && Number(amount) > (masterBalance || 0))}
                            className="px-4 py-2 bg-brand-600 text-white rounded-lg font-bold hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? 'Saving...' : 'Confirm'}
                        </button>
                    </div>
                </div>
            </form>
        </Modal>
    );
};

export default WalletTopupModal;
