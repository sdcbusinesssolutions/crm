import React, { useState, useEffect } from 'react';
import { CreditCardIcon } from '../../components/icons';
import { supabase } from '../../lib/supabase';

const WalletReport = () => {
    const [balanceData, setBalanceData] = useState({ balance: 0, wallet_enforced: false });
    const [transactions, setTransactions] = useState<any[]>([]);
    const [totalTransactions, setTotalTransactions] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    
    // Filters
    const [page, setPage] = useState(1);
    const [sourceFilter, setSourceFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const limit = 20;

    useEffect(() => {
        fetchBalance();
        fetchTransactions();
    }, [page, sourceFilter, categoryFilter]);

    const fetchBalance = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token || '';
            const res = await fetch('/api/wallet/balance', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setBalanceData(data);
            }
        } catch (err) {
            console.error('Failed to fetch balance', err);
        }
    };

    const fetchTransactions = async () => {
        setIsLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token || '';
            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
                ...(sourceFilter && { source: sourceFilter }),
                ...(categoryFilter && { category: categoryFilter })
            });

            const res = await fetch(`/api/wallet/transactions?${params.toString()}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setTransactions(data.data || []);
                setTotalTransactions(data.total || 0);
            }
        } catch (err) {
            console.error('Failed to fetch transactions', err);
        } finally {
            setIsLoading(false);
        }
    };

    const totalPages = Math.ceil(totalTransactions / limit);

    return (
        <div className="space-y-6 animate-fade-in p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">Wallet & Billing</h1>
                    <p className="text-sm text-slate-500 mt-1">Track your message costs and wallet balance.</p>
                </div>
                <button 
                    onClick={() => { fetchBalance(); fetchTransactions(); }}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium text-sm shadow-sm"
                >
                    <svg className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    Refresh
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-brand-600 to-brand-800 rounded-2xl p-6 text-white shadow-lg shadow-brand-500/20 relative overflow-hidden">
                    <div className="relative z-10">
                        <h3 className="text-brand-100 font-medium mb-1">Current Balance</h3>
                        <div className="text-4xl font-black mb-4">
                            ₹{typeof balanceData.balance === 'number' ? balanceData.balance.toFixed(2) : balanceData.balance}
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${balanceData.wallet_enforced ? 'bg-amber-500/20 text-amber-100 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-100 border border-emerald-500/30'}`}>
                                {balanceData.wallet_enforced ? 'MODE B: ENFORCED' : 'MODE A: REPORT ONLY'}
                            </span>
                        </div>
                    </div>
                    <CreditCardIcon className="w-32 h-32 absolute -bottom-6 -right-6 text-white opacity-10" />
                </div>

                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-center">
                    <h3 className="text-slate-500 font-medium mb-1 text-sm">Status</h3>
                    <div className="text-lg font-bold text-slate-800">
                        {balanceData.wallet_enforced ? (
                            <span className="text-amber-600">Pre-paid Billing Active</span>
                        ) : (
                            <span className="text-emerald-600">Unrestricted Sending</span>
                        )}
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                        {balanceData.wallet_enforced 
                            ? "Your messages will be blocked if balance reaches zero." 
                            : "Your balance is not currently enforced. You can send messages freely."}
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-4 items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
                <select 
                    value={sourceFilter}
                    onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
                    className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-brand-500 min-w-[150px]"
                >
                    <option value="">All Sources</option>
                    <option value="ADMIN_TOPUP">Top-ups</option>
                    <option value="CAMPAIGN_SEND">Campaigns</option>
                    <option value="DRIP_SEND">Drip Campaigns</option>
                    <option value="FLOW_SEND">Flow Automation</option>
                </select>

                <select 
                    value={categoryFilter}
                    onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
                    className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-brand-500 min-w-[150px]"
                >
                    <option value="">All Categories</option>
                    <option value="MARKETING">Marketing</option>
                    <option value="UTILITY">Utility</option>
                    <option value="AUTHENTICATION">Authentication</option>
                    <option value="SERVICE">Service</option>
                </select>
            </div>

            {/* Transactions Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {isLoading && transactions.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center">
                        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                        Loading transactions...
                    </div>
                ) : transactions.length === 0 ? (
                    <div className="p-16 text-center">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CreditCardIcon className="w-8 h-8 text-slate-300" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">No transactions yet</h3>
                        <p className="text-sm text-slate-500 mt-1">When you send messages or receive top-ups, they will appear here.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-100">
                            <thead className="bg-slate-50/80">
                                <tr>
                                    <th className="px-6 py-3 text-left text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-3 text-left text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Type / Source</th>
                                    <th className="px-6 py-3 text-left text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Details</th>
                                    <th className="px-6 py-3 text-right text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Amount</th>
                                    <th className="px-6 py-3 text-right text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Balance After</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {transactions.map((tx) => (
                                    <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-medium text-slate-900">
                                                {new Date(tx.created_at).toLocaleDateString()}
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                <span className={`inline-flex w-fit px-2 py-0.5 rounded text-[10px] font-bold ${
                                                    tx.type === 'CREDIT' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                                }`}>
                                                    {tx.type}
                                                </span>
                                                <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded w-fit">
                                                    {tx.source}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {tx.wa_category && (
                                                <div className="text-xs font-bold text-slate-700 mb-0.5">{tx.wa_category}</div>
                                            )}
                                            {tx.contact_phone && (
                                                <div className="text-xs text-slate-500 font-mono">To: {tx.contact_phone}</div>
                                            )}
                                            {tx.whatsapp_config?.phone_number && (
                                                <div className="text-[10px] text-slate-400 mt-1">From: {tx.whatsapp_config.phone_number}</div>
                                            )}
                                            {tx.description && (
                                                <div className="text-xs text-slate-600 mt-1">{tx.description}</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className={`text-sm font-bold ${tx.type === 'CREDIT' ? 'text-emerald-600' : 'text-slate-800'}`}>
                                                {tx.type === 'CREDIT' ? '+' : '-'}₹{Number(tx.amount).toFixed(4)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-sm font-medium text-slate-500">
                                                ₹{Number(tx.balance_after).toFixed(4)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
                        <div className="text-xs font-medium text-slate-500">
                            Showing page <span className="font-bold text-slate-700">{page}</span> of <span className="font-bold text-slate-700">{totalPages}</span>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="px-3 py-1.5 border border-slate-300 rounded text-slate-600 hover:bg-slate-50 disabled:opacity-50 text-xs font-bold bg-white"
                            >
                                Prev
                            </button>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="px-3 py-1.5 border border-slate-300 rounded text-slate-600 hover:bg-slate-50 disabled:opacity-50 text-xs font-bold bg-white"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WalletReport;
