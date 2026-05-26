import React, { useState, useEffect } from 'react';
import Modal from '../../../components/Modal';

interface WalletTopupModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: any;
    onSuccess: () => void;
}

const WalletTopupModal: React.FC<WalletTopupModalProps> = ({ isOpen, onClose, user, onSuccess }) => {
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('Admin Top-up');
    const [walletEnforced, setWalletEnforced] = useState(false);
    const [currentBalance, setCurrentBalance] = useState<string | number>('Loading...');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen && user) {
            fetchWalletBalance();
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
            } else {
                setCurrentBalance('Error');
            }
        } catch (err) {
            console.error(err);
            setCurrentBalance('Error');
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
                    wallet_enforced: walletEnforced
                })
            });

            if (res.ok) {
                onSuccess();
                onClose();
                setAmount('');
            } else {
                const data = await res.json();
                setError(data.message || 'Failed to top up wallet');
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

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Top-up Wallet: ${user?.name}`}>
            <div className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-slate-500">Current Balance:</span>
                    <span className="text-lg font-bold text-slate-900">₹{typeof currentBalance === 'number' ? currentBalance.toFixed(2) : currentBalance}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-500">Wallet Enforced:</span>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${walletEnforced ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                        {walletEnforced ? 'ENABLED' : 'DISABLED'}
                    </span>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                    <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm font-medium border border-red-100">
                        {error}
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Add Amount (₹)</label>
                    <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 outline-none text-slate-800"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        placeholder="e.g. 500.00 (Leave 0 to only change enforcement)"
                    />
                </div>

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
                            <span className="text-sm font-bold text-slate-900">Enforce Wallet Balance (Mode B)</span>
                            <span className="text-xs text-slate-500">
                                If enabled, the user cannot send messages if their balance drops to zero. If disabled (Mode A), messages always send and costs are just logged.
                            </span>
                        </div>
                    </label>
                </div>

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
                            disabled={isSubmitting}
                            className="px-4 py-2 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 transition-colors disabled:opacity-50"
                        >
                            {isSubmitting ? 'Processing...' : 'Confirm Top-up'}
                        </button>
                    </div>
                </div>
            </form>
        </Modal>
    );
};

export default WalletTopupModal;
