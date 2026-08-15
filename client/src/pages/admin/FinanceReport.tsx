import React, { useState, useEffect, useCallback } from 'react';
import { themeService, PRESETS } from '../../services/themeService';

interface UserFinanceRow {
    user_id: string;
    email: string;
    name: string;
    phone: string;
    waba_id: string;
    current_balance: number;
    deposited_balance: number;
    spend_balance: number;
    lifetime_deposited_balance: number;
    lifetime_spend_balance: number;
    billing_mode?: string;
    wallet_enforced?: boolean;
    created_at?: string;
}

const FinanceReport = () => {
    const [data, setData] = useState<UserFinanceRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Filters
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo, setFilterDateTo] = useState('');

    // Suspicious Filter
    const [showSuspiciousOnly, setShowSuspiciousOnly] = useState(false);

    // Super Admin Domain Filter
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [domains, setDomains] = useState<any[]>([]);
    const [domainFilter, setDomainFilter] = useState('all');

    useEffect(() => {
        const checkSuperAdmin = async () => {
            let isMaster = false;
            try {
                const token = localStorage.getItem('adminToken');
                if (token) {
                    const res = await fetch('/api/admin/auth/me', {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (res.ok) {
                        const adminData = await res.json();
                        isMaster = adminData.role === 'super_admin';
                    }
                }
            } catch (e) {
                console.error('Failed to verify admin role', e);
            }
            if (!isMaster) {
                // @ts-ignore
                const MASTER_URL = (import.meta as any).env.VITE_MASTER_URL || '';
                const hostname = window.location.hostname;
                isMaster = MASTER_URL.includes(hostname) || hostname.includes('localhost');
            }
            setIsSuperAdmin(isMaster);
            if (isMaster) {
                fetchDomains();
            }
        };

        const fetchDomains = async () => {
            try {
                const token = localStorage.getItem('adminToken');
                const res = await fetch('/api/admin/dashboard/tenants', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setDomains(data);
                }
            } catch (e) {
                console.error("Failed to load domains", e);
            }
        };

        checkSuperAdmin();
    }, []);

    const fetchReport = useCallback(async () => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('adminToken');
            const params = new URLSearchParams();
            if (filterDateFrom) params.set('date_from', filterDateFrom);
            if (filterDateTo) params.set('date_to', filterDateTo);
            if (isSuperAdmin && domainFilter && domainFilter !== 'all') {
                params.set('domain', domainFilter);
            }

            const res = await fetch(`/api/wallet/admin/finance-report?${params}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const json = await res.json();
                setData(json.data || []);
            }
        } catch (error) {
            console.error('Failed to load finance report', error);
        } finally {
            setIsLoading(false);
        }
    }, [filterDateFrom, filterDateTo, isSuperAdmin, domainFilter]);

    useEffect(() => {
        fetchReport();
    }, [fetchReport]);

    const getRiskStatus = (row: UserFinanceRow) => {
        if (row.billing_mode === 'DIRECT_META') {
            return { label: '💳 DIRECT META', color: 'bg-blue-100 text-blue-800 border-blue-200', rowBg: 'hover:bg-slate-50/80 border-l-4 border-blue-400', isSuspicious: false };
        }
        if (row.current_balance < 0) {
            return { label: '⚠️ LOOPHOLE (DEBT)', color: 'bg-red-100 text-red-800 border-red-200', rowBg: 'bg-red-50 hover:bg-red-100/80 border-l-4 border-red-500', isSuspicious: true };
        }
        if (row.lifetime_spend_balance > 0 && row.lifetime_deposited_balance === 0 && row.current_balance < 10) {
            return { label: '👀 SUSPICIOUS', color: 'bg-amber-100 text-amber-800 border-amber-200', rowBg: 'bg-amber-50/50 hover:bg-amber-50 border-l-4 border-amber-400', isSuspicious: true };
        }
        if (row.lifetime_spend_balance > row.lifetime_deposited_balance * 5 && row.lifetime_spend_balance > 100) {
            return { label: '🔥 HIGH SPEND', color: 'bg-orange-100 text-orange-800 border-orange-200', rowBg: 'hover:bg-slate-50/80 border-l-4 border-transparent', isSuspicious: true };
        }
        return { label: '🟢 PRE-PAID', color: 'bg-emerald-50 text-emerald-600 border-emerald-100', rowBg: 'hover:bg-slate-50/80 border-l-4 border-transparent', isSuspicious: false };
    };

    const exportCSV = () => {
        const dataToExport = showSuspiciousOnly ? data.filter(r => getRiskStatus(r).isSuspicious) : data;
        if (!dataToExport.length) return;
        const headers = ['Joined Date', 'Name', 'Email', 'Phone', 'WABA ID', 'Current Balance', 'Total Distributed', 'Total Consumed', 'Risk Label'];
        const rows = dataToExport.map(r => [
            r.created_at ? new Date(r.created_at).toLocaleDateString() : '—',
            r.name || 'Unknown',
            r.email || '',
            r.phone || '',
            r.waba_id || '',
            r.current_balance,
            r.deposited_balance,
            r.spend_balance,
            getRiskStatus(r).label || ''
        ]);
        const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `financial_report_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
    };

    const handleQuickFilter = (val: string) => {
        const now = new Date();
        if (val === 'this_week') {
            const first = now.getDate() - now.getDay();
            const last = first + 6;
            setFilterDateFrom(new Date(now.setDate(first)).toISOString().slice(0, 10));
            setFilterDateTo(new Date(now.setDate(last)).toISOString().slice(0, 10));
        } else if (val === 'this_month') {
            setFilterDateFrom(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10));
            setFilterDateTo(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10));
        } else if (val === 'last_month') {
            setFilterDateFrom(new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10));
            setFilterDateTo(new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10));
        } else if (val === 'this_year') {
            setFilterDateFrom(new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10));
            setFilterDateTo(new Date(now.getFullYear(), 11, 31).toISOString().slice(0, 10));
        } else {
            setFilterDateFrom('');
            setFilterDateTo('');
        }
    };

    const filteredData = showSuspiciousOnly ? data.filter(r => getRiskStatus(r).isSuspicious) : data;

    const totalDeposits = data.reduce((sum, r) => sum + r.deposited_balance, 0);
    const totalSpend = data.reduce((sum, r) => sum + r.spend_balance, 0);
    const suspiciousCount = data.filter(r => getRiskStatus(r).isSuspicious).length;

    return (
        <div className="space-y-5">
            {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <h1 className="text-xl font-black text-slate-900 tracking-tight">Financial Analytics 📈</h1>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-center">
                    <select
                        onChange={e => handleQuickFilter(e.target.value)}
                        className="border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    >
                        <option value="">All Time</option>
                        <option value="this_week">This Week</option>
                        <option value="this_month">This Month</option>
                        <option value="last_month">Last Month</option>
                        <option value="this_year">This Year</option>
                    </select>

                    {isSuperAdmin && domains.length > 0 && (
                        <select
                            value={domainFilter}
                            onChange={(e) => setDomainFilter(e.target.value)}
                            className="border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                        >
                            <option value="all">All Domains</option>
                            {domains.map(d => (
                                <option key={d.domain} value={d.domain}>{d.domain}</option>
                            ))}
                        </select>
                    )}
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">From</span>
                        <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
                            className="border border-slate-200 rounded-xl px-4 py-2 text-sm font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">To</span>
                        <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
                            className="border border-slate-200 rounded-xl px-4 py-2 text-sm font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
                    </div>
                    
                    <div className="ml-auto flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer bg-red-50 px-4 py-2 rounded-xl border border-red-100 hover:bg-red-100 transition-colors">
                            <input 
                                type="checkbox" 
                                checked={showSuspiciousOnly}
                                onChange={e => setShowSuspiciousOnly(e.target.checked)}
                                className="w-4 h-4 text-red-600 border-red-300 rounded focus:ring-red-500"
                            />
                            <span className="text-sm font-black text-red-700">Find Suspicious</span>
                        </label>
                        
                        <button onClick={exportCSV} className="px-5 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-sm font-black transition-colors flex items-center gap-2">
                            ⬇ Export CSV
                        </button>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="col-span-1 bg-white p-5 rounded-2xl border-2 border-emerald-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
                        <div className="w-14 h-14 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/30 text-white text-2xl">
                            💰
                        </div>
                        <div>
                            <p className="text-3xl font-black text-emerald-900 tracking-tight">₹{totalDeposits.toFixed(2)}</p>
                            <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mt-1">Total Distributed</p>
                        </div>
                    </div>
                    
                    <div className="col-span-1 bg-white p-5 rounded-2xl border-2 border-rose-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
                        <div className="w-14 h-14 rounded-xl bg-rose-500 flex items-center justify-center shrink-0 shadow-lg shadow-rose-500/30 text-white text-2xl">
                            📉
                        </div>
                        <div>
                            <p className="text-3xl font-black text-rose-900 tracking-tight">₹{totalSpend.toFixed(2)}</p>
                            <p className="text-xs font-bold text-rose-600 uppercase tracking-wider mt-1">Total Consumed</p>
                        </div>
                    </div>
                    
                    <div className="col-span-1 bg-white p-5 rounded-2xl border-2 border-amber-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
                        <div className="w-14 h-14 rounded-xl bg-amber-500 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/30 text-white text-2xl">
                            ⚠️
                        </div>
                        <div>
                            <p className="text-3xl font-black text-amber-900 tracking-tight">{suspiciousCount}</p>
                            <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mt-1">Suspicious Users</p>
                        </div>
                    </div>
                </div>

                {/* Data Table */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">Joined Date</th>
                                    <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">User</th>
                                    <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">Contact</th>
                                    <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">WABA ID</th>
                                    <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap text-right">Current Balance</th>
                                    <th className="px-6 py-4 text-[11px] font-black text-emerald-500 uppercase tracking-wider whitespace-nowrap text-right">Total Distributed</th>
                                    <th className="px-6 py-4 text-[11px] font-black text-rose-500 uppercase tracking-wider whitespace-nowrap text-right">Total Consumed</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-medium">
                                            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                                            Loading financial data...
                                        </td>
                                    </tr>
                                ) : filteredData.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-medium">
                                            <div className="text-4xl mb-2">📊</div>
                                            No user data found.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredData.map(row => {
                                        let riskStatus = null;
                                        
                                        if (row.billing_mode === 'DIRECT_META') {
                                            riskStatus = { label: '💳 DIRECT META', color: 'bg-blue-100 text-blue-800 border-blue-200', rowBg: 'hover:bg-slate-50/80 border-l-4 border-blue-400' };
                                        } else {
                                            // PRE_PAID WALLET LOGIC
                                            if (row.current_balance < 0) {
                                                riskStatus = { label: '⚠️ LOOPHOLE (DEBT)', color: 'bg-red-100 text-red-800 border-red-200', rowBg: 'bg-red-50 hover:bg-red-100/80 border-l-4 border-red-500' };
                                            } else if (row.spend_balance > 0 && row.deposited_balance === 0 && row.current_balance < 10) {
                                                riskStatus = { label: '👀 SUSPICIOUS', color: 'bg-amber-100 text-amber-800 border-amber-200', rowBg: 'bg-amber-50/50 hover:bg-amber-50 border-l-4 border-amber-400' };
                                            } else if (row.spend_balance > row.deposited_balance * 5 && row.spend_balance > 100) {
                                                riskStatus = { label: '🔥 HIGH SPEND', color: 'bg-orange-100 text-orange-800 border-orange-200', rowBg: 'hover:bg-slate-50/80 border-l-4 border-transparent' };
                                            } else {
                                                riskStatus = { label: '🟢 PRE-PAID', color: 'bg-emerald-50 text-emerald-600 border-emerald-100', rowBg: 'hover:bg-slate-50/80 border-l-4 border-transparent' };
                                            }
                                        }

                                        return (
                                        <tr key={row.user_id} className={`transition-colors ${riskStatus.rowBg}`}>
                                            <td className="px-6 py-4 text-xs font-medium text-slate-500 whitespace-nowrap">
                                                {row.created_at ? new Date(row.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-slate-900 flex items-center gap-2">
                                                    {row.name || 'Unknown User'}
                                                    {riskStatus.label && (
                                                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase tracking-wider ${riskStatus.color}`}>
                                                            {riskStatus.label}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-slate-500 mt-0.5">{row.email}</div>
                                            </td>
                                            <td className="px-6 py-4 text-xs font-mono text-slate-600">
                                                {row.phone}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded inline-block">
                                                    {row.waba_id}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className={`font-black tabular-nums ${row.current_balance < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                                                    ₹{Number(row.current_balance).toFixed(2)}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="font-bold text-emerald-600 tabular-nums">
                                                    {row.deposited_balance > 0 ? '+' : ''}₹{Number(row.deposited_balance).toFixed(2)}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="font-bold text-rose-600 tabular-nums">
                                                    {row.spend_balance > 0 ? '-' : ''}₹{Number(row.spend_balance).toFixed(2)}
                                                </div>
                                            </td>
                                        </tr>
                                    )})
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
        </div>
    );
};

export default FinanceReport;
