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
    const [balanceData, setBalanceData] = useState({ balance: 0, wallet_enforced: false, thisMonthExpense: 0 });
    const [transactions, setTransactions] = useState<any[]>([]);
    const [totalTransactions, setTotalTransactions] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    // Filters
    const [page, setPage] = useState(1);
    const [sourceFilter, setSourceFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [limit, setLimit] = useState(20);

    useEffect(() => {
        fetchBalance();
        fetchTransactions();
    }, [page, limit, sourceFilter, categoryFilter, typeFilter, dateFrom, dateTo]);

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
                ...(typeFilter && { type: typeFilter }),
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

    const exportCSV = () => {
        if (!transactions.length) return;
        const headers = ['Date', 'Time', 'Tx ID', 'Type', 'Source', 'Category', 'Amount (₹)', 'Balance After (₹)', 'To Phone', 'Description', 'Admin Profile'];
        const rows = transactions.map(tx => {
            const date = new Date(tx.created_at).toLocaleDateString();
            const time = new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const adminInfo = tx.admin_profile ? (tx.admin_profile.name || tx.admin_profile.email) : '';
            return [
                date,
                time,
                tx.id,
                tx.type,
                tx.source,
                tx.wa_category || '',
                Number(tx.amount).toFixed(4),
                Number(tx.balance_after).toFixed(4),
                tx.contact_phone || '',
                (tx.description || '').replace(/,/g, ';').replace(/\n/g, ' '),
                adminInfo
            ];
        });
        const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `wallet_report_${new Date().toISOString().slice(0,10)}.csv`;
        a.click();
    };

    return (
        <div className="space-y-4 animate-fade-in p-4">
            <div className="flex items-center gap-3">
                <h1 className="text-xl font-black text-slate-900 tracking-tight">Wallet & Billing</h1>
                <button
                    onClick={() => { fetchBalance(); fetchTransactions(); }}
                    className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                    title="Refresh Data"
                >
                    <svg className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="col-span-1 bg-white p-5 rounded-2xl border-2 border-blue-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
                    <div className="w-14 h-14 rounded-xl bg-blue-500 flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/30 text-white text-2xl">
                        💳
                    </div>
                    <div>
                        <p className="text-3xl font-black text-blue-900 tracking-tight">
                            ₹{typeof balanceData.balance === 'number' ? balanceData.balance.toFixed(2) : balanceData.balance}
                        </p>
                        <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mt-1">Wallet Balance</p>
                        <p className="text-[9px] font-medium text-blue-400 mt-0.5">Available funds right now</p>
                    </div>
                </div>

                <div className="col-span-1 bg-white p-5 rounded-2xl border-2 border-rose-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
                    <div className="w-14 h-14 rounded-xl bg-rose-500 flex items-center justify-center shrink-0 shadow-lg shadow-rose-500/30 text-white text-2xl">
                        📉
                    </div>
                    <div>
                        <p className="text-3xl font-black text-rose-900 tracking-tight">
                            ₹{typeof balanceData.thisMonthExpense === 'number' ? balanceData.thisMonthExpense.toFixed(2) : '0.00'}
                        </p>
                        <p className="text-xs font-bold text-rose-600 uppercase tracking-wider mt-1">This Month's Expense</p>
                        <p className="text-[9px] font-medium text-rose-400 mt-0.5">Cumulative deductions this month</p>
                    </div>
                </div>

                <div className={`col-span-1 bg-white p-5 rounded-2xl border-2 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow ${balanceData.wallet_enforced ? 'border-amber-200' : 'border-emerald-200'}`}>
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 shadow-lg text-white text-2xl ${balanceData.wallet_enforced ? 'bg-amber-500 shadow-amber-500/30' : 'bg-emerald-500 shadow-emerald-500/30'}`}>
                        {balanceData.wallet_enforced ? '🔒' : '🔓'}
                    </div>
                    <div>
                        <p className={`text-[15px] font-black tracking-tight mt-1 ${balanceData.wallet_enforced ? 'text-amber-900' : 'text-emerald-900'}`}>
                            {balanceData.wallet_enforced ? 'Pre-paid Billing Active' : 'Tracking Mode Only'}
                        </p>
                        <p className={`text-xs font-bold uppercase tracking-wider mt-1 ${balanceData.wallet_enforced ? 'text-amber-600' : 'text-emerald-600'}`}>Billing Status</p>
                    </div>
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

                <select
                    value={typeFilter}
                    onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
                    className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-brand-500 min-w-[120px]"
                >
                    <option value="">All Types</option>
                    <option value="CREDIT">Credit (+)</option>
                    <option value="DEBIT">Debit (-)</option>
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

                <div className="flex gap-2">
                    {(sourceFilter || categoryFilter || typeFilter || dateFrom || dateTo || limit !== 20) && (
                        <button
                            onClick={() => { setSourceFilter(''); setCategoryFilter(''); setTypeFilter(''); setDateFrom(''); setDateTo(''); setLimit(20); setPage(1); }}
                            className="px-3 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-300 transition-colors"
                        >
                            Reset Filters
                        </button>
                    )}
                    <button
                        onClick={exportCSV}
                        className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2"
                        disabled={transactions.length === 0}
                    >
                        ⬇ Export CSV
                    </button>
                </div>
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
                    <div className="w-full overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)]">
                        <table className="w-full divide-y divide-slate-100 min-w-[900px]">
                            <thead className="bg-slate-50/80 sticky top-0 z-10">
                                <tr>
                                    <th className="px-3 py-1.5 text-left text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Date & Tx ID</th>
                                    <th className="px-3 py-1.5 text-left text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Type / Source</th>
                                    <th className="px-3 py-1.5 text-left text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Message Details</th>
                                    <th className="px-3 py-1.5 text-right text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Amount</th>
                                    <th className="px-3 py-1.5 text-right text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Balance After</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {transactions.map((tx) => (
                                    <tr key={tx.id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="px-3 py-1">
                                            <div className="text-xs font-medium text-slate-900">
                                                {new Date(tx.created_at).toLocaleDateString()}
                                            </div>
                                            <div className="text-[11px] text-slate-500 mb-0.5">
                                                {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                            </div>
                                            <div className="text-[10px] font-mono text-slate-400 truncate max-w-[120px]" title={`Tx ID: ${tx.id}`}>
                                                TX: {tx.id.split('-')[0]}
                                            </div>
                                        </td>
                                        <td className="px-3 py-1">
                                            <div className="flex flex-col gap-0.5">
                                                <span className={`inline-flex w-fit px-1.5 py-0.5 rounded text-[10px] font-bold ${tx.type === 'CREDIT' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                                    }`}>
                                                    {tx.type}
                                                </span>
                                                <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 w-fit">
                                                    {tx.source}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-1 max-w-sm">
                                            <div className="flex flex-wrap gap-1 mb-0.5">
                                                {tx.wa_category && (
                                                    <div className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${CATEGORY_COLORS[tx.wa_category] || 'bg-indigo-50 text-indigo-700 border-indigo-100'}`}>
                                                        {tx.wa_category}
                                                    </div>
                                                )}
                                                {tx.description?.includes('MAX RISK') && (
                                                    <div className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200" title="System reserves the estimated rate until delivery confirmation.">
                                                        ⏳ ESTIMATED COST
                                                    </div>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-0.5">
                                                {tx.contact_phone && (
                                                    <div className="text-[11px] text-slate-600"><span className="font-semibold text-slate-400">To:</span> {tx.contact_phone}</div>
                                                )}
                                                {tx.whatsapp_config?.phone_number && (
                                                    <div className="text-[11px] text-slate-600"><span className="font-semibold text-slate-400">From:</span> {tx.whatsapp_config.phone_number}</div>
                                                )}
                                                {/* Hidden technical IDs for normal users, but useful for support */}
                                                <div className="hidden group-hover:block mt-2">
                                                    {tx.whatsapp_account_id && (
                                                        <div className="text-[10px] text-slate-300 font-mono truncate" title={`WABA ID: ${tx.whatsapp_account_id}`}>
                                                            <span className="font-sans text-slate-300">WABA:</span> {tx.whatsapp_account_id.slice(-8)}
                                                        </div>
                                                    )}
                                                    {tx.wa_message_id && (
                                                        <div className="text-[10px] text-slate-300 font-mono truncate max-w-[200px]" title={`Msg ID: ${tx.wa_message_id}`}>
                                                            <span className="font-sans text-slate-300">MSG:</span> {tx.wa_message_id.startsWith('pending_api') ? '(Pending Meta ID)' : tx.wa_message_id}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {tx.description && (
                                                <div className="text-[10px] text-slate-600 mt-1 bg-slate-50 p-1.5 rounded border border-slate-100 leading-snug font-medium">
                                                    {tx.description
                                                        .replace(/Pre-debit at MAX RISK \([^)]+\) rate for requested ([^.]+)\. Will refund at webhook if cheaper.*/, 'Estimated charge for $1 message. If Meta charges less upon delivery, the difference will be automatically refunded.')
                                                        .replace(/Markup only charge: Message was free from Meta. Pre-debit [^,]+, markup [^.]+Refund: [0-9.]+/, 'Refund: Message was delivered for free (No markup applied).')}
                                                </div>
                                            )}
                                            
                                            {/* Show who topped up */}
                                            {tx.type === 'CREDIT' && tx.source === 'ADMIN_TOPUP' && tx.admin_profile && (
                                                <div className="text-[10px] font-medium text-brand-600 mt-1 flex items-center gap-1 bg-brand-50 w-fit px-1.5 py-0.5 rounded border border-brand-100">
                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                                    Added by: {tx.admin_profile.name || tx.admin_profile.email}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-3 py-1 text-right">
                                            <span className={`text-[12px] font-black tabular-nums ${tx.type === 'CREDIT' ? 'text-emerald-600' : 'text-slate-800'}`}>
                                                {tx.type === 'CREDIT' ? '+' : '-'}₹{Number(tx.amount).toFixed(2)}
                                            </span>
                                        </td>
                                        <td className="px-3 py-1 text-right">
                                            <span className="text-[12px] font-bold text-slate-600 tabular-nums bg-slate-50 px-1.5 py-0.5 rounded">
                                                ₹{Number(tx.balance_after).toFixed(2)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                <div className="px-4 py-3 border-t border-slate-200 bg-white flex flex-col sm:flex-row gap-3 justify-between items-center rounded-b-2xl">
                    <div className="text-[11px] font-medium text-slate-500">
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
