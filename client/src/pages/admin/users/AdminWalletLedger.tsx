import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

// ─────────────────────────────────────────────────────────────────────────────
// AdminWalletLedger
// Full transaction ledger for a specific user — visible to Super Admin & Tenant Admin.
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
    wa_message_id: string | null;
    contact_phone: string | null;
    description: string | null;
    meta_cost: number | null;
    platform_cost: number | null;
    created_at: string;
    whatsapp_config?: { phone_number: string } | null;
    admin_profile?: { name: string; email: string } | null;
}

interface WalletSummary {
    total_debited: number;
    total_credited: number;
    total_meta_cost: number;
    total_platform_cost: number;
    by_category: Record<string, number>;
}

interface Props {
    user: { id: string; name: string; email: string } | null;
    onClose: () => void;
}

const SOURCE_LABELS: Record<string, string> = {
    ADMIN_TOPUP:    '⬆ Admin Top-up',
    RECHARGE:       '⬆ Recharge',
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

const AdminWalletLedger: React.FC<Props> = ({ user, onClose }) => {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [summary, setSummary] = useState<WalletSummary | null>(null);
    const [wallet, setWallet]   = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage]   = useState(1);
    const [total, setTotal] = useState(0);
    const LIMIT = 50;

    // Filters
    const [filterSource,   setFilterSource]   = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [filterType,     setFilterType]     = useState('');
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo,   setFilterDateTo]   = useState('');

    const fetchLedger = useCallback(async (p = 1) => {
        if (!user) return;
        setIsLoading(true);
        try {
            const token = localStorage.getItem('adminToken') || localStorage.getItem('supabase.auth.token');
            const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
            if (filterSource)   params.set('source',    filterSource);
            if (filterCategory) params.set('category',  filterCategory);
            if (filterType)     params.set('type',      filterType);
            if (filterDateFrom) params.set('date_from', filterDateFrom);
            if (filterDateTo)   params.set('date_to',   filterDateTo);

            const res = await fetch(`/api/wallet/admin/ledger/${user.id}?${params}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const json = await res.json();
                setTransactions(json.data || []);
                setTotal(json.total || 0);
                setSummary(json.summary || null);
                setWallet(json.wallet || null);
                setPage(p);
            }
        } catch (e) {
            console.error('Failed to load ledger:', e);
        } finally {
            setIsLoading(false);
        }
    }, [user, filterSource, filterCategory, filterType, filterDateFrom, filterDateTo]);

    useEffect(() => { fetchLedger(1); }, [fetchLedger]);

    const exportCSV = () => {
        if (!transactions.length) return;
        const headers = ['Date & Time', 'Type', 'Source', 'Category', 'Amount (₹)', 'Balance After (₹)', 'Meta Cost (₹)', 'Markup (₹)', 'Contact', 'WA Msg ID', 'Conv ID', 'Description'];
        const rows = transactions.map(tx => [
            new Date(tx.created_at).toLocaleString('en-IN'),
            tx.type,
            tx.source,
            tx.wa_category || '',
            tx.amount,
            tx.balance_after,
            tx.meta_cost !== null ? tx.meta_cost : '',
            tx.type === 'DEBIT' && tx.meta_cost !== null ? (Number(tx.amount) - Number(tx.meta_cost)).toFixed(4) : '',
            tx.contact_phone || '',
            tx.wa_message_id || '',
            tx.wa_conversation_id || '',
            (tx.description || '').replace(/,/g, ';')
        ]);
        const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `wallet_ledger_${user?.name?.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.csv`;
        a.click();
    };

    if (!user) return null;

    const totalPages = Math.ceil(total / LIMIT);

    return createPortal(
        <div className="fixed inset-0 z-[100] flex bg-slate-50 overflow-hidden">
            <div className="relative bg-white w-full h-full flex flex-col overflow-hidden">
                
                {/* Header */}
                <div className="flex-none flex items-center justify-between px-6 py-5 border-b border-slate-200 bg-gradient-to-r from-slate-900 to-slate-700">
                    <div>
                        <h2 className="text-xl font-black text-white">Wallet Ledger</h2>
                        <p className="text-sm text-slate-300 mt-0.5">
                            {user.name} · <span className="font-mono">{user.email}</span>
                        </p>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors text-xl">✕</button>
                </div>

                {/* Summary Cards */}
                <div className="flex-none grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 px-6 py-4 bg-slate-50 border-b border-slate-100">
                    <SummaryCard
                        label="Current Balance"
                        value={`₹${Number(wallet?.balance || 0).toFixed(2)}`}
                        theme={wallet?.wallet_enforced ? 'emerald' : 'slate'}
                        icon={wallet?.wallet_enforced ? '🔒' : '💳'}
                        sub={wallet?.wallet_enforced ? 'Enforced' : 'Not Enforced'}
                    />
                    <SummaryCard label="Total Debited"   value={`₹${(summary?.total_debited || 0).toFixed(2)}`}   theme="rose" icon="📉" />
                    <SummaryCard label="Total Credited"  value={`₹${(summary?.total_credited || 0).toFixed(2)}`}  theme="emerald" icon="💰" />
                    <SummaryCard label="Meta Cost"       value={`₹${(summary?.total_meta_cost || 0).toFixed(4)}`} theme="blue" icon="💬" />
                    <SummaryCard label="Marketing"       value={`₹${(summary?.by_category?.MARKETING || 0).toFixed(2)}`}  theme="rose" icon="📢" />
                    <SummaryCard label="Utility"         value={`₹${(summary?.by_category?.UTILITY || 0).toFixed(2)}`}    theme="blue" icon="🔌" />
                </div>

                {/* Filters */}
                <div className="flex-none flex flex-wrap gap-2 px-6 py-3 border-b border-slate-100 bg-white items-center z-10 shadow-sm relative">
                    <select value={filterSource} onChange={e => setFilterSource(e.target.value)}
                        className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20">
                        <option value="">All Sources</option>
                        {Object.keys(SOURCE_LABELS).map(s => <option key={s} value={s}>{SOURCE_LABELS[s]}</option>)}
                    </select>
                    <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
                        className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20">
                        <option value="">All Categories</option>
                        <option value="MARKETING">Marketing</option>
                        <option value="UTILITY">Utility</option>
                        <option value="AUTHENTICATION">Authentication</option>
                        <option value="SERVICE">Service</option>
                    </select>
                    <select value={filterType} onChange={e => setFilterType(e.target.value)}
                        className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20">
                        <option value="">All Types</option>
                        <option value="DEBIT">Debit</option>
                        <option value="CREDIT">Credit</option>
                    </select>
                    <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
                        className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
                    <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
                        className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
                    <button onClick={() => fetchLedger(1)}
                        className="px-4 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-bold hover:bg-brand-700 transition-colors">
                        Apply
                    </button>
                    <button onClick={() => { setFilterSource(''); setFilterCategory(''); setFilterType(''); setFilterDateFrom(''); setFilterDateTo(''); }}
                        className="px-4 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors">
                        Reset
                    </button>
                    <div className="ml-auto flex items-center gap-2">
                        <span className="text-xs text-slate-400">{total} transactions</span>
                        <button onClick={exportCSV}
                            className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors flex items-center gap-1">
                            ⬇ CSV
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto bg-slate-50 relative min-h-[200px]">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-48 text-slate-400">
                            <div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mr-3" />
                            Loading transactions...
                        </div>
                    ) : transactions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                            <div className="text-4xl mb-2">💳</div>
                            <p className="font-medium">No transactions found</p>
                        </div>
                    ) : (
                        <table className="min-w-full divide-y divide-slate-100 text-sm">
                            <thead className="bg-slate-50 sticky top-0">
                                <tr>
                                    {['Date & Time','Type','Source','Category','Amount','Balance After','Meta Cost','Markup','Contact','WA Msg ID','Conv ID','Description'].map(h => (
                                        <th key={h} className="px-3 py-1.5 text-left text-[10px] font-extrabold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
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
                                        <td className="px-3 py-1 text-[11px] text-slate-500 whitespace-nowrap font-mono">
                                            {new Date(tx.created_at).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'2-digit' })}
                                            <div className="text-[9px] text-slate-400">
                                                {new Date(tx.created_at).toLocaleTimeString('en-IN', { hour12: false })}
                                            </div>
                                        </td>
                                        <td className="px-3 py-1">
                                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${
                                                tx.type === 'CREDIT'
                                                    ? 'bg-emerald-100 text-emerald-700'
                                                    : 'bg-rose-100 text-rose-700'
                                            }`}>
                                                {tx.type === 'CREDIT' ? '+' : '−'} {tx.type}
                                            </span>
                                        </td>
                                        <td className="px-3 py-1 text-[11px] font-medium text-slate-600 whitespace-nowrap">
                                            {SOURCE_LABELS[tx.source] || tx.source}
                                        </td>
                                        <td className="px-3 py-1">
                                            {tx.wa_category ? (
                                                <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${CATEGORY_COLORS[tx.wa_category] || 'bg-slate-100 text-slate-600'}`}>
                                                    {tx.wa_category}
                                                </span>
                                            ) : <span className="text-slate-300 text-[11px]">—</span>}
                                        </td>
                                        <td className={`px-3 py-1 text-[12px] font-black tabular-nums whitespace-nowrap ${tx.type === 'CREDIT' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            {tx.type === 'CREDIT' ? '+' : '−'}₹{Number(tx.amount).toFixed(2)}
                                        </td>
                                        <td className="px-3 py-1 text-[12px] font-bold tabular-nums text-slate-700 whitespace-nowrap">
                                            ₹{Number(tx.balance_after).toFixed(2)}
                                        </td>
                                        <td className="px-3 py-1 text-[11px] text-slate-500 font-mono tabular-nums">
                                            {tx.meta_cost !== null ? `₹${Number(tx.meta_cost).toFixed(4)}` : '—'}
                                        </td>
                                        <td className="px-3 py-1 text-[11px] font-bold text-brand-600 font-mono tabular-nums bg-brand-50/50">
                                            {tx.type === 'DEBIT' && tx.meta_cost !== null
                                                ? `₹${(Math.abs(Number(tx.amount)) - Number(tx.meta_cost)).toFixed(4)}`
                                                : '—'}
                                        </td>
                                        <td className="px-3 py-1 text-[11px] font-mono text-slate-600">
                                            {tx.contact_phone || '—'}
                                        </td>
                                        <td className="px-3 py-1 text-[10px] font-mono text-slate-400 max-w-[120px] truncate" title={tx.wa_message_id || ''}>
                                            {tx.wa_message_id ? tx.wa_message_id.slice(-12) : '—'}
                                        </td>
                                        <td className="px-3 py-1 text-[10px] font-mono text-slate-400 max-w-[120px] truncate" title={tx.wa_conversation_id || ''}>
                                            {tx.wa_conversation_id ? tx.wa_conversation_id.slice(-12) : '—'}
                                        </td>
                                        <td className="px-3 py-1 text-[11px] text-slate-500 max-w-[200px]">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="line-clamp-2" title={tx.description || ''}>
                                                    {(tx.description || '—')
                                                        .replace(/Pre-debit at MAX RISK \([^)]+\) rate for requested ([^.]+)\. Will refund at webhook if cheaper.*/, 'Estimated charge for $1. Refund if cheaper.')
                                                        .replace(/Markup only charge: Message was free from Meta. Pre-debit [^,]+, markup [^.]+Refund: [0-9.]+/, 'Refund: Message was delivered for free.')}
                                                </span>
                                                {tx.type === 'CREDIT' && tx.source === 'ADMIN_TOPUP' && tx.admin_profile && (
                                                    <div className="text-[9px] font-medium text-brand-600 flex items-center gap-1 bg-brand-50 w-fit px-1.5 rounded border border-brand-100 mt-0.5">
                                                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                                        {tx.admin_profile.name || tx.admin_profile.email}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex-none flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
                        <span className="text-xs text-slate-500">
                            Page <b>{page}</b> of <b>{totalPages}</b> · {total} total
                        </span>
                        <div className="flex gap-2">
                            <button onClick={() => fetchLedger(Math.max(1, page - 1))} disabled={page <= 1}
                                className="px-4 py-2 text-xs font-bold border border-slate-200 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
                                ← Prev
                            </button>
                            <button onClick={() => fetchLedger(Math.min(totalPages, page + 1))} disabled={page >= totalPages}
                                className="px-4 py-2 text-xs font-bold border border-slate-200 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
                                Next →
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};

const THEMES: Record<string, any> = {
    emerald: { bg: 'bg-emerald-500', border: 'border-emerald-200', textVal: 'text-emerald-900', textLabel: 'text-emerald-600', shadow: 'shadow-emerald-500/30' },
    rose: { bg: 'bg-rose-500', border: 'border-rose-200', textVal: 'text-rose-900', textLabel: 'text-rose-600', shadow: 'shadow-rose-500/30' },
    blue: { bg: 'bg-blue-500', border: 'border-blue-200', textVal: 'text-blue-900', textLabel: 'text-blue-600', shadow: 'shadow-blue-500/30' },
    amber: { bg: 'bg-amber-500', border: 'border-amber-200', textVal: 'text-amber-900', textLabel: 'text-amber-600', shadow: 'shadow-amber-500/30' },
    slate: { bg: 'bg-slate-500', border: 'border-slate-200', textVal: 'text-slate-900', textLabel: 'text-slate-600', shadow: 'shadow-slate-500/30' }
};

const SummaryCard: React.FC<{ label: string; value: string; theme?: string; sub?: string; icon: string }> = ({ label, value, theme = 'slate', sub, icon }) => {
    const t = THEMES[theme] || THEMES.slate;
    return (
        <div className={`col-span-1 bg-white p-3 rounded-2xl border-2 ${t.border} shadow-sm flex items-center gap-3 hover:shadow-md transition-shadow`}>
            <div className={`w-10 h-10 rounded-xl ${t.bg} flex items-center justify-center shrink-0 shadow-lg ${t.shadow} text-white text-lg`}>
                {icon}
            </div>
            <div>
                <p className={`text-lg font-black ${t.textVal} tracking-tight tabular-nums leading-tight`}>{value}</p>
                <p className={`text-[9px] font-bold ${t.textLabel} uppercase tracking-wider mt-0.5`}>{label}</p>
                {sub && <p className={`text-[9px] ${t.textLabel} mt-0.5 opacity-80`}>{sub}</p>}
            </div>
        </div>
    );
};

export default AdminWalletLedger;
