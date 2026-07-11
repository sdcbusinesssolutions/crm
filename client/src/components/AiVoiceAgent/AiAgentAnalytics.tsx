import React, { useState } from 'react';

// Mock Data for Demo
const MOCK_LEADS = [
    {
        id: '1',
        name: 'Rahul Sharma',
        email: 'rahul.s@example.com',
        phone: '+91 98765 43210',
        status: 'HOT',
        summary: 'Highly interested in the Premium Plan. Asked for a demo link and pricing details immediately.',
        createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    },
    {
        id: '2',
        name: 'Priya Patel',
        email: 'priya.design@gmail.com',
        phone: '+91 87654 32109',
        status: 'WARM',
        summary: 'Looking for a CRM solution. Asked about WhatsApp API limits. Needs follow up next week.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    },
    {
        id: '3',
        name: 'Amit Kumar',
        email: 'amit.k88@yahoo.com',
        phone: '+91 76543 21098',
        status: 'COLD',
        summary: 'Just browsing. Said they do not have budget right now. Sent them a link to the free resources.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    },
    {
        id: '4',
        name: 'Neha Gupta',
        email: 'neha.g@startup.in',
        phone: '+91 99887 76655',
        status: 'HOT',
        summary: 'Wants to automate their lead generation immediately. Requested a callback ASAP.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    }
];

const AiAgentAnalytics: React.FC = () => {
    const [leads] = useState(MOCK_LEADS);
    const [searchTerm, setSearchTerm] = useState('');

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
                return <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 w-max">{status}</span>;
        }
    };

    return (
        <div className="space-y-8 animate-fade-in pb-12">
            
            {/* Premium Header Zone */}
            <div className="relative overflow-hidden bg-slate-900 rounded-[2rem] p-8 md:p-10 shadow-2xl border border-slate-800">
                {/* Decorative background glows */}
                <div className="absolute top-0 left-0 w-96 h-96 bg-brand-500 rounded-full mix-blend-multiply filter blur-[128px] opacity-40 animate-blob"></div>
                <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-[128px] opacity-40 animate-blob animation-delay-2000"></div>
                
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 backdrop-blur-md mb-4 shadow-lg">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
                            <span className="text-xs font-bold tracking-wider text-emerald-100 uppercase">Live AI Intelligence</span>
                        </div>
                        <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-2 drop-shadow-md">
                            Lead Analytics & Qualification
                        </h2>
                        <p className="text-slate-300 font-medium text-lg max-w-2xl">
                            Watch your AI Agent autonomously chat, extract vital data, and accurately qualify your leads in real-time.
                        </p>
                    </div>
                </div>
            </div>

            {/* Premium KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                
                {/* Total Leads */}
                <div className="group relative bg-white p-6 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-1">
                    <div className="absolute -right-10 -top-10 w-32 h-32 bg-brand-50 rounded-full transition-transform duration-500 group-hover:scale-150 opacity-50"></div>
                    <div className="relative z-10 flex flex-col h-full justify-between">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-2xl bg-brand-100 flex items-center justify-center text-brand-600 shadow-inner">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                            </div>
                            <span className="text-slate-500 font-bold text-sm tracking-wide">Total Leads</span>
                        </div>
                        <div>
                            <div className="text-5xl font-black text-slate-800 tracking-tighter">{stats.total}</div>
                            <div className="text-emerald-500 text-sm font-bold mt-2 flex items-center gap-1 bg-emerald-50 w-max px-2 py-1 rounded-lg">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
                                Active tracking
                            </div>
                        </div>
                    </div>
                </div>

                {/* Hot Leads */}
                <div className="group relative bg-gradient-to-b from-white to-red-50/30 p-6 rounded-[2rem] shadow-xl shadow-red-100/50 border border-red-100 overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 hover:border-red-300">
                    <div className="absolute right-0 top-0 w-32 h-32 bg-red-100 rounded-bl-[100px] transition-transform duration-500 group-hover:scale-110 opacity-30"></div>
                    <div className="relative z-10 flex flex-col h-full justify-between">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-2xl drop-shadow-sm">🔥</span>
                            <span className="text-red-600 font-extrabold text-sm tracking-widest uppercase">Hot Leads</span>
                        </div>
                        <div>
                            <div className="text-5xl font-black text-red-600 tracking-tighter drop-shadow-sm">{stats.hot}</div>
                            <div className="text-red-700/80 text-sm font-bold mt-2 flex items-center gap-1 bg-red-100/50 w-max px-2 py-1 rounded-lg">
                                Ready to convert
                            </div>
                        </div>
                    </div>
                </div>

                {/* Warm Leads */}
                <div className="group relative bg-gradient-to-b from-white to-amber-50/30 p-6 rounded-[2rem] shadow-xl shadow-amber-100/50 border border-amber-100 overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 hover:border-amber-300">
                    <div className="absolute right-0 top-0 w-32 h-32 bg-amber-100 rounded-bl-[100px] transition-transform duration-500 group-hover:scale-110 opacity-30"></div>
                    <div className="relative z-10 flex flex-col h-full justify-between">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-2xl drop-shadow-sm">☀️</span>
                            <span className="text-amber-600 font-extrabold text-sm tracking-widest uppercase">Warm Leads</span>
                        </div>
                        <div>
                            <div className="text-5xl font-black text-amber-600 tracking-tighter drop-shadow-sm">{stats.warm}</div>
                            <div className="text-amber-700/80 text-sm font-bold mt-2 flex items-center gap-1 bg-amber-100/50 w-max px-2 py-1 rounded-lg">
                                Needs follow up
                            </div>
                        </div>
                    </div>
                </div>

                {/* Cold Leads */}
                <div className="group relative bg-gradient-to-b from-white to-sky-50/30 p-6 rounded-[2rem] shadow-xl shadow-sky-100/50 border border-sky-100 overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 hover:border-sky-300">
                    <div className="absolute right-0 top-0 w-32 h-32 bg-sky-100 rounded-bl-[100px] transition-transform duration-500 group-hover:scale-110 opacity-30"></div>
                    <div className="relative z-10 flex flex-col h-full justify-between">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-2xl drop-shadow-sm">❄️</span>
                            <span className="text-sky-600 font-extrabold text-sm tracking-widest uppercase">Cold Leads</span>
                        </div>
                        <div>
                            <div className="text-5xl font-black text-sky-600 tracking-tighter drop-shadow-sm">{stats.cold}</div>
                            <div className="text-sky-700/80 text-sm font-bold mt-2 flex items-center gap-1 bg-sky-100/50 w-max px-2 py-1 rounded-lg">
                                Low interest
                            </div>
                        </div>
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
                        <thead>
                            <tr className="bg-slate-900 text-slate-300 text-[11px] uppercase tracking-[0.25em] font-black">
                                <th className="px-8 py-6 rounded-tl-lg">Profile</th>
                                <th className="px-8 py-6">Contact Info</th>
                                <th className="px-8 py-6">Qualification</th>
                                <th className="px-8 py-6 w-2/5 rounded-tr-lg">AI Conversation Summary</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm bg-white">
                            {filteredLeads.map((lead) => (
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
                                            {lead.summary}
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
            </div>
        </div>
    );
};

export default AiAgentAnalytics;
