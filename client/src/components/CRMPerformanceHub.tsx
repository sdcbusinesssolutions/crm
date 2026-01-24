import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { MenuItem } from './Sidebar';
import { getLeads } from '../services/lead-management-api';
import EngagementCard from './EngagementCard';
import { QRCodeCanvas } from 'qrcode.react';

// --- Types ---
export interface DashboardStats {
    summary: {
        totalContacts: number;
        activeLeads: number;
        newLeadsToday: number;
        pipelineValue: number;
        totalTemplates: number;
        totalCampaigns: number;
        totalFlows: number;
        totalPipelines: number;
        totalGroups: number;
    };
    recentLeads: any[];
    chartData: { date: string; sent: number; delivered: number; read: number }[];
    leadsChartData: { date: string; fullDate: string; count: number }[];
    campaignStats: { name: string; sent: number; delivered: number; read: number }[];
    templateStats: { approved: number; pending: number; rejected: number };
    pipelineStats: { id: string; name: string; totalLeads: number; stages: { name: string; count: number }[] }[];
    taskStats: {
        today: number;
        total: number;
        completed: number;
        due: number;
        breakdown?: Record<string, { id: string; name: string; today: number; overdue: number; total: number }>;
    };
    integrationStats: {
        total: number;
        breakdown: Record<string, number>;
    };
    connection: {
        phone: string | null;
        id: string | null;
        quality_rating?: string;
        messaging_limit?: string;
        status?: string;
        name_status?: string;
        display_phone_number?: string | null;
    };
}

interface DashboardProps {
    onNavigateToFlow?: (flowId: string) => void;
    onNavigate?: (item: MenuItem) => void;
    onNavigateToPipeline?: (pipelineId: string) => void;
    onToggleSidebar?: () => void;
}

