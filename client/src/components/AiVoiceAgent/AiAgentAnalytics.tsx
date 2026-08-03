import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

const AiAgentAnalytics: React.FC = () => {
    const [leads, setLeads] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [dateRange, setDateRange] = useState('ALL');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalLeadsCount, setTotalLeadsCount] = useState(0);
    const [stats, setStats] = useState({ total: 0, hot: 0, warm: 0, cold: 0 });
    const [isLoading, setIsLoading] = useState(false);
    const pageSize = 10;

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter, dateRange]);

    useEffect(() => {
        const fetchLeads = async () => {
            setIsLoading(true);
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.user?.id) return;
                
                // Fetch stats (independent of pagination/filters)
                const { data: allData } = await supabase
                    .from('conversations')
                    .select('lead_status')
                    .eq('user_id', session.user.id)
                    .not('assigned_ai_agent_id', 'is', null);
                
                if (allData) {
                    setStats({
                        total: allData.length,
                        hot: allData.filter(d => d.lead_status === 'HOT').length,
                        warm: allData.filter(d => d.lead_status === 'WARM').length,
                        cold: allData.filter(d => d.lead_status === 'COLD').length,
                    });
                }

                // Build query for table
                let query = supabase
                    .from('conversations')
                    .select('id, contact_phone, contact_name, lead_status, lead_summary, updated_at, assigned_ai_agent_id', { count: 'exact' })
                    .eq('user_id', session.user.id)
                    .not('assigned_ai_agent_id', 'is', null);

                if (statusFilter !== 'ALL') {
                    if (statusFilter === 'PENDING') {
                        query = query.is('lead_status', null);
                    } else {
                        query = query.eq('lead_status', statusFilter);
                    }
                }

                if (dateRange !== 'ALL') {
                    const now = new Date();
                    let pastDate = new Date();
                    if (dateRange === 'TODAY') {
                        pastDate.setHours(0, 0, 0, 0);
                    } else if (dateRange === 'LAST_7_DAYS') {
                        pastDate.setDate(now.getDate() - 7);
                    } else if (dateRange === 'LAST_30_DAYS') {
                        pastDate.setDate(now.getDate() - 30);
                    }
                    query = query.gte('updated_at', pastDate.toISOString());
                }

                if (searchTerm) {
                    query = query.or(`contact_name.ilike.%${searchTerm}%,contact_phone.ilike.%${searchTerm}%`);
                }

                const { data, count, error } = await query
                    .order('updated_at', { ascending: false })
                    .range((currentPage - 1) * pageSize, currentPage * pageSize - 1);
                    
                if (data && !error) {
                    const formatted = (data as any[]).map((d: any) => ({
                        id: d.id,
                        name: d.contact_name || 'Unknown',
                        email: '-',
                        phone: d.contact_phone || 'Unknown',
                        status: d.lead_status || 'PENDING',
                        summary: d.lead_summary || 'No summary extracted yet. Waiting for more context...',
                        createdAt: d.updated_at
                    }));
                    setLeads(formatted);
                    if (count !== null) setTotalLeadsCount(count);
                }
            } catch (err) {
                console.error("Failed to fetch lead analytics:", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchLeads();
    }, [currentPage, searchTerm, statusFilter, dateRange]);

    const totalPages = Math.ceil(totalLeadsCount / pageSize) || 1;

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'HOT':
                return (
                    <div className="relative inline-flex group">
                        <div className="absolute transition-all duration-1000 opacity-70 -inset-px bg-gradient-to-r from-[#ff4d4d] to-[#f9cb28] rounded-xl blur-lg group-hover:opacity-100 group-hover:-inset-1 group-hover:duration-200 animate-tilt"></div>
                        <span className="relative inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-900 bg-gradient-to-br from-red-50 to-red-100 border border-red-200 rounded-xl shadow-[0_0_15px_rgba(239,68,68,0.3)] w-max">
                            <span className="text-sm drop-shadow-sm">🔥</span> HOT
                        </span>
                    </div>
                );
            case 'WARM':
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-900 bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 rounded-xl shadow-sm w-max transition-transform hover:scale-105">
                        <span className="text-sm drop-shadow-sm">☀️</span> WARM
                    </span>
                );
            case 'COLD':
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-sky-900 bg-gradient-to-br from-sky-50 to-sky-100 border border-sky-200 rounded-xl shadow-sm w-max transition-transform hover:scale-105">
                        <span className="text-sm drop-shadow-sm">❄️</span> COLD
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200/80 rounded-xl shadow-sm w-max transition-all hover:bg-slate-100">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-500"></span>
                        </span>
                        {status || 'PENDING'}
                    </span>
                );
        }
    };

    return (
        <div className="space-y-8 animate-fade-in pb-12">
            
            {/* Premium KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                
                {/* Total Leads */}
                <div className="col-span-1 bg-white p-5 rounded-2xl border-2 border-indigo-300 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
                    <div className="w-14 h-14 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/30 text-white">
                        <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                        </svg>
                    </div>
                    <div>
                        <p className="text-3xl font-black text-indigo-900 tracking-tight">{stats.total}</p>
                        <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider mt-1">Total Leads</p>
                    </div>
                </div>

                {/* Hot Leads */}
                <div className="col-span-1 bg-white p-5 rounded-2xl border-2 border-rose-300 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
                    <div className="w-14 h-14 rounded-xl bg-rose-500 flex items-center justify-center shrink-0 shadow-lg shadow-rose-500/30 text-white text-3xl">
                        🔥
                    </div>
                    <div>
                        <p className="text-3xl font-black text-rose-900 tracking-tight">{stats.hot}</p>
                        <p className="text-xs font-bold text-rose-600 uppercase tracking-wider mt-1">Hot Leads</p>
                    </div>
                </div>

                {/* Warm Leads */}
                <div className="col-span-1 bg-white p-5 rounded-2xl border-2 border-amber-300 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
                    <div className="w-14 h-14 rounded-xl bg-amber-500 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/30 text-white text-2xl">
                        ☀️
                    </div>
                    <div>
                        <p className="text-3xl font-black text-amber-900 tracking-tight">{stats.warm}</p>
                        <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mt-1">Warm Leads</p>
                    </div>
                </div>

                {/* Cold Leads */}
                <div className="col-span-1 bg-white p-5 rounded-2xl border-2 border-sky-300 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
                    <div className="w-14 h-14 rounded-xl bg-sky-500 flex items-center justify-center shrink-0 shadow-lg shadow-sky-500/30 text-white text-2xl">
                        ❄️
                    </div>
                    <div>
                        <p className="text-3xl font-black text-sky-900 tracking-tight">{stats.cold}</p>
                        <p className="text-xs font-bold text-sky-600 uppercase tracking-wider mt-1">Cold Leads</p>
                    </div>
                </div>

            </div>

            {/* Premium Data Table */}
            <div className="bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-slate-200 overflow-hidden mt-8">
                <div className="p-6 md:p-8 border-b border-slate-200 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-gradient-to-r from-slate-50 to-white">
                    <div className="flex items-center gap-4 shrink-0">
                        <div className="w-14 h-14 bg-gradient-to-br from-brand-500 to-indigo-600 rounded-2xl shadow-lg shadow-brand-500/30 flex items-center justify-center text-2xl text-white transform -rotate-6">
                            🤖
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-slate-900 tracking-tight">AI Lead Log</h3>
                            <p className="text-xs font-bold text-brand-600 uppercase tracking-widest mt-1">Live Automated Extraction</p>
                        </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
                        <div className="relative w-full sm:w-auto group">
                            <select 
                                value={dateRange}
                                onChange={(e) => setDateRange(e.target.value)}
                                className="w-full sm:w-auto pl-4 pr-10 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-brand-500/20 focus:border-brand-500 outline-none text-sm font-bold text-slate-700 transition-all shadow-sm appearance-none cursor-pointer"
                            >
                                <option value="ALL">All Time</option>
                                <option value="TODAY">Today</option>
                                <option value="LAST_7_DAYS">Last 7 Days</option>
                                <option value="LAST_30_DAYS">Last 30 Days</option>
                            </select>
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </div>
                        </div>

                        <div className="relative w-full sm:w-auto group">
                            <select 
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="w-full sm:w-auto pl-4 pr-10 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-brand-500/20 focus:border-brand-500 outline-none text-sm font-bold text-slate-700 transition-all shadow-sm appearance-none cursor-pointer"
                            >
                                <option value="ALL">All Statuses</option>
                                <option value="HOT">Hot Leads</option>
                                <option value="WARM">Warm Leads</option>
                                <option value="COLD">Cold Leads</option>
                                <option value="PENDING">Pending</option>
                            </select>
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </div>
                        </div>

                        <div className="relative w-full sm:w-auto group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <svg className="w-5 h-5 text-slate-400 group-focus-within:text-brand-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            </div>
                            <input 
                                type="text"
                                placeholder="Search leads..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full sm:w-64 pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-brand-500/20 focus:border-brand-500 outline-none text-sm font-bold text-slate-800 transition-all shadow-sm placeholder-slate-400"
                            />
                        </div>
                    </div>
                </div>
                
                <div className="overflow-x-auto rounded-b-3xl bg-white min-h-[400px]">
                    <table className="w-full text-left border-collapse min-w-[900px]">
                        <thead className="bg-slate-50/80 backdrop-blur-xl border-b border-slate-200/80">
                            <tr className="text-[11px] uppercase tracking-[0.15em] font-bold text-slate-500">
                                <th className="px-8 py-5 text-left whitespace-nowrap">Profile</th>
                                <th className="px-8 py-5 text-left whitespace-nowrap">Contact Info</th>
                                <th className="px-8 py-5 text-left whitespace-nowrap">Qualification</th>
                                <th className="px-8 py-5 text-left whitespace-nowrap w-2/5">AI Conversation Summary</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/80 text-sm bg-white relative">
                            {isLoading && (
                                <tr>
                                    <td colSpan={4} className="px-8 py-16 text-center">
                                        <div className="flex flex-col items-center justify-center opacity-70">
                                            <svg className="w-10 h-10 animate-spin text-brand-500 mb-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                            <p className="text-slate-500 font-bold">Loading leads...</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                            
                            {!isLoading && leads.map((lead) => (
                                <tr key={lead.id} className="hover:bg-brand-50/30 transition-all duration-300 group">
                                    <td className="px-8 py-6 align-top">
                                        <div className="flex items-start gap-4">
                                            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-slate-800 to-slate-700 flex items-center justify-center text-white font-black text-xl shadow-[0_4px_12px_rgba(15,23,42,0.2)] border-2 border-white transform group-hover:scale-105 transition-transform duration-300">
                                                {lead.name.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="font-extrabold text-slate-900 text-[15px] group-hover:text-brand-600 transition-colors">{lead.name}</div>
                                                <div className="text-slate-500 font-semibold text-[11px] mt-1.5 flex items-center gap-1.5">
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                    {new Date(lead.createdAt).toLocaleString(undefined, { 
                                                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 align-top">
                                        <div className="font-semibold text-slate-700 flex items-center gap-3">
                                            <div className="w-7 h-7 rounded-full bg-slate-50 border border-slate-200/60 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:border-blue-200 group-hover:text-blue-500 transition-all duration-300">
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                                            </div>
                                            <span className="text-[13px]">{lead.email}</span>
                                        </div>
                                        <div className="text-slate-700 font-semibold flex items-center gap-3 mt-2.5">
                                            <div className="w-7 h-7 rounded-full bg-slate-50 border border-slate-200/60 flex items-center justify-center text-slate-400 group-hover:bg-emerald-50 group-hover:border-emerald-200 group-hover:text-emerald-500 transition-all duration-300">
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                                            </div>
                                            <span className="text-[13px]">{lead.phone}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 align-top">
                                        {getStatusBadge(lead.status)}
                                    </td>
                                    <td className="px-8 py-6 align-top">
                                        <div className="bg-[#f8fafc] border border-slate-200/80 p-4 rounded-2xl text-slate-600 font-medium text-[13px] leading-relaxed relative group-hover:shadow-[0_4px_15px_-3px_rgba(0,0,0,0.05)] group-hover:border-slate-300 group-hover:bg-white transition-all duration-300">
                                            <div className="absolute -top-3.5 -left-3.5 bg-white text-brand-600 w-8 h-8 rounded-full flex items-center justify-center shadow-sm border border-slate-200 transform group-hover:scale-110 transition-transform duration-300">
                                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z"/></svg>
                                            </div>
                                            <div className="pl-2 relative z-10">
                                                {lead.summary || <span className="text-slate-400 font-normal italic flex items-center gap-1.5"><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Conversation in progress...</span>}
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {!isLoading && leads.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-8 py-16 text-center">
                                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                                            <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                        </div>
                                        <h4 className="text-slate-800 font-bold text-lg mb-1">No leads found</h4>
                                        <p className="text-slate-500 font-medium">Try adjusting your filters or search terms.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                
                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-b-3xl">
                        <div className="text-sm font-medium text-slate-500">
                            Showing <span className="font-bold text-slate-800">{totalLeadsCount > 0 ? ((currentPage - 1) * pageSize) + 1 : 0}</span> to <span className="font-bold text-slate-800">{Math.min(currentPage * pageSize, totalLeadsCount)}</span> of <span className="font-bold text-slate-800">{totalLeadsCount}</span> leads
                        </div>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1 || isLoading}
                                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-brand-600 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                Previous
                            </button>
                            
                            <div className="flex items-center px-2">
                                <span className="text-sm font-bold text-slate-700 bg-slate-200/50 px-3 py-1 rounded-lg">Page {currentPage} of {totalPages}</span>
                            </div>

                            <button 
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages || isLoading}
                                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-brand-600 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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

export default AiAgentAnalytics;
