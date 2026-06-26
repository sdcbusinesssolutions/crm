import React, { useState, useEffect } from 'react';
import { CreditCardIcon } from '../../components/icons';
import { supabase } from '../../lib/supabase';

const CATEGORY_COLORS: Record<string, string> = {
    MARKETING:      'bg-rose-100 text-rose-700 border-rose-200',
    UTILITY:        'bg-blue-100 text-blue-700 border-blue-200',
    AUTHENTICATION: 'bg-purple-100 text-purple-700 border-purple-200',
    SERVICE:        'bg-slate-100 text-slate-700 border-slate-200',
};

const WalletReport = () => {
    const [balanceData, setBalanceData] = useState({ balance: 0, wallet_enforced: false });
    const [transactions, setTransactions] = useState<any[]>([]);
    const [totalTransactions, setTotalTransactions] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    // Filters
    const [page, setPage] = useState(1);
    const [sourceFilter, setSourceFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [limit, setLimit] = useState(20);

    useEffect(() => {
        fetchBalance();
        fetchTransactions();
    }, [page, limit, sourceFilter, categoryFilter, dateFrom, dateTo]);

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
                ...(categoryFilter && { category: categoryFilter }),
                ...(dateFrom && { date_from: dateFrom }),
                ...(dateTo && { date_to: dateTo })
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-center">
                    <div className="relative z-10">
                        <h3 className="text-slate-500 font-medium text-sm tracking-wide uppercase mb-1">Current Balance</h3>
                        <div className="text-5xl font-black text-slate-900 mb-4 tracking-tight">
                            ₹{typeof balanceData.balance === 'number' ? balanceData.balance.toFixed(2) : balanceData.balance}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${balanceData.wallet_enforced ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                                <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${balanceData.wallet_enforced ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                                {balanceData.wallet_enforced ? 'MODE B: ENFORCED' : 'MODE A: REPORT ONLY'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-center">
                    <h3 className="text-slate-500 font-medium text-sm tracking-wide uppercase mb-1">Billing Status</h3>
                    <div className="text-xl font-bold mb-1">
                        {balanceData.wallet_enforced ? (
                            <span className="text-amber-600">Pre-paid Billing Active</span>
                        ) : (
                            <span className="text-emerald-600">Unrestricted Sending</span>
                        )}
                    </div>
                    <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                        {balanceData.wallet_enforced
                            ? "Your messages will be blocked if your balance reaches zero. Top-up to avoid service disruption."
                            : "Your balance is not currently enforced. You can send messages freely for now."}
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4 items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
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

                <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                    className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-brand-500"
                    title="From Date"
                />
                
                <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                    className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-brand-500"
                    title="To Date"
                />

                <select
                    value={limit}
                    onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                    className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-brand-500 ml-auto"
                >
                    <option value={10}>10 / page</option>
                    <option value={20}>20 / page</option>
                    <option value={50}>50 / page</option>
                    <option value={100}>100 / page</option>
                </select>

                {(sourceFilter || categoryFilter || dateFrom || dateTo || limit !== 20) && (
                    <button
                        onClick={() => { setSourceFilter(''); setCategoryFilter(''); setDateFrom(''); setDateTo(''); setLimit(20); setPage(1); }}
                        className="px-3 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-300 transition-colors"
                    >
                        Reset Filters
                    </button>
                )}
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
                    <div className="w-full overflow-x-auto overflow-y-auto max-h-[400px]">
                        <table className="w-full divide-y divide-slate-100 min-w-[900px]">
                            <thead className="bg-slate-50/80">
                                <tr>
                                    <th className="px-6 py-3 text-left text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Date & Tx ID</th>
                                    <th className="px-6 py-3 text-left text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Type / Source</th>
                                    <th className="px-6 py-3 text-left text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Message Details</th>
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
                                            <div className="text-xs text-slate-500 mb-1">
                                                {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                            </div>
                                            <div className="text-[10px] font-mono text-slate-400 truncate max-w-[120px]" title={`Tx ID: ${tx.id}`}>
                                                TX: {tx.id.split('-')[0]}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1.5">
                                                <span className={`inline-flex w-fit px-2 py-0.5 rounded text-[10px] font-bold ${tx.type === 'CREDIT' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                                    }`}>
                                                    {tx.type}
                                                </span>
                                                <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 w-fit">
                                                    {tx.source}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 max-w-sm">
                                            <div className="flex flex-wrap gap-2 mb-2">
                                                {tx.wa_category && (
                                                    <div className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${CATEGORY_COLORS[tx.wa_category] || 'bg-indigo-50 text-indigo-700 border-indigo-100'}`}>
                                                        {tx.wa_category}
                                                    </div>
                                                )}
                                                {tx.description?.includes('MAX RISK') && (
                                                    <div className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200" title="System reserves the most expensive rate until Meta confirms the final category.">
                                                        🛡️ MAX-RISK HOLD
                                                    </div>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1">
                                                {tx.contact_phone && (
                                                    <div className="text-[11px] text-slate-600"><span className="font-semibold text-slate-400">To:</span> {tx.contact_phone}</div>
                                                )}
                                                {tx.whatsapp_config?.phone_number && (
                                                    <div className="text-[11px] text-slate-600"><span className="font-semibold text-slate-400">From:</span> {tx.whatsapp_config.phone_number}</div>
                                                )}
                                                {tx.whatsapp_account_id && (
                                                    <div className="text-[10px] text-slate-500 font-mono truncate" title={`WABA ID: ${tx.whatsapp_account_id}`}>
                                                        <span className="font-sans font-semibold text-slate-400">WABA:</span> {tx.whatsapp_account_id.slice(-8)}
                                                    </div>
                                                )}
                                                {tx.wa_message_id && (
                                                    <div className="text-[10px] text-slate-500 font-mono truncate max-w-[200px]" title={`Msg ID: ${tx.wa_message_id}`}>
                                                        <span className="font-sans font-semibold text-slate-400">MSG:</span> {tx.wa_message_id}
                                                    </div>
                                                )}
                                            </div>

                                            {tx.description && (
                                                <div className="text-[11px] text-slate-500 mt-2 bg-slate-50 p-2 rounded border border-slate-100 leading-relaxed">
                                                    {tx.description}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className={`text-sm font-black tabular-nums ${tx.type === 'CREDIT' ? 'text-emerald-600' : 'text-slate-800'}`}>
                                                {tx.type === 'CREDIT' ? '+' : '-'}₹{Number(tx.amount).toFixed(4)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-sm font-bold text-slate-600 tabular-nums bg-slate-50 px-2 py-1 rounded">
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
                <div className="px-6 py-4 border-t border-slate-200 bg-white flex flex-col sm:flex-row gap-4 justify-between items-center rounded-b-2xl">
                    <div className="text-xs font-medium text-slate-500">
                        Showing page <span className="font-bold text-slate-700">{page}</span> of <span className="font-bold text-slate-700">{Math.max(1, totalPages)}</span> · {totalTransactions} total
                    </div>
                    <div className="flex gap-1.5 items-center">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page <= 1}
                            className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40 text-xs font-bold bg-white transition-colors"
                        >
                            ← Prev
                        </button>
                        
                        <div className="hidden sm:flex gap-1.5 mx-2">
                            {Array.from({ length: Math.min(5, Math.max(1, totalPages)) }, (_, i) => {
                                let startPage = Math.max(1, page - 2);
                                if (startPage + 4 > Math.max(1, totalPages)) startPage = Math.max(1, Math.max(1, totalPages) - 4);
                                const p = startPage + i;
                                if (p > Math.max(1, totalPages)) return null;
                                
                                return (
                                    <button
                                        key={p}
                                        onClick={() => setPage(p)}
                                        className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-colors ${
                                            page === p 
                                                ? 'bg-brand-600 text-white border border-brand-600' 
                                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        {p}
                                    </button>
                                );
                            })}
                        </div>

                        <button
                            onClick={() => setPage(p => Math.min(Math.max(1, totalPages), p + 1))}
                            disabled={page >= Math.max(1, totalPages)}
                            className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40 text-xs font-bold bg-white transition-colors"
                        >
                            Next →
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WalletReport;