// --- Icons ---
const Icons = {
    Chart: ({ className }: { className?: string }) => <svg className={className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>,
    Users: ({ className }: { className?: string }) => <svg className={className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
    Template: ({ className }: { className?: string }) => <svg className={className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg>,
    Flow: ({ className }: { className?: string }) => <svg className={className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
    Campaign: ({ className }: { className?: string }) => <svg className={className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>,
    Bot: ({ className }: { className?: string }) => <svg className={className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
    Plus: ({ className }: { className?: string }) => <svg className={className || "w-4 h-4"} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>,
    ArrowRight: ({ className }: { className?: string }) => <svg className={className || "w-4 h-4"} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>,
    Check: ({ className }: { className?: string }) => <svg className={className || "w-4 h-4"} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>,
    Filter: ({ className }: { className?: string }) => <svg className={className || "w-4 h-4"} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>,
    Download: ({ className }: { className?: string }) => <svg className={className || "w-4 h-4"} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
    WhatsApp: ({ className }: { className?: string }) => <svg className={className || "w-6 h-6"} viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>,
    Link: ({ className }: { className?: string }) => <svg className={className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>,
    Menu: ({ className }: { className?: string }) => <svg className={className || "w-6 h-6"} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>,
    Activity: ({ className }: { className?: string }) => <svg className={className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
};

// --- Custom Complex Chart Components ---
// (These are reused from existing Dashboard code) //

const CRMPerformanceHub: React.FC<{ stats: DashboardStats | null; onNavigate: (item: MenuItem) => void }> = ({ stats, onNavigate }) => {
    // Lead CRM Data
    const totalLeads = stats?.summary.totalContacts || 0;
    const newLeads = stats?.summary.newLeadsToday || 0;
    const leadPercentage = totalLeads > 0 ? Math.min((newLeads / totalLeads) * 100 * 10, 100) : 0;

    return (
        <div className="w-full bg-white/60 backdrop-blur-3xl border border-white/60 rounded-[40px] p-8 shadow-xl shadow-slate-200/50 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/40 to-transparent opacity-50 pointer-events-none" />

            <div className="flex flex-col xl:flex-row gap-8 relative z-10 w-full">

                {/* 1. HERO: Lead CRM Section (Left/Top) - CONTROL CENTER PRO */}
                {/* 1. HERO: Lead CRM Section (Left/Top) - ROYAL BLUE PRO */}
                {/* 1. HERO: Lead CRM Section (Left/Top) - ROYAL BLUE PRO */}
                <div
                    onClick={() => onNavigate('Contacts')}
                    className="flex-1 min-h-[360px] bg-blue-500 rounded-[32px] p-6 text-white relative overflow-hidden shadow-xl shadow-blue-500/30 cursor-pointer group hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between border border-[#033025] hover:border-blue-400"
                >
                    {/* Background Decor - clean modern blobs */}
                    <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/20 rounded-full blur-3xl pointer-events-none"></div>
                    <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-800/20 rounded-full blur-3xl pointer-events-none"></div>

                    {/* Header */}
                    <div className="flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
                                <Icons.Users className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-base font-bold tracking-tight text-white uppercase leading-tight">Lead CRM</h2>
                            </div>
                        </div>

                    </div>

                    {/* Main Stats Charts (Top Grid) */}
                    <div className="grid grid-cols-2 gap-4 relative z-10 mt-6 mb-4">

                        {/* 1. Active Leads Donut Card */}
                        {/* 1. Active Leads Donut Card */}
                        <div className="bg-black/10 rounded-2xl p-4 flex flex-col items-center justify-center border border-[#033025] hover:bg-black/20 transition-colors cursor-pointer" onClick={() => onNavigate('Contacts')}>
                            <div className="relative w-24 h-24 sm:w-28 sm:h-28 group/donut">
                                <svg viewBox="0 0 36 36" className="w-full h-full rotate-[-90deg]">
                                    {/* Stats Calculation */}
                                    {(() => {
                                        const total = totalLeads || 1;
                                        const active = stats?.summary.activeLeads || 0;
                                        const activePct = (active / total) * 100;

                                        return (
                                            <>
                                                <defs>
                                                    <linearGradient id="leadDonutGrad" x1="0" y1="0" x2="1" y2="1">
                                                        <stop offset="0%" stopColor="#ef4444" />
                                                        <stop offset="100%" stopColor="#eab308" />
                                                    </linearGradient>
                                                </defs>

                                                {/* Background Circle */}
                                                <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="3" />

                                                {/* Active Leads Slice */}
                                                <circle cx="18" cy="18" r="15.9" fill="none" stroke="url(#leadDonutGrad)" strokeWidth="3" strokeLinecap="round"
                                                    strokeDasharray={`${activePct}, 100`} className="drop-shadow-[0_0_5px_rgba(239,68,68,0.6)]" />

                                                {/* New Leads Pulse */}
                                                {newLeads > 0 && (
                                                    <circle cx="18" cy="2.1" r="1.5" fill="#ffffff" className="animate-pulse" stroke="rgba(0,0,0,0.5)" strokeWidth="0.5">
                                                        <title>{newLeads} New Today</title>
                                                    </circle>
                                                )}
                                            </>
                                        );
                                    })()}
                                </svg>

                                {/* Center Content */}
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                    <span className="text-2xl sm:text-3xl font-black text-white leading-none drop-shadow-md">{totalLeads}</span>
                                    <span className="text-[9px] sm:text-[10px] uppercase font-bold text-white tracking-wider mt-0.5">Total</span>
                                </div>
                            </div>
                        </div>

                        {/* 2. Followup Status Card */}
                        {/* 2. Followup Status Card */}
                        <div className="bg-black/10 rounded-2xl p-4 flex flex-col justify-between border border-[#033025] hover:bg-black/20 transition-colors">
                            <div className="flex justify-between items-start mb-1">
                                <h4 className="text-[10px] font-bold text-white uppercase tracking-wider">Followup Status</h4>
                            </div>

                            <div className="flex flex-col gap-2 w-full mt-2">
                                {(() => {
                                    const taskData = [
                                        { label: 'Today', val: stats?.taskStats?.today || 0, color: 'bg-amber-400', max: 10 },
                                        { label: 'Next', val: Math.max((stats?.taskStats?.total || 0) - (stats?.taskStats?.completed || 0) - (stats?.taskStats?.due || 0), 0), color: 'bg-blue-400', max: 20 },
                                        { label: 'Late', val: stats?.taskStats?.due || 0, color: 'bg-rose-500', max: 10 },
                                        { label: 'Done', val: stats?.taskStats?.completed || 0, color: 'bg-emerald-400', max: 20 }
                                    ];

                                    // Find local max for scale, ensure at least 1 to avoid div/0
                                    const localMax = Math.max(...taskData.map(d => d.val), 5);

                                    return taskData.map((item, i) => (
                                        <div key={i} className="flex items-center gap-2 w-full">
                                            <div className="w-8 text-[9px] font-bold text-white uppercase tracking-wider text-right">{item.label}</div>

                                            <div className="flex-1 h-1.5 bg-black/20 rounded-full overflow-hidden relative">
                                                <div
                                                    className={`h-full rounded-full ${item.color} shadow-[0_0_8px_currentColor]`}
                                                    style={{ width: `${(item.val / localMax) * 100}%`, minWidth: '4px' }}
                                                />
                                            </div>

                                            <div className="w-5 text-[9px] font-bold text-white text-left">{item.val}</div>
                                        </div>
                                    ));
                                })()}
                            </div>
                        </div>
                    </div>

                    {/* Analytics Grid */}
                    <div className="flex-1 grid grid-cols-2 gap-4 relative z-10">

                        {/* 1. Message Impact (Nested Metric) */}
                        {/* 1. Engagement Score (Gauge) */}
                        {/* 1. Engagement Score (Gauge) */}
                        <div className="bg-black/10 rounded-2xl p-4 flex flex-col justify-between border border-[#033025] hover:bg-black/20 transition-colors">
                            <div className="flex justify-between items-start">
                                <h4 className="text-[10px] font-bold text-white uppercase tracking-wider">Engagement Score</h4>
                                <Icons.Activity className="w-3 h-3 text-white opacity-60" />
                            </div>

                            <div className="flex-1 relative w-full h-full min-h-[60px] flex items-end justify-center pb-2">
                                <svg viewBox="0 0 100 60" className="w-full h-full overflow-visible">
                                    <defs>
                                        <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="0">
                                            <stop offset="0%" stopColor="#ef4444" />
                                            <stop offset="50%" stopColor="#eab308" />
                                            <stop offset="100%" stopColor="#22d3ee" />
                                        </linearGradient>
                                    </defs>

                                    {/* Gauge Background */}
                                    <path d="M10,50 A40,40 0 1,1 90,50" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" strokeLinecap="round" />

                                    {/* Value Arc */}
                                    {(() => {
                                        const total = stats?.summary?.totalContacts || 1;
                                        const active = stats?.summary?.activeLeads || 0;
                                        const score = Math.min((active / total) * 100, 100) || 0;

                                        // Arc Length for 100% (180 deg) at r=40 is PI*40 approx 125.6
                                        // But this is just dasharray trick
                                        const r = 40;
                                        const circ = Math.PI * r; // Half circle length
                                        const dash = (score / 100) * circ;

                                        return (
                                            <>
                                                <path d="M10,50 A40,40 0 1,1 90,50" fill="none" stroke="url(#gaugeGrad)" strokeWidth="8" strokeLinecap="round"
                                                    strokeDasharray={`${dash}, ${circ}`} className="drop-shadow-[0_0_4px_rgba(34,211,238,0.4)] transition-all duration-1000" />

                                                {/* Text Score */}
                                                <text x="50" y="45" textAnchor="middle" className="fill-white text-lg font-bold">{Math.round(score)}</text>
                                                <text x="50" y="58" textAnchor="middle" className="fill-white text-[8px] font-medium uppercase tracking-widest">Active %</text>
                                            </>
                                        );
                                    })()}
                                </svg>
                            </div>
                        </div>

                        {/* 2. Lead Pipeline Funnel (Reference Implementation) */}
                        {/* 2. Lead Pipeline Funnel (Reference Implementation) */}
                        <div className="bg-black/10 rounded-2xl p-4 flex flex-col justify-between border border-[#033025] hover:bg-black/20 transition-colors">
                            <div className="flex justify-between items-start mb-2">
                                <h4 className="text-[10px] font-bold text-white uppercase tracking-wider whitespace-nowrap">Pipeline Funnel</h4>
                            </div>

                            <div className="flex-1 relative w-full h-full min-h-[60px] flex flex-col justify-center items-center">
                                <svg viewBox="0 0 100 80" className="w-full h-full drop-shadow-lg overflow-visible">
                                    <defs>
                                        <linearGradient id="funnelGrad1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#b91c1c" /><stop offset="100%" stopColor="#7f1d1d" /></linearGradient>
                                        <linearGradient id="funnelGrad2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fbbf24" /><stop offset="100%" stopColor="#d97706" /></linearGradient>
                                        <linearGradient id="funnelGrad3" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22c55e" /><stop offset="100%" stopColor="#15803d" /></linearGradient>
                                    </defs>

                                    {/* Stage 1: Lead (Top) - Dark Red */}
                                    <g className="group/stage1 cursor-pointer">
                                        <path d="M5,0 L95,0 L80,24 L20,24 Z" fill="url(#funnelGrad1)" className="opacity-90 group-hover/stage1:opacity-100 transition-opacity" />
                                        <text x="50" y="10" textAnchor="middle" className="fill-white text-[8px] font-bold pointer-events-none">{stats?.summary?.totalContacts || 0}</text>
                                        <text x="50" y="19" textAnchor="middle" className="fill-white/80 text-[6px] font-medium pointer-events-none">100%</text>
                                        <title>Total Contacts: {stats?.summary.totalContacts}</title>
                                    </g>

                                    {/* Stage 2: Active (Middle) - Yellow */}
                                    <g className="group/stage2 cursor-pointer">
                                        <path d="M22,26 L78,26 L65,50 L35,50 Z" fill="url(#funnelGrad2)" className="opacity-90 group-hover/stage2:opacity-100 transition-opacity" />
                                        <text x="50" y="36" textAnchor="middle" className="fill-white text-[8px] font-bold pointer-events-none">{stats?.summary?.activeLeads || 0}</text>
                                        <text x="50" y="45" textAnchor="middle" className="fill-white/80 text-[6px] font-medium pointer-events-none">
                                            {Math.round(((stats?.summary?.activeLeads || 0) / (stats?.summary?.totalContacts || 1)) * 100)}%
                                        </text>
                                        <title>Active Leads: {stats?.summary.activeLeads}</title>
                                    </g>

                                    {/* Stage 3: Won (Bottom) - Green */}
                                    <g className="group/stage3 cursor-pointer">
                                        <path d="M37,52 L63,52 L55,75 L45,75 Z" fill="url(#funnelGrad3)" className="opacity-90 group-hover/stage3:opacity-100 transition-opacity" />
                                        <text x="50" y="62" textAnchor="middle" className="fill-white text-[8px] font-bold pointer-events-none">{stats?.taskStats?.completed || 0}</text>
                                        <text x="50" y="70" textAnchor="middle" className="fill-white/80 text-[6px] font-medium pointer-events-none">
                                            {Math.round(((stats?.taskStats?.completed || 0) / (stats?.summary?.totalContacts || 1)) * 100)}%
                                        </text>
                                        <title>Actioned Tasks: {stats?.taskStats?.completed}</title>
                                    </g>
                                </svg>

                                {/* Side Labels */}
                                <div className="absolute top-1 right-0 translate-x-1 text-[9px] text-white font-medium">Lead</div>
                                <div className="absolute top-1/2 -translate-y-1/2 right-0 translate-x-1 text-[9px] text-white font-medium">Active</div>
                                <div className="absolute bottom-1 right-0 translate-x-1 text-[9px] text-white font-medium">Won</div>
                            </div>
                        </div>

                    </div>
                </div>

                {/* 2. GRID: 4 Key Metrics (Right/Bottom) */}
                <div className="flex-[1.5] grid grid-cols-1 sm:grid-cols-2 gap-5">

                    {/* Card 1: Followup */}
                    <div onClick={() => onNavigate('Contacts')} className="bg-[#10b981] text-white rounded-3xl p-6 relative overflow-hidden group/card cursor-pointer hover:shadow-lg hover:shadow-emerald-500/20 transition-all hover:-translate-y-1 border border-emerald-400/20">
                        <div className="absolute -right-4 -top-4 p-4 opacity-20 transform rotate-12 group-hover/card:rotate-0 transition-transform duration-500">
                            <Icons.Check className="w-32 h-32" />
                        </div>
                        <div className="relative z-10 flex flex-col h-full justify-between gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-lg border border-white/10">
                                <Icons.Users className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-4xl font-black mb-1">{stats?.taskStats?.today || 0}</h3>
                                <div className="text-white font-bold text-xs uppercase tracking-wider mb-2">Today Followup</div>
                                <span className="inline-flex items-center px-3 py-1.5 bg-black/20 rounded-lg text-[11px] font-bold text-white border border-white/10">
                                    {stats?.taskStats?.due || 0} Pending Tasks
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Card 2: Pipeline */}
                    <div onClick={() => onNavigate('Pipelines')} className="bg-[#f59e0b] text-white rounded-3xl p-6 relative overflow-hidden group/card cursor-pointer hover:shadow-lg hover:shadow-orange-500/20 transition-all hover:-translate-y-1 border border-orange-400/20">
                        <div className="absolute -right-4 -top-4 p-4 opacity-20 transform rotate-12 group-hover/card:rotate-0 transition-transform duration-500">
                            <Icons.Chart className="w-32 h-32" />
                        </div>
                        <div className="relative z-10 flex flex-col h-full justify-between gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-lg border border-white/10">
                                <Icons.Chart className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-3xl font-black mb-1 truncate tracking-tight">{Number(stats?.summary.pipelineValue || 0).toLocaleString()}</h3>
                                <div className="text-white font-bold text-xs uppercase tracking-wider mb-2">Pipeline Value</div>
                                <span className="inline-flex items-center px-3 py-1.5 bg-black/20 rounded-lg text-[11px] font-bold text-white border border-white/10">
                                    {stats?.summary.totalPipelines || 0} Pipelines
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Card 3: Campaigns */}
                    <div onClick={() => onNavigate('Campaigns')} className="bg-[#e16800] text-white border border-orange-600/20 rounded-3xl p-6 relative overflow-hidden group/card cursor-pointer hover:shadow-xl hover:shadow-orange-500/20 transition-all hover:-translate-y-1">
                        <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-bl-[100px] -mr-8 -mt-8 z-0 transition-all group-hover/card:scale-110 duration-500"></div>
                        <div className="relative z-10 flex flex-col h-full justify-between">
                            <div className="flex items-center justify-between mb-4">
                                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md text-white flex items-center justify-center shadow-lg border border-white/10">
                                    <Icons.Campaign className="w-6 h-6" />
                                </div>
                                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center group-hover/card:bg-white group-hover/card:text-[#e16800] transition-colors">
                                    <Icons.ArrowRight className="w-4 h-4" />
                                </div>
                            </div>
                            <div>
                                <h3 className="text-4xl font-black text-white mb-1">{stats?.summary.totalCampaigns || 0}</h3>
                                <p className="font-bold text-xs text-white uppercase tracking-wide">Active Campaigns</p>
                            </div>
                        </div>
                    </div>

                    {/* Card 4: Flows */}
                    <div onClick={() => onNavigate('Flows')} className="bg-[#ff5001] text-white border border-orange-600/20 rounded-3xl p-6 relative overflow-hidden group/card cursor-pointer hover:shadow-xl hover:shadow-orange-500/20 transition-all hover:-translate-y-1">
                        <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-bl-[100px] -mr-8 -mt-8 z-0 transition-all group-hover/card:scale-110 duration-500"></div>
                        <div className="relative z-10 flex flex-col h-full justify-between">
                            <div className="flex items-center justify-between mb-4">
                                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md text-white flex items-center justify-center shadow-lg border border-white/10">
                                    <Icons.Flow className="w-6 h-6" />
                                </div>
                                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center group-hover/card:bg-white group-hover/card:text-[#ff5001] transition-colors">
                                    <Icons.ArrowRight className="w-4 h-4" />
                                </div>
                            </div>
                            <div>
                                <h3 className="text-4xl font-black text-white mb-1">{stats?.summary.totalFlows || 0}</h3>
                                <p className="font-bold text-xs text-white uppercase tracking-wide">Automation Flows</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div >
    );
};

export default CRMPerformanceHub;
