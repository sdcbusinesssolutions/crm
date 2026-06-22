import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

// ─────────────────────────────────────────────────────────────────────────────
// DomainLedgerModal
// Full transaction ledger for the entire domain — visible to Super Admin & Tenant Admin.
// Shows: balance summary cards, filterable transaction table, CSV export.
// ─────────────────────────────────────────────────────────────────────────────

interface Transaction {
    id: string;
    type: 'CREDIT' | 'DEBIT';
    amount: number;
    balance_after: number;
    source: string;
    wa_category: string | null;
    wa_conversation_id: string | null;
    whatsapp_account_id: string | null;
    wa_message_id: string | null;
    contact_phone: string | null;
    description: string | null;
    meta_cost: number | null;
    platform_cost: number | null;
    created_at: string;
    profiles?: { id: string; name: string; email: string; signup_domain: string } | null;
}

interface DomainSummary {
    total_distributed: number;
    total_consumed: number;
    total_meta_cost: number;
    total_platform_cost: number;
    total_agency_recharge: number;
}

interface Props {
    onClose: () => void;
    isSuperAdmin: boolean;
    domainFilter?: string; // Optional domain filter for Super Admin
}

const SOURCE_LABELS: Record<string, string> = {
    ADMIN_TOPUP:    '⬆ Distribution (Top-up)',
    RECHARGE:       '🏛 Agency Recharge',
    CAMPAIGN_SEND:  '📢 Campaign',
    DRIP_SEND:      '💧 Drip',
    FLOW_SEND:      '🔀 Flow',
    INBOX_SEND:     '💬 Inbox',
    API_SEND:       '🔌 API',
    REFUND:         '↩ Refund',
    ADJUSTMENT:     '⚖ Adjustment',
    WEBHOOK_SYNC:   '🔗 Webhook Sync',
};

const CATEGORY_COLORS: Record<string, string> = {
    MARKETING:      'bg-rose-100 text-rose-700',
    UTILITY:        'bg-blue-100 text-blue-700',
    AUTHENTICATION: 'bg-purple-100 text-purple-700',
    SERVICE:        'bg-slate-100 text-slate-700',
};

