
import React, { useState, useEffect, useRef } from 'react';
import { getPipelines, getKanbanBoard, getLeads, getTasks } from '../services/lead-management-api';
import { Pipeline, KanbanBoard } from '../types/lead-management';
import { contactGroupService } from '../services/contactGroupService';
import { tagService, Tag } from '../services/tagService';
import { formService } from '../services/formService';
import { supabase } from '../lib/supabase';
import { UsersIcon, KanbanIcon, TagIcon, ClockIcon, CatalogueIcon, ChevronRightIcon } from './icons';

// Temporary icon fallbacks if not in icons.tsx
const DollarIconFallback = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const TrendingUpIconFallback = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
);

const PlusIconFallback = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
    </svg>
);

interface LeadDashboardProps {
    onNavigate: (tab: string) => void;
    totalContactsCount?: number | null;
}

// Custom Scrollbar Styling for a Premium SaaS Look
const scrollbarStyles = `
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #942CAE30;
    border-radius: 20px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #942CAE60;
  }
`;

const LeadDashboard: React.FC<LeadDashboardProps> = ({ onNavigate, totalContactsCount }) => {
    const [userId, setUserId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [pipelines, setPipelines] = useState<Pipeline[]>([]);
    const [activePipelineId, setActivePipelineId] = useState<string | null>(null);
    const [boardData, setBoardData] = useState<KanbanBoard | null>(null);
    
    const getInitialTotalLeads = () => {
        return typeof totalContactsCount === 'number' ? totalContactsCount : 0;
    };

    const [stats, setStats] = useState({
        totalLeads: getInitialTotalLeads(),
        totalValue: 0,
        conversionRate: '0%',
        leadsByStage: [] as { name: string; count: number; color: string; value: number }[],
        recentLeads: [] as any[],
        leadsBySource: [] as { name: string; count: number; value: number }[],
        leadsOverTime: [] as { date: string; count: number; dayName: string }[],
        leadsByTag: [] as { name: string; count: number; color: string }[],
        formsOverTime: [] as { date: string; count: number; dayName: string }[],
        pipelinesOverTime: [] as { date: string; count: number; dayName: string }[],
        tasksOverTime: [] as { date: string; count: number; dayName: string }[],
        groupCount: 0,
        pipelineCount: 0,
        formCount: 0,
        followUpCount: 0
    });

    const [tagDefinitions, setTagDefinitions] = useState<Tag[]>([]);
    const totalContactsCountRef = useRef(totalContactsCount);

    useEffect(() => {
        totalContactsCountRef.current = totalContactsCount;
    }, [totalContactsCount]);

    const loadStats = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token || '';
            const userId = session?.user?.id;

            if (!userId) return;
            setUserId(userId);

            const cached = localStorage.getItem('lead_dashboard_cache_v2');
            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    const isStale = !parsed.timestamp || (Date.now() - parsed.timestamp > 600000);
                    if (parsed.userId === userId && !isStale) {
                        processStatsData(parsed.data);
                        setLoading(false);
                    } else if (isStale && parsed.userId === userId) {
                        processStatsData(parsed.data);
                    } else {
                        localStorage.removeItem('lead_dashboard_cache_v2');
                    }
                } catch (e) {
                    localStorage.removeItem('lead_dashboard_cache_v2');
                }
            }

            const res = await fetch('/api/lead-dashboard/stats?force=true', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (res.ok) {
                const data = await res.json();
                processStatsData(data);
                const cacheWrapper = {
                    data: data,
                    userId,
                    timestamp: Date.now()
                };
                localStorage.setItem('lead_dashboard_cache_v2', JSON.stringify(cacheWrapper));
                setLoading(false);
            }
        } catch (e) {
            console.error('Lead Dashboard Load Failed', e);
            setLoading(false);
        }
    };

    const processStatsData = (data: any, targetPipelineId?: string | null) => {
        if (!data || data.isFallback) return;
        if (data.pipelines) setPipelines(data.pipelines);

        let currentPipeId = targetPipelineId || activePipelineId;
        if (!currentPipeId && data.pipelines?.length > 0) {
            const defaultPipe = data.pipelines.find((p: any) => p.is_default) || data.pipelines[0];
            currentPipeId = defaultPipe.id;
            setActivePipelineId(currentPipeId);
        }

        const pipeStats = data.pipelineStatsMap?.[currentPipeId || ''] || { 
            stages: [], 
            totalLeads: 0, 
            totalValue: 0, 
            leadsBySource: [], 
            leadsOverTime: [] 
        };

        const wonStage = pipeStats.stages.find((s: any) => s.name.toLowerCase().includes('won'));
        const total = pipeStats.totalLeads || 0;
        const conversion = wonStage && total > 0 ? Math.round((wonStage.count / total) * 100) : 0;

        setStats({
            totalLeads: pipeStats.totalLeads || 0,
            totalValue: pipeStats.totalValue || 0,
            conversionRate: `${conversion}%`,
            leadsByStage: pipeStats.stages || [],
            recentLeads: data.recentLeads || [],
            leadsBySource: pipeStats.leadsBySource || [],
            leadsOverTime: pipeStats.leadsOverTime || [],
            leadsByTag: data.leadsByTag || [],
            formsOverTime: data.formsOverTime || [],
            pipelinesOverTime: data.pipelinesOverTime || [],
            tasksOverTime: data.tasksOverTime || [],
            groupCount: data.groupCount || 0,
            pipelineCount: data.pipelineCount || 0,
            formCount: data.formCount || 0,
            followUpCount: data.followUpCount || 0
        });
    };

    useEffect(() => {
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user?.id) {
                setUserId(session.user.id);
            } else {
                loadStats();
            }
        };
        init();
    }, []);

    useEffect(() => {
        if (!userId) return;
        const cached = localStorage.getItem('lead_dashboard_cache_v2');
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (parsed.userId === userId) {
                    processStatsData(parsed.data);
                }
            } catch (err) {
                console.error('Initial cache load failed', err);
            }
        }
        loadStats();
    }, [userId]);

    useEffect(() => {
        const cached = localStorage.getItem('lead_dashboard_cache_v2');
        if (cached && activePipelineId) {
            try {
                const parsed = JSON.parse(cached);
                if (parsed.userId === userId) {
                    processStatsData(parsed.data, activePipelineId);
                }
            } catch (e) {}
        }
    }, [activePipelineId]);

    const hasData = stats.pipelineCount > 0 || stats.totalLeads > 0;

    if (loading && !hasData) {
        return <div className="p-8 text-center text-slate-400 font-medium animate-pulse">Loading Lead Overview...</div>;
    }

    return (
        <>
            <div className="p-4 sm:p-8 space-y-6 md:space-y-8 animate-fade-in text-slate-800 bg-[#eff1f5] min-h-screen relative">
                <style>{`
                    ${scrollbarStyles}
                    @keyframes shimmer {
                        0% { transform: translateX(-100%); }
                        100% { transform: translateX(100%); }
                    }
                    @keyframes pulse-subtle {
                        0%, 100% { transform: scale(1); filter: brightness(1); }
                        50% { transform: scale(1.02); filter: brightness(1.1); }
                    }
                    @keyframes flow-dots {
                        0% { background-position: 0 0; }
                        100% { background-position: 24px 0; }
                    }
                    @keyframes liquid-flow {
                        0% { transform: translateX(-100%); }
                        100% { transform: translateX(200%); }
                    }
                    .animate-shimmer { animation: shimmer 2.5s infinite linear; }
                    .animate-pulse-subtle { animation: pulse-subtle 3s infinite ease-in-out; }
                    .animate-flow-dots { 
                        background-image: radial-gradient(circle, #6366F1 25%, transparent 25%);
                        background-size: 12px 100%;
                        animation: flow-dots 1.2s infinite linear;
                        height: 4px;
                        width: 100%;
                    }
                    .animate-liquid-flow { animation: liquid-flow 1.5s infinite ease-in-out; }
                `}</style>
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-[0.2] pointer-events-none -z-10"></div>
                
                {/* Statistics Overview */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6">
                    {/* Leads Card */}
                    <div onClick={() => onNavigate('contacts')} className="relative overflow-hidden rounded-3xl bg-white border-2 border-[#942CAE] shadow-lg hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 cursor-pointer group min-h-[170px]">
                        <div className="h-2 bg-[#942CAE] w-full"></div>
                        <div className="p-6 relative overflow-hidden">
                            <div className="flex justify-between items-start mb-5 relative z-10">
                                <div className="flex items-center gap-5">
                                    <div className="p-4 rounded-2xl bg-emerald-600 shadow-lg shadow-emerald-200 group-hover:scale-110 transition-transform duration-300">
                                        <UsersIcon className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <div className="text-3xl md:text-4xl font-[900] text-emerald-950 tracking-tighter leading-none mb-1">{stats.totalLeads.toLocaleString()}</div>
                                        <div className="text-[12px] font-black uppercase tracking-[0.1em] text-[#942CAE]">Lead CRM</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 text-[12px] font-black text-emerald-700 bg-emerald-100/80 px-3 py-1.5 rounded-full border border-emerald-200 shadow-sm backdrop-blur-sm">
                                    <TrendingUpIconFallback className="w-3.5 h-3.5" />
                                    <span>+100%</span>
                                </div>
                            </div>
                            <div className="relative z-10 pl-[76px]">
                                <div className="inline-block px-4 py-1.5 rounded-xl bg-emerald-50 border border-emerald-100 text-[11px] font-black uppercase tracking-wider text-emerald-700 shadow-inner">Lifetime Audience</div>
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 h-32 w-full opacity-80 pointer-events-none">
                                <svg viewBox="0 0 100 50" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                                    <defs>
                                        <linearGradient id="emeraldAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                            <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                                            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                                        </linearGradient>
                                    </defs>
                                    <path d="M 0,40 C 20,35 40,45 60,30 C 80,15 100,25 100,25 L 100 50 L 0 50 Z" fill="url(#emeraldAreaGradient)" />
                                    <path d="M 0,40 C 20,35 40,45 60,30 C 80,15 100,25 100,25" fill="none" stroke="#10b981" strokeWidth="0.5" strokeLinecap="round" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Forms Card */}
                    <div onClick={() => onNavigate('forms')} className="relative overflow-hidden rounded-3xl bg-white border-2 border-[#942CAE] ring-2 ring-white ring-inset shadow-lg hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 cursor-pointer group min-h-[170px]">
                        <div className="h-2 bg-[#942CAE] w-full"></div>
                        <div className="p-6 relative overflow-hidden">
                            <div className="flex justify-between items-start mb-5 relative z-10">
                                <div className="flex items-center gap-5">
                                    <div className="p-4 rounded-2xl bg-blue-600 shadow-lg shadow-blue-200 group-hover:scale-110 transition-transform duration-300">
                                        <CatalogueIcon className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <div className="text-3xl md:text-4xl font-[900] text-blue-950 tracking-tighter leading-none mb-1">{stats.formCount}</div>
                                        <div className="text-[12px] font-black uppercase tracking-[0.1em] text-blue-600">Forms</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 text-[12px] font-black text-blue-700 bg-blue-100/80 px-3 py-1.5 rounded-full border border-blue-200 shadow-sm backdrop-blur-sm">
                                    <TrendingUpIconFallback className="w-3.5 h-3.5" />
                                    <span>5%</span>
                                </div>
                            </div>
                            <div className="relative z-10 pl-[76px]">
                                <div className="inline-block px-4 py-1.5 rounded-xl bg-blue-50 border border-blue-100 text-[11px] font-black uppercase tracking-wider text-blue-700 shadow-inner">Flow Automation Flow</div>
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 h-32 w-full opacity-90 pointer-events-none">
                                <svg viewBox="0 0 100 50" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                                    <defs>
                                        <linearGradient id="blueAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.5" />
                                            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                                        </linearGradient>
                                    </defs>
                                    <path d="M 0,45 C 20,42 40,48 60,35 C 80,22 100,30 100,30 L 100 50 L 0 50 Z" fill="url(#blueAreaGradient)" />
                                    <path d="M 0,45 C 20,42 40,48 60,35 C 80,22 100,30 100,30" fill="none" stroke="#3b82f6" strokeWidth="0.5" strokeLinecap="round" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Pipelines Card */}
                    <div onClick={() => onNavigate('pipelines')} className="relative overflow-hidden rounded-3xl bg-white border-2 border-[#942CAE] ring-2 ring-white ring-inset shadow-lg hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 cursor-pointer group min-h-[170px]">
                        <div className="h-2 bg-[#942CAE] w-full"></div>
                        <div className="p-6 relative overflow-hidden">
                            <div className="flex justify-between items-start mb-5 relative z-10">
                                <div className="flex items-center gap-5">
                                    <div className="p-4 rounded-2xl bg-orange-600 shadow-lg shadow-orange-200 group-hover:scale-110 transition-transform duration-300">
                                        <KanbanIcon className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <div className="text-3xl md:text-4xl font-[900] text-orange-950 tracking-tighter leading-none mb-1">{stats.pipelineCount}</div>
                                        <div className="text-[12px] font-black uppercase tracking-[0.1em] text-orange-600">Pipelines</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 text-[12px] font-black text-orange-700 bg-orange-100/80 px-3 py-1.5 rounded-full border border-orange-200 shadow-sm backdrop-blur-sm">
                                    <TrendingUpIconFallback className="w-3.5 h-3.5" />
                                    <span>12%</span>
                                </div>
                            </div>
                            <div className="relative z-10 pl-[76px]">
                                <div className="inline-block px-4 py-1.5 rounded-xl bg-orange-50 border border-orange-100 text-[11px] font-black uppercase tracking-wider text-orange-700 shadow-inner">WhatsApp Marketing Live Webinar</div>
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 h-32 w-full opacity-90 pointer-events-none">
                                <svg viewBox="0 0 100 50" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                                    <defs>
                                        <linearGradient id="coralAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                            <stop offset="0%" stopColor="#ea580c" stopOpacity="0.5" />
                                            <stop offset="100%" stopColor="#ea580c" stopOpacity="0" />
                                        </linearGradient>
                                    </defs>
                                    <path d="M 0,48 C 20,45 40,50 60,38 C 80,26 100,32 100,32 L 100 50 L 0 50 Z" fill="url(#coralAreaGradient)" />
                                    <path d="M 0,48 C 20,45 40,50 60,38 C 80,26 100,32 100,32" fill="none" stroke="#ea580c" strokeWidth="0.5" strokeLinecap="round" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Tasks Card */}
                    <div onClick={() => onNavigate('follow-up')} className="relative overflow-hidden rounded-3xl bg-white border-2 border-[#942CAE] ring-2 ring-white ring-inset shadow-lg hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 cursor-pointer group min-h-[170px]">
                        <div className="h-2 bg-[#942CAE] w-full"></div>
                        <div className="p-6 relative overflow-hidden">
                            <div className="flex justify-between items-start mb-5 relative z-10">
                                <div className="flex items-center gap-5">
                                    <div className={`bg-[#942CAE] w-11 h-11 rounded-xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110`}>
                                        <ClockIcon className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <div className="text-3xl md:text-4xl font-[900] text-slate-900 tracking-tighter leading-none mb-1">{stats.followUpCount}</div>
                                        <div className="text-[12px] font-black uppercase tracking-[0.1em] text-[#942CAE]">Follow Up</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 text-[12px] font-black text-purple-700 bg-purple-100/80 px-3 py-1.5 rounded-full border border-purple-200 shadow-sm backdrop-blur-sm">
                                    <ClockIcon className="w-3.5 h-3.5" />
                                    <span>CLEAR</span>
                                </div>
                            </div>
                            <div className="relative z-10 pl-[76px]">
                                <div className="inline-block px-4 py-1.5 rounded-xl bg-purple-50 border border-purple-100 text-[11px] font-black uppercase tracking-wider text-purple-700 shadow-inner">Pending Tasks</div>
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 h-32 w-full opacity-90 pointer-events-none">
                                <svg viewBox="0 0 100 50" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                                    <defs>
                                        <linearGradient id="purpleAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                            <stop offset="0%" stopColor="#942CAE" stopOpacity="0.5" />
                                            <stop offset="100%" stopColor="#942CAE" stopOpacity="0" />
                                        </linearGradient>
                                    </defs>
                                    <path d="M 0,40 C 20,35 40,45 60,30 C 80,15 100,25 100,25 L 100 50 L 0 50 Z" fill="url(#purpleAreaGradient)" />
                                    <path d="M 0,40 C 20,35 40,45 60,30 C 80,15 100,25 100,25" fill="none" stroke="#942CAE" strokeWidth="0.5" strokeLinecap="round" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 4-COLUMN MAIN GRID - 3:1 PARTITIONING */}
                <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 md:gap-8">
                    {/* LEFT PRIMARY COLUMN (SPAN 3) */}
                    <div className="xl:col-span-3 space-y-6 md:space-y-8 flex flex-col">
                        {/* Main Dashboard Banner - REPOSITIONED */}
                        <div className="relative overflow-hidden rounded-2xl bg-[#59B15D] shadow-xl text-white px-5 py-4 w-full border-2 border-[#59B15D] ring-2 ring-white ring-inset">
                            <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="p-1.5 bg-white rounded-lg shadow-sm">
                                        <svg className="w-5 h-5 text-[#942CAE]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M3 3v18h18" /><path d="M18 9l-5 5-2-2-4 4" />
                                        </svg>
                                    </div>
                                    <h2 className="text-base font-extrabold tracking-tight text-white">Lead Overview</h2>
                                    <div className="hidden sm:block h-4 w-px bg-white/30"></div>
                                    <p className="text-white/90 text-[13px] font-bold hidden sm:block">
                                        <span className="text-white font-black">{pipelines.find(p => p.id === activePipelineId)?.name || 'Pipeline'}</span> Performance
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 w-full md:w-auto">
                                    <div className="relative group flex-1 md:flex-none">
                                        <select
                                            value={activePipelineId || ''}
                                            onChange={(e) => setActivePipelineId(e.target.value)}
                                            className="appearance-none w-full md:w-56 pl-4 pr-10 py-2 bg-white text-[#4a934d] border-2 border-white rounded-xl text-sm font-black focus:outline-none transition-all cursor-pointer shadow-xl"
                                        >
                                            {pipelines.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
                                        </select>
                                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#59B15D]">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 9l-7 7-7-7" /></svg>
                                        </div>
                                    </div>
                                    <button onClick={() => onNavigate('pipelines')} className="px-5 py-2 bg-white text-[#4a934d] border-2 border-white rounded-xl text-sm font-black shadow-xl flex items-center justify-center gap-2">
                                        <span>Go to Board</span>
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Pipeline Performance */}
                        <div className="relative overflow-hidden rounded-[2.5rem] bg-white border-2 border-[#942CAE] ring-2 ring-white ring-inset shadow-2xl flex flex-col min-h-[480px]">
                            <div className="bg-white h-full w-full flex flex-col relative overflow-hidden">
                                <div className="p-6 bg-[#942CAE] flex justify-between items-center relative z-10">
                                    <h3 className="text-lg font-black text-white uppercase tracking-wider">Pipeline Performance</h3>
                                    <div className="text-[10px] font-black text-white/80 uppercase tracking-widest">Real-time stats</div>
                                </div>
                                <div className="p-5 md:p-8 flex-1 flex flex-col relative z-10 overflow-hidden">
                                    {stats.leadsByStage.length > 0 ? (
                                        <div className="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar pb-8 pt-12 flex items-center min-h-[320px]">
                                            <div className="flex items-center min-w-max px-10">
                                                {stats.leadsByStage.map((stage, i) => {
                                                    const userColors = ['#107E7B', '#CF5417', '#7C2F95', '#FC930B', '#FB8F05'];
                                                    const barColor = userColors[i % userColors.length];
                                                    const startHeight = 160 - (i * (100 / stats.leadsByStage.length));
                                                    const prevStage = stats.leadsByStage[i - 1];
                                                    const conversion = prevStage && prevStage.count > 0 ? Math.round((stage.count / prevStage.count) * 100) : 100;
                                                    return (
                                                        <div key={stage.name} className="flex items-center group relative">
                                                            <div className="relative w-36 transition-all duration-500 hover:scale-105 cursor-pointer overflow-visible animate-pulse-subtle" style={{ height: `${startHeight}px`, zIndex: stats.leadsByStage.length - i, filter: 'drop-shadow(0 15px 15px rgba(0,0,0,0.15))' }}>
                                                                <div className="absolute inset-0" style={{ clipPath: `polygon(0% 0%, 85% 0%, 100% 50%, 85% 100%, 0% 100%, 15% 50%)`, background: `linear-gradient(135deg, ${barColor}, ${barColor}cc)`, boxShadow: `inset 0 0 30px rgba(255,255,255,0.3)` }}>
                                                                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.4)_0%,transparent_70%)]"></div>
                                                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-shimmer"></div>
                                                                    <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
                                                                        <span className="text-[10px] font-black uppercase tracking-tighter mb-1 text-[#0f172a] drop-shadow-[0_0_5px_rgba(255,255,255,1)]">Stage {i+1}</span>
                                                                        <span className="text-3xl font-black tabular-nums tracking-tighter text-[#0f172a] drop-shadow-[0_0_10px_rgba(255,255,255,1)]">{stage.count}</span>
                                                                        <span className="text-[9px] font-black uppercase truncate w-full text-center mt-1 text-[#0f172a] drop-shadow-[0_0_5px_rgba(255,255,255,1)]">{stage.name}</span>
                                                                    </div>
                                                                </div>
                                                                <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[100]">
                                                                    <div className="bg-[#111827] text-white px-3 py-1.5 rounded-lg text-[10px] font-black whitespace-nowrap shadow-2xl border border-white/10">{Math.round((stage.count/stats.totalLeads)*100)}% Share</div>
                                                                </div>
                                                            </div>
                                                            {i < stats.leadsByStage.length - 1 && (
                                                                <div className="w-16 flex flex-col items-center justify-center relative overflow-visible mx-1">
                                                                    <div className="h-[4px] w-full relative bg-slate-100 rounded-full overflow-hidden shadow-inner flex items-center">
                                                                        {/* SMOOTH LIQUID FLOW ARROW */}
                                                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#6366F1] to-transparent -translate-x-full animate-liquid-flow"></div>
                                                                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-l-[6px] border-l-[#6366F1] opacity-60"></div>
                                                                    </div>
                                                                    <div className="text-[10px] font-black text-[#942CAE] mt-2 bg-white px-2.5 py-0.5 rounded-full shadow-lg border-2 border-[#942CAE] tabular-nums z-20 transition-transform group-hover:scale-110">{conversion}%</div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
                                            <KanbanIcon className="w-12 h-12 opacity-20" /><p className="text-sm font-medium">No performance data available</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT SIDEBAR COLUMN (SPAN 1) */}
                    <div className="xl:col-span-1 h-full">
                        <div className="relative overflow-hidden rounded-[2rem] bg-white border-2 border-[#FEA21F] ring-2 ring-white ring-inset shadow-2xl flex flex-col h-full min-h-[600px]">
                            <div className="bg-white h-full w-full p-6 md:p-8 flex flex-col gap-6 relative overflow-hidden">
                                <div className="p-5 bg-[#FEA21F] -mx-8 -mt-8 mb-2 relative z-10 flex justify-between items-center">
                                    <div>
                                        <h3 className="text-xl font-black text-white tracking-tight uppercase">Quick Actions</h3>
                                        <p className="text-white/80 text-[10px] font-bold uppercase tracking-widest mt-1">Operational Hub</p>
                                    </div>
                                    <div className="p-2 bg-white/20 rounded-lg backdrop-blur-md">
                                        <PlusIconFallback className="w-6 h-6 text-white" />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-3 relative z-10 border-2 border-[#E9433F] p-5 rounded-[2rem] bg-slate-50/30 shadow-inner overflow-y-auto">
                                    {[
                                        { label: 'View Kanban Board', icon: KanbanIcon, borderColor: '#10b981', action: () => onNavigate('pipelines') },
                                        { label: 'Contacts Directory', icon: UsersIcon, borderColor: '#3b82f6', action: () => onNavigate('contacts') },
                                        { label: 'Create New Lead Form', icon: PlusIconFallback, borderColor: '#942CAE', action: () => onNavigate('forms') },
                                        { label: 'Import Leads', icon: () => <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>, borderColor: '#ea580c', action: () => onNavigate('contacts') },
                                        { label: 'Export Leads', icon: () => <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>, borderColor: '#0891b2', action: () => onNavigate('contacts') },
                                    ].map((item, i) => (
                                        <button 
                                            key={i} 
                                            onClick={item.action} 
                                            className="w-full p-3.5 bg-white rounded-2xl flex items-center justify-between group shadow-sm hover:shadow-xl transition-all border-2 active:scale-[0.98]"
                                            style={{ borderColor: `${item.borderColor}40` }}
                                        >
                                            <div className="flex items-center gap-5">
                                                <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110" style={{ backgroundColor: item.borderColor }}>
                                                    <item.icon className="w-6 h-6 text-white" />
                                                </div>
                                                <span className="font-black text-slate-700 text-sm uppercase tracking-tight">{item.label}</span>
                                            </div>
                                            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-slate-100 transition-colors">
                                                <ChevronRightIcon className="w-5 h-5 text-slate-400 group-hover:text-slate-600" />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                {/* ROW 2: LEAD ACTIVITY & SOURCES */}
                <div className="xl:col-span-3 relative overflow-hidden rounded-[2rem] bg-white border-2 border-[#942CAE] ring-2 ring-white ring-inset shadow-xl flex flex-col">
                    <div className="bg-white h-full w-full p-6 md:p-8 relative overflow-hidden flex flex-col">
                        <div className="flex justify-between items-start mb-8 relative z-10">
                            <div>
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider border-b-4 border-[#942CAE] pb-1 inline-block">Lead Activity</h3>
                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-2">Weekly Distribution</p>
                            </div>
                            <div className="flex items-center gap-2 px-4 py-2 bg-purple-50 rounded-full border border-purple-100 text-[10px] font-black text-[#942CAE] shadow-sm">
                                <TrendingUpIconFallback className="w-3.5 h-3.5" />
                                <span>+0 NEW THIS WEEK</span>
                            </div>
                        </div>
                        <div className="flex-1 relative z-10 overflow-visible py-4">
                            <svg className="w-full h-48 overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                                <defs>
                                    <linearGradient id="activityGradientWide" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#942CAE" stopOpacity="0.15" /><stop offset="100%" stopColor="#942CAE" stopOpacity="0" /></linearGradient>
                                </defs>
                                {(() => {
                                    const max = Math.max(...stats.leadsOverTime.map(d => d.count), 5);
                                    const points = stats.leadsOverTime.map((day, i) => ({ x: (i / (stats.leadsOverTime.length - 1)) * 100, y: 90 - (Math.max(day.count / max, 0.05) * 70) }));
                                    if (points.length < 2) return null;
                                    let d = `M ${points[0].x},${points[0].y}`;
                                    for (let i = 0; i < points.length - 1; i++) {
                                        const cp1x = points[i].x + (points[i+1].x - points[i].x) / 3;
                                        const cp2x = points[i].x + (points[i+1].x - points[i].x) * 2 / 3;
                                        d += ` C ${cp1x},${points[i].y} ${cp2x},${points[i+1].y} ${points[i+1].x},${points[i+1].y}`;
                                    }
                                    return <><path d={d + ` L 100,100 L 0,100 Z`} fill="url(#activityGradientWide)" /><path d={d} fill="none" stroke="#942CAE" strokeWidth="0.8" strokeLinecap="round" /></>;
                                })()}
                            </svg>
                            <div className="flex justify-between mt-6 px-1">
                                {['SAT', 'SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI'].map((day, i) => (
                                    <span key={i} className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                                        {day}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* LEAD SOURCES - COMPACT (SPAN 1) */}
                <div className="xl:col-span-1 relative overflow-hidden rounded-[2rem] bg-white border-2 border-[#942CAE] ring-2 ring-white ring-inset shadow-xl flex flex-col">
                    <div className="bg-white h-full w-full p-6 md:p-8 flex flex-col relative overflow-hidden">
                        <h3 className="text-sm font-black text-slate-900 mb-8 border-b-4 border-[#942CAE] pb-1 inline-block w-fit relative z-10 uppercase tracking-wider">Lead Sources</h3>
                        <div className="flex flex-col items-center justify-center gap-10 flex-1 relative z-10">
                            <div className="relative w-40 h-40 flex-shrink-0">
                                <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                                    <circle cx="50" cy="50" r="40" fill="transparent" stroke="#f1f5f9" strokeWidth="12" />
                                    {stats.leadsBySource.length > 0 ? (() => {
                                        let cumulativePercent = 0;
                                        const total = stats.leadsBySource.reduce((acc, curr) => acc + curr.count, 0);
                                        return stats.leadsBySource.map((source, idx) => {
                                            const percent = (source.count / total) * 100;
                                            const circumference = 2 * Math.PI * 40;
                                            const offset = (cumulativePercent * circumference) / 100;
                                            const colors = ['#3b82f6', '#6366f1', '#10b981', '#f59e0b', '#f43f5e'];
                                            cumulativePercent += percent;
                                            return <circle key={source.name} cx="50" cy="50" r="40" fill="transparent" stroke={colors[idx % colors.length]} strokeWidth="12" strokeDasharray={`${(percent * circumference) / 100} ${circumference}`} strokeDashoffset={-offset} strokeLinecap="round" />;
                                        });
                                    })() : null}
                                </svg>
                                {stats.leadsBySource.length === 0 && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest text-center px-4">No Data Available</span>
                                    </div>
                                )}
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-2xl font-black text-slate-900">{stats.leadsBySource.reduce((a, b) => a + b.count, 0)}</span>
                                    <span className="text-[8px] font-black text-slate-400 uppercase">Total</span>
                                </div>
                            </div>
                            <div className="w-full space-y-3">
                                {stats.leadsBySource.slice(0, 4).map((source, idx) => {
                                    const colors = ['bg-blue-500', 'bg-indigo-500', 'bg-emerald-500', 'bg-amber-500'];
                                    return (
                                        <div key={source.name} className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className={`w-2 h-2 rounded-full ${colors[idx % colors.length]}`}></span>
                                                <span className="text-[10px] font-black text-slate-600 uppercase truncate max-w-[80px]">{source.name.replace('_', ' ')}</span>
                                            </div>
                                            <span className="text-[10px] font-black text-slate-900">{Math.round((source.count / (stats.totalLeads || 1)) * 100)}%</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* QUICK ACTIONS - FULL WIDTH */}
                <div className="xl:col-span-4">
                    <div className="relative overflow-hidden rounded-[2rem] bg-white border-2 border-[#FEA21F] ring-2 ring-white ring-inset shadow-2xl flex flex-col h-fit">
                        <div className="bg-white h-full w-full p-6 md:p-8 flex flex-col gap-6 relative overflow-hidden">
                            <div className="p-5 bg-[#FEA21F] -mx-8 -mt-8 mb-2 relative z-10 flex justify-between items-center">
                                <div>
                                    <h3 className="text-xl font-black text-white tracking-tight uppercase">Quick Actions</h3>
                                    <p className="text-white/80 text-[10px] font-bold uppercase tracking-widest mt-1">Operational Hub</p>
                                </div>
                                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-md">
                                    <PlusIconFallback className="w-6 h-6 text-white" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 relative z-10">
                                {[
                                    { label: 'View Kanban Board', icon: KanbanIcon, borderColor: '#10b981', action: () => onNavigate('pipelines') },
                                    { label: 'Contacts Directory', icon: UsersIcon, borderColor: '#3b82f6', action: () => onNavigate('contacts') },
                                    { label: 'Create New Lead Form', icon: PlusIconFallback, borderColor: '#942CAE', action: () => onNavigate('forms') },
                                    { label: 'Import Leads', icon: () => <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>, borderColor: '#ea580c', action: () => onNavigate('contacts') },
                                    { label: 'Export Leads', icon: () => <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>, borderColor: '#0891b2', action: () => onNavigate('contacts') },
                                ].map((item, i) => (
                                    <button key={i} onClick={item.action} className="p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl flex flex-col items-center justify-center gap-3 group transition-all hover:bg-white hover:border-[#FEA21F] hover:shadow-xl active:scale-95">
                                        <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110" style={{ backgroundColor: item.borderColor }}>
                                            <item.icon className="w-6 h-6 text-white" />
                                        </div>
                                        <span className="font-black text-slate-700 text-[11px] uppercase tracking-tighter text-center">{item.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
                </div>

                {/* BOTTOM GRID - Recent Leads & Top Tags */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 md:gap-8">
                    {/* Recent Leads */}
                    <div className="bg-white rounded-[2rem] border-2 border-[#942CAE] ring-2 ring-white ring-inset shadow-2xl overflow-hidden flex flex-col h-[580px]">
                        <div className="flex flex-col h-full">
                            <div className="p-5 md:p-6 flex justify-between items-center bg-[#942CAE] relative z-10">
                                <h3 className="text-lg font-black text-white uppercase">Recent Leads</h3>
                                <button onClick={() => onNavigate('contacts')} className="text-[10px] font-black uppercase text-[#942CAE] bg-white px-5 py-2.5 rounded-xl">View All</button>
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar relative z-10">
                                {stats.recentLeads.length > 0 ? stats.recentLeads.map((lead, idx) => (
                                    <div key={lead.id} className="p-5 hover:bg-slate-50 transition-all flex items-center justify-between group border-b border-slate-200">
                                        <div className="flex items-center gap-5">
                                            <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl text-white bg-[#942CAE]">{lead.name ? lead.name[0].toUpperCase() : '?'}</div>
                                            <div>
                                                <p className="font-black text-slate-900">{lead.name || 'Unnamed Lead'}</p>
                                                <p className="text-xs font-bold text-slate-400 uppercase">{lead.phone || lead.email || 'No contact'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-8">
                                            <span className="text-[10px] font-black text-[#942CAE] bg-[#942CAE]/10 px-4 py-1.5 rounded-full">{lead.status}</span>
                                            <ChevronRightIcon className="w-5 h-5 text-slate-300" />
                                        </div>
                                    </div>
                                )) : <div className="p-16 text-center text-slate-400">No recent leads found.</div>}
                            </div>
                        </div>
                    </div>

                    {/* Top Tags */}
                    <div className="relative overflow-hidden rounded-[2rem] bg-white border-2 border-[#942CAE] ring-2 ring-white ring-inset shadow-xl flex flex-col h-[580px]">
                        <div className="bg-white h-full w-full flex flex-col relative overflow-hidden">
                            <div className="p-6 bg-[#942CAE] relative z-10">
                                <h3 className="text-lg font-black text-white uppercase">Top Tags</h3>
                                <p className="text-[10px] text-white/70 font-black uppercase tracking-[0.2em] mt-1">Frequency Distribution</p>
                            </div>
                            <div className="p-5 md:p-8 flex-1 flex flex-col gap-8 overflow-y-auto custom-scrollbar relative z-10">
                                {stats.leadsByTag.length > 0 ? stats.leadsByTag.map((tag, idx) => {
                                    const colors = ['#942CAE', '#3b82f6', '#10b981', '#f59e0b', '#f43f5e'];
                                    return (
                                        <div key={tag.name} className="flex flex-col gap-2">
                                            <div className="flex justify-between items-end">
                                                <div className="flex items-center gap-2"><TagIcon className="w-4 h-4 text-slate-400" /><span className="text-xs font-black text-slate-700 uppercase">{tag.name}</span></div>
                                                <span className="text-xs font-black text-slate-900">{tag.count}</span>
                                            </div>
                                            <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden p-[2px] border border-slate-200/50">
                                                <div className="h-full rounded-full" style={{ width: `${(tag.count / Math.max(...stats.leadsByTag.map(t => t.count))) * 100}%`, backgroundColor: colors[idx % colors.length] }}></div>
                                            </div>
                                        </div>
                                    );
                                }) : <div className="text-center text-slate-400">No active tags found</div>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default LeadDashboard;
