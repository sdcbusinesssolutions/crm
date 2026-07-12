import React, { useState } from 'react';

import { supabase } from '../../lib/supabase';

const AiAgentAnalytics: React.FC = () => {
    const [leads, setLeads] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;

    React.useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    React.useEffect(() => {
        const fetchLeads = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.user?.id) return;
                
                const { data, error } = await supabase
                    .from('conversations')
                    .select('id, contact_phone, contact_name, lead_status, lead_summary, updated_at')
                    .eq('user_id', session.user.id)
                    .order('updated_at', { ascending: false })
                    .limit(50);
                    
                if (data && !error) {
                    const formatted = (data as any[])
                        .filter((d: any) => d.lead_summary && d.lead_summary.trim() !== '')
                        .map((d: any) => ({
                            id: d.id,
                            name: d.contact_name || 'Unknown',
                            email: '-',
                            phone: d.contact_phone || 'Unknown',
                            status: d.lead_status,
                            summary: d.lead_summary,
                            createdAt: d.updated_at
                        }));
                    setLeads(formatted);
                }
            } catch (err) {
                console.error("Failed to fetch lead analytics:", err);
            }
        };
        fetchLeads();
    }, []);

    const stats = {
        total: leads.length,
        hot: leads.filter(l => l.status === 'HOT').length,
        warm: leads.filter(l => l.status === 'WARM').length,
        cold: leads.filter(l => l.status === 'COLD').length,
    };

    const filteredLeads = leads.filter(lead => 
        lead.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.phone.includes(searchTerm)
    );

    const totalPages = Math.ceil(filteredLeads.length / pageSize);
    const paginatedLeads = filteredLeads.slice((currentPage - 1) * pageSize, currentPage * pageSize);

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
                return <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 w-max">{status || 'PENDING'}</span>;
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
                <div className="p-6 md:p-8 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-slate-50 to-white">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-gradient-to-br from-brand-500 to-indigo-600 rounded-2xl shadow-lg shadow-brand-500/30 flex items-center justify-center text-2xl text-white transform -rotate-6">
                            🤖
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-slate-900 tracking-tight">AI Lead Log</h3>
                            <p className="text-xs font-bold text-brand-600 uppercase tracking-widest mt-1">Live Automated Extraction</p>
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
                            className="w-full sm:w-80 pl-12 pr-4 py-3 bg-white border-2 border-slate-200 rounded-2xl focus:ring-4 focus:ring-brand-500/20 focus:border-brand-500 outline-none text-sm font-bold text-slate-800 transition-all shadow-sm placeholder-slate-400"
                        />
                    </div>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[900px]">
                        <thead className="bg-brand-600 text-white shadow-md">
                            <tr className="text-xs uppercase tracking-wider font-black">
                                <th className="px-8 py-5 text-left text-white drop-shadow-sm !bg-brand-600 whitespace-nowrap rounded-tl-lg">Profile</th>
                                <th className="px-8 py-5 text-left text-white drop-shadow-sm !bg-brand-600 whitespace-nowrap">Contact Info</th>
                                <th className="px-8 py-5 text-left text-white drop-shadow-sm !bg-brand-600 whitespace-nowrap">Qualification</th>
                                <th className="px-8 py-5 text-left text-white drop-shadow-sm !bg-brand-600 whitespace-nowrap w-2/5 rounded-tr-lg">AI Conversation Summary</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm bg-white">
                            {paginatedLeads.map((lead) => (
                                <tr key={lead.id} className="hover:bg-brand-50/30 transition-all duration-300 group">
                                    <td className="px-8 py-6 align-top">
                                        <div className="flex items-start gap-4">
                                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-500/30 border-2 border-white transform group-hover:scale-110 transition-transform duration-300">
                                                {lead.name.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="font-black text-slate-900 text-lg group-hover:text-brand-600 transition-colors">{lead.name}</div>
                                                <div className="text-slate-500 font-bold text-xs mt-1 bg-slate-100 px-2 py-1 rounded-md inline-block">
                                                    {new Date(lead.createdAt).toLocaleString(undefined, { 
                                                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 align-top">
                                        <div className="font-bold text-slate-800 flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-brand-100 group-hover:text-brand-600 transition-colors">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                                            </div>
                                            {lead.email}
                                        </div>
                                        <div className="text-slate-700 font-bold text-sm mt-3 flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-colors">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                                            </div>
                                            {lead.phone}
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 align-top">
                                        {getStatusBadge(lead.status)}
                                    </td>
                                    <td className="px-8 py-6 align-top">
                                        <div className="bg-gradient-to-br from-indigo-50 to-brand-50 p-5 rounded-2xl border border-indigo-100/50 shadow-sm text-slate-700 font-semibold text-sm leading-relaxed relative group-hover:shadow-md group-hover:-translate-y-1 transition-all duration-300">
                                            <div className="absolute -top-4 -left-3 bg-gradient-to-br from-brand-500 to-indigo-600 text-white w-8 h-8 rounded-full flex items-center justify-center shadow-lg border-2 border-white transform -rotate-12">
                                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z"/></svg>
                                            </div>
                                            {lead.summary || <span className="text-slate-400 italic">Conversation in progress...</span>}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredLeads.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-8 py-16 text-center">
                                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                                            <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                        </div>
                                        <h4 className="text-slate-800 font-bold text-lg mb-1">No leads found</h4>
                                        <p className="text-slate-500 font-medium">Try adjusting your search terms.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                
                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                        <div className="text-sm font-medium text-slate-500">
                            Showing <span className="font-bold text-slate-800">{((currentPage - 1) * pageSize) + 1}</span> to <span className="font-bold text-slate-800">{Math.min(currentPage * pageSize, filteredLeads.length)}</span> of <span className="font-bold text-slate-800">{filteredLeads.length}</span> leads
                        </div>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                            >
                                Previous
                            </button>
                            <button 
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
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