const DomainLedgerModal: React.FC<Props> = ({ onClose, isSuperAdmin, domainFilter }) => {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [summary, setSummary] = useState<DomainSummary | null>(null);
    const [masterWalletBalance, setMasterWalletBalance] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage]   = useState(1);
    const [total, setTotal] = useState(0);
    const LIMIT = 50;

    // Filters
    const [filterSource,     setFilterSource]     = useState('');
    const [filterType,       setFilterType]       = useState('');
    const [filterDateFrom,   setFilterDateFrom]   = useState('');
    const [filterDateTo,     setFilterDateTo]     = useState('');
    const [filterUserSearch, setFilterUserSearch] = useState('');

    const fetchLedger = useCallback(async (p = 1) => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('adminToken') || localStorage.getItem('supabase.auth.token');
            const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
            if (filterSource)       params.set('source',      filterSource);
            if (filterType)         params.set('type',        filterType);
            if (filterDateFrom)     params.set('date_from',   filterDateFrom);
            if (filterDateTo)       params.set('date_to',     filterDateTo);
            if (filterUserSearch)   params.set('user_search', filterUserSearch);
            if (isSuperAdmin && domainFilter && domainFilter !== 'all') {
                params.set('domain', domainFilter);
            }

            const res = await fetch(`/api/wallet/admin/domain-ledger?${params}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const json = await res.json();
                setTransactions(json.data || []);
                setTotal(json.total || 0);
                setSummary(json.summary || null);
                if (json.masterWalletBalance !== undefined && json.masterWalletBalance !== null) {
                    setMasterWalletBalance(json.masterWalletBalance);
                }
                setPage(p);
            }
        } catch (e) {
            console.error('Failed to load domain ledger:', e);
        } finally {
            setIsLoading(false);
        }
    }, [filterSource, filterType, filterDateFrom, filterDateTo, filterUserSearch, isSuperAdmin, domainFilter]);

    useEffect(() => { fetchLedger(1); }, [fetchLedger]);

    const exportCSV = () => {
        if (!transactions.length) return;
        const headers = ['Date', 'User Name', 'User Email', 'Type', 'Source', 'Category', 'Amount (₹)', 'Balance (₹)', 'Meta Cost (₹)', 'Platform Cost (₹)', 'Contact', 'WABA ID', 'WA Msg ID', 'Description'];
        const rows = transactions.map(tx => [
            new Date(tx.created_at).toLocaleString('en-IN'),
            tx.profiles?.name || 'Unknown',
            tx.profiles?.email || 'Unknown',
            tx.type,
            tx.source,
            tx.wa_category || '',
            tx.amount,
            tx.balance_after !== undefined && tx.balance_after !== null ? tx.balance_after : '',
            tx.meta_cost || '',
            tx.platform_cost || '',
            tx.contact_phone || '',
            tx.whatsapp_account_id || '',
            tx.wa_message_id || '',
            (tx.description || '').replace(/,/g, ';')
        ]);
        const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `domain_ledger_${new Date().toISOString().slice(0,10)}.csv`;
        a.click();
    };

    const totalPages = Math.ceil(total / LIMIT);
    const totalSaaSMarkup = (summary?.total_platform_cost || 0) - (summary?.total_meta_cost || 0);

    return createPortal(
        <div className="fixed inset-0 z-[100] flex bg-slate-50 overflow-hidden">
            <div className="relative bg-white w-full h-full flex flex-col overflow-hidden">
                
                {/* Header */}
                <div className="flex-none flex items-center justify-between px-6 py-5 border-b border-slate-200 bg-gradient-to-r from-slate-900 to-slate-700">
                    <div>
                        <h2 className="text-xl font-black text-white">Master Ledger Report 📊</h2>
                        <p className="text-sm text-slate-300 mt-0.5">
                            {isSuperAdmin && domainFilter !== 'all' ? `Filtered Domain: ${domainFilter}` : isSuperAdmin ? 'Platform-wide Transactions' : 'Domain-wide Transactions'}
                        </p>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors text-xl">✕</button>
                </div>

                {/* Summary Cards */}
                <div className="flex-none grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 px-6 py-4 bg-slate-50 border-b border-slate-100">
                    {!isSuperAdmin && masterWalletBalance !== null && (
                        <SummaryCard 
                            label="Agency Master Wallet" 
                            value={`₹${masterWalletBalance.toFixed(2)}`} 
                            color={masterWalletBalance > 1000 ? 'text-emerald-600' : 'text-amber-600'} 
                            sub="Current Wholesale Balance" 
                        />
                    )}
                    <SummaryCard 
                        label="Total Distributed"   
                        value={`₹${(summary?.total_distributed || 0).toFixed(2)}`}   
                        color="text-emerald-600" 
                        sub="Added to end-user wallets"
                    />
                    <SummaryCard 
                        label="Total Consumed"  
                        value={`₹${(summary?.total_consumed || 0).toFixed(2)}`}  
                        color="text-rose-600" 
                        sub="Spent by end-users"
                    />
                    <SummaryCard 
                        label="Total Meta Cost"       
                        value={`₹${(summary?.total_meta_cost || 0).toFixed(2)}`} 
                        color="text-blue-600" 
                        sub="Base cost to Meta"
                    />
                    <SummaryCard 
                        label="Platform SaaS Fee"       
                        value={`₹${totalSaaSMarkup.toFixed(2)}`} 
                        color="text-purple-600" 
                        sub="Markup generated"
                    />
                </div>

                {/* Filters */}
                <div className="flex-none flex flex-wrap gap-2 px-6 py-3 border-b border-slate-100 bg-white items-center z-10 shadow-sm relative">
                    <select value={filterSource} onChange={e => setFilterSource(e.target.value)}
                        className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20">
                        <option value="">All Sources</option>
                        {Object.keys(SOURCE_LABELS).map(s => <option key={s} value={s}>{SOURCE_LABELS[s]}</option>)}
                    </select>
                    <select value={filterType} onChange={e => setFilterType(e.target.value)}
                        className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20">
                        <option value="">All Types</option>
                        <option value="DEBIT">Usage (Debit)</option>
                        <option value="CREDIT">Top-up (Credit)</option>
                    </select>
                    <input type="text" placeholder="Filter by Name or Email" value={filterUserSearch} onChange={e => setFilterUserSearch(e.target.value)}
                        className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 w-44" />
                    <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
                        className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20" title="From Date" />
                    <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
                        className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20" title="To Date" />
                    <button onClick={() => fetchLedger(1)}
                        className="px-4 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-bold hover:bg-brand-700 transition-colors">
                        Apply Filters
                    </button>
                    <button onClick={() => { setFilterSource(''); setFilterType(''); setFilterDateFrom(''); setFilterDateTo(''); setFilterUserSearch(''); }}
                        className="px-4 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors">
                        Reset
                    </button>
                    <div className="ml-auto flex items-center gap-2">
                        <span className="text-xs text-slate-400">{total} transactions</span>
                        <button onClick={exportCSV}
                            className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors flex items-center gap-1">
                            ⬇ Export CSV
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto bg-slate-50 relative min-h-[200px]">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-48 text-slate-400">
                            <div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mr-3" />
                            Loading ledger...
                        </div>
                    ) : transactions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                            <div className="text-4xl mb-2">📊</div>
                            <p className="font-medium">No transactions found for these filters</p>
                        </div>
                    ) : (
                        <table className="min-w-full divide-y divide-slate-100 text-sm">
                            <thead className="bg-slate-50 sticky top-0">
                                <tr>
                                    {['Date','User','Type','Source','Category','Amount','Balance','Platform Cost','Meta Cost','Contact','WABA ID','WA Msg ID','Description'].map(h => (
                                        <th key={h} className="px-4 py-3 text-left text-[11px] font-extrabold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 bg-white">
                                {transactions.map(tx => (
                                    <tr key={tx.id} className={`hover:bg-slate-50/80 transition-colors ${
                                        tx.type === 'CREDIT'
                                            ? 'border-l-2 border-l-emerald-400'
                                            : tx.source === 'ADJUSTMENT'
                                            ? 'border-l-2 border-l-amber-400'
                                            : 'border-l-2 border-l-rose-300'
                                    }`}>
                                        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap font-mono">
                                            {new Date(tx.created_at).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'2-digit' })}
                                            <div className="text-[10px] text-slate-400">
                                                {new Date(tx.created_at).toLocaleTimeString('en-IN', { hour12: false })}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-xs">
                                            <div className="font-bold text-slate-800">{tx.profiles?.name || 'Unknown User'}</div>
                                            <div className="text-[10px] text-slate-400">{tx.profiles?.email}</div>
                                            {isSuperAdmin && tx.profiles?.signup_domain && (
                                                <div className="text-[9px] text-brand-600 bg-brand-50 px-1 py-0.5 rounded mt-0.5 inline-block">{tx.profiles.signup_domain}</div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-black uppercase ${
                                                tx.type === 'CREDIT'
                                                    ? 'bg-emerald-100 text-emerald-700'
                                                    : 'bg-rose-100 text-rose-700'
                                            }`}>
                                                {tx.type === 'CREDIT' ? '+' : '−'} {tx.type}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-xs font-medium text-slate-600 whitespace-nowrap">
                                            {SOURCE_LABELS[tx.source] || tx.source}
                                        </td>
                                        <td className="px-4 py-3">
                                            {tx.wa_category ? (
                                                <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold ${CATEGORY_COLORS[tx.wa_category] || 'bg-slate-100 text-slate-600'}`}>
                                                    {tx.wa_category}
                                                </span>
                                            ) : <span className="text-slate-300 text-xs">—</span>}
                                        </td>
                                        <td className={`px-4 py-3 text-sm font-black tabular-nums whitespace-nowrap ${tx.type === 'CREDIT' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            {tx.type === 'CREDIT' ? '+' : '−'}₹{Number(tx.amount).toFixed(2)}
                                        </td>
                                        <td className="px-4 py-3 text-sm font-bold text-slate-700 tabular-nums whitespace-nowrap">
                                            {tx.balance_after !== undefined && tx.balance_after !== null ? `₹${Number(tx.balance_after).toFixed(2)}` : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-500 font-mono tabular-nums">
                                            {tx.platform_cost ? `₹${Number(tx.platform_cost).toFixed(2)}` : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-500 font-mono tabular-nums">
                                            {tx.meta_cost ? `₹${Number(tx.meta_cost).toFixed(2)}` : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-xs font-mono text-slate-600">
                                            {tx.contact_phone || '—'}
                                        </td>
                                        <td className="px-4 py-3 text-[10px] font-mono text-slate-400 max-w-[80px] truncate" title={tx.whatsapp_account_id || ''}>
                                            {tx.whatsapp_account_id ? tx.whatsapp_account_id.slice(-8) : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-[10px] font-mono text-slate-400 max-w-[80px] truncate" title={tx.wa_message_id || ''}>
                                            {tx.wa_message_id ? tx.wa_message_id.slice(-10) : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-500 max-w-[200px]">
                                            <span className="line-clamp-2" title={tx.description || ''}>
                                                {tx.description || '—'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Pagination */}
                <div className="flex-none flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
                    <span className="text-xs text-slate-500">
                        Page <b>{page}</b> of <b>{Math.max(1, totalPages)}</b> · {total} total transactions
                    </span>
                    <div className="flex gap-1.5 items-center">
                        <button onClick={() => fetchLedger(Math.max(1, page - 1))} disabled={page <= 1}
                            className="px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
                            ← Prev
                        </button>
                        
                        <div className="hidden sm:flex gap-1.5 mx-2">
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let startPage = Math.max(1, page - 2);
                                if (startPage + 4 > totalPages) startPage = Math.max(1, totalPages - 4);
                                const p = startPage + i;
                                if (p > totalPages) return null;
                                
                                return (
                                    <button
                                        key={p}
                                        onClick={() => fetchLedger(p)}
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

                        <button onClick={() => fetchLedger(Math.min(totalPages, page + 1))} disabled={page >= totalPages}
                            className="px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
                            Next →
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

const SummaryCard: React.FC<{ label: string; value: string; color?: string; sub?: string }> = ({ label, value, color = 'text-slate-800', sub }) => (
    <div className="bg-white rounded-xl border border-slate-100 px-4 py-3 shadow-sm flex flex-col justify-between">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</div>
        <div className={`text-lg font-black tabular-nums ${color}`}>{value}</div>
        {sub && <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
);

export default DomainLedgerModal;
