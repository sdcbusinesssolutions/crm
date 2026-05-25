import React, { useState, useEffect, useRef } from 'react';
import { getPipelines, getKanbanBoard, getLeads, getTasks } from '../services/lead-management-api';
import { Pipeline, KanbanBoard } from '../types/lead-management';
import { contactGroupService } from '../services/contactGroupService';
import { tagService, Tag } from '../services/tagService';
import { formService } from '../services/formService';
import { supabase } from '../lib/supabase';
import { UsersIcon, KanbanIcon, TagIcon, ClockIcon, CatalogueIcon, ChevronRightIcon, ZapIcon, BookmarkIcon } from './icons';
import { usePermissions, ACCESS_TYPES } from '../modules/teamStaff/hooks/usePermissions';

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

const ActivityIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
);

const TargetIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M12 12m-5 0a5 5 0 1 0 10 0a5 5 0 1 0 -10 0" /><path d="M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
    </svg>
);

const RocketIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" /><path d="M12 15l-3-3m3 3l2 2m-2-2l-1-1" /><path d="M10 8.5L4.5 14M15.5 10L20 4.5" /><path d="M12 15s3.5-1.5 6-6c1.5-2.7 2-5 2-5s-2.3.5-5 2c-4.5 2.5-6 6-6 6z" />
    </svg>
);

const HeartIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
);

const ZapIconFallback = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
);

const StarIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
);

const TrendingUpIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
);

const HashIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
    </svg>
);

const FlagIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
    </svg>
);

const CheckCircleIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
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
    const { hasAccess } = usePermissions();
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
        followUpCount: 0,
        groups: [] as { name: string; count: number }[]
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
        
        // 1. Update Pipelines List (Dropdown)
        if (data.pipelines && Array.isArray(data.pipelines)) {
            setPipelines(data.pipelines);
        } else if (data.pipelineStatsMap) {
            // Fallback: Extract from stats map if top-level list is missing
            const extractedPipelines = Object.entries(data.pipelineStatsMap).map(([id, details]: [string, any]) => ({
                id,
                name: details.name || 'Unnamed Pipeline'
            }));
            setPipelines(extractedPipelines);
        }

        // 2. Select Active Pipeline
        const availablePipelines = data.pipelines || [];
        let currentPipeId = targetPipelineId || activePipelineId;
        
        // If no pipeline is active, or if we just loaded fresh data and haven't manually changed it,
        // we should try to pick the default one.
        if (!targetPipelineId && (!activePipelineId || !availablePipelines.some(p => p.id === activePipelineId))) {
            const staffData = localStorage.getItem('staffData');
            const uid = staffData ? JSON.parse(staffData).id : 'admin';
            const localDefaultId = localStorage.getItem(`default_pipeline_${uid}`);
            
            const defaultPipe = availablePipelines.find((p: any) => p.id === localDefaultId) 
                             || availablePipelines.find((p: any) => p.is_default) 
                             || availablePipelines[0];
            currentPipeId = defaultPipe?.id || null;
        }
        
        // Ensure the ID is valid and exists in current pipelines
        if (currentPipeId && availablePipelines.some(p => p.id === currentPipeId)) {
            setActivePipelineId(currentPipeId);
        } else if (availablePipelines.length > 0 && !currentPipeId) {
            // Fallback to first if everything else fails
            setActivePipelineId(availablePipelines[0].id);
        }

        // 3. Process Stats for selected pipeline
        const pipeStats = data.pipelineStatsMap?.[currentPipeId || ''] || {
            stages: [],
            totalLeads: 0,
            totalValue: 0,
            leadsBySource: [],
            leadsOverTime: []
        };

        const wonStage = pipeStats.stages.find((s: any) => s.name?.toLowerCase().includes('won'));
        const total = pipeStats.totalLeads || 0;
        const conversion = wonStage && total > 0 ? Math.round((wonStage.count / total) * 100) : 0;

        setStats({
            totalLeads: (data.pipelineCount === 0 || pipeStats.totalLeads === 0) ? (totalContactsCountRef.current || 0) : (pipeStats.totalLeads || 0),
            totalValue: pipeStats.totalValue || 0,
            conversionRate: `${conversion}%`,
            leadsByStage: pipeStats.stages || [],
            recentLeads: data.recentLeads || [],
            leadsBySource: data.leadsBySource || pipeStats.leadsBySource || [],
            leadsOverTime: data.leadsOverTime || [],
            leadsByTag: data.leadsByTag || [],
            formsOverTime: data.formsOverTime || [],
            pipelinesOverTime: data.pipelinesOverTime || [],
            tasksOverTime: data.tasksOverTime || [],
            groupCount: data.groupCount || 0,
            pipelineCount: data.pipelineCount || data.pipelines?.length || 0,
            formCount: data.formCount || 0,
            followUpCount: data.followUpCount || 0,
            groups: data.groups || []
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
            } catch (e) { }
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
                    {hasAccess('Contact List', ACCESS_TYPES.READ) && (
                        <div onClick={() => onNavigate('contacts')} className="relative overflow-hidden rounded-3xl bg-white border-2 border-[#A3DC9A] shadow-lg hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 cursor-pointer group min-h-[170px]">

                            <div className="p-6 relative overflow-hidden">
                                <div className="flex justify-between items-start mb-5 relative z-10">
                                    <div className="flex items-center gap-5">
                                        <div className="p-4 rounded-2xl bg-emerald-600 shadow-lg shadow-emerald-200 group-hover:scale-110 transition-transform duration-300">
                                            <UsersIcon className="w-6 h-6 text-white" />
                                        </div>
                                        <div>
                                            <div className="text-3xl md:text-4xl font-[900] text-emerald-950 tracking-tighter leading-none mb-1">{stats.totalLeads.toLocaleString()}</div>
                                            <div className="text-[12px] font-black uppercase tracking-[0.1em] text-emerald-600">Lead CRM</div>
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

                            </div>
                        </div>
                    )}

                    {/* Forms Card */}
                    {hasAccess('Form Builder', ACCESS_TYPES.READ) && (
                        <div onClick={() => onNavigate('forms')} className="relative overflow-hidden rounded-3xl bg-white border-2 border-[#E2A16F] ring-2 ring-white ring-inset shadow-lg hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 cursor-pointer group min-h-[170px]">

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

                            </div>
                        </div>
                    )}

                    {/* Pipelines Card */}
                    {hasAccess('Pipelines', ACCESS_TYPES.READ) && (
                        <div onClick={() => onNavigate('pipelines')} className="relative overflow-hidden rounded-3xl bg-white border-2 border-[#FFB399] ring-2 ring-white ring-inset shadow-lg hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 cursor-pointer group min-h-[170px]">

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
                                        <span>{Math.round((stats.pipelineCount / (stats.totalLeads || 1)) * 100)}%</span>
                                    </div>
                                </div>
                                <div className="relative z-10 pl-[76px]">
                                    <div className="inline-block px-4 py-1.5 rounded-xl bg-orange-50 border border-orange-100 text-[11px] font-black uppercase tracking-wider text-orange-700 shadow-inner">
                                        {stats.leadsBySource[0] ? `Top Source: ${stats.leadsBySource[0].name.replace('_', ' ')}` : 'Lead Channels Active'}
                                    </div>
                                </div>

                            </div>
                        </div>
                    )}

                    {/* Tasks Card */}
                    {hasAccess('Follow-up', ACCESS_TYPES.READ) && (
                        <div onClick={() => onNavigate('follow-up')} className="relative overflow-hidden rounded-3xl bg-white border-2 border-[#696FC7] ring-2 ring-white ring-inset shadow-lg hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 cursor-pointer group min-h-[170px]">

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
                                        <span>{stats.followUpCount > 0 ? 'URGENT' : 'CLEAR'}</span>
                                    </div>
                                </div>
                                <div className="relative z-10 pl-[76px]">
                                    <div className="inline-block px-4 py-1.5 rounded-xl bg-purple-50 border border-purple-100 text-[11px] font-black uppercase tracking-wider text-purple-700 shadow-inner">
                                        {stats.followUpCount} Pending Tasks
                                    </div>
                                </div>

                            </div>
                        </div>
                    )}
                </div>

                {/* 4-COLUMN MAIN GRID - 3:1 PARTITIONING */}
                <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 md:gap-8">


                    {/* ROW 1: LEAD ACTIVITY & SOURCES */}
                    <div className="xl:col-span-3 relative overflow-hidden rounded-[2rem] bg-white border-2 border-[#13BF8F] ring-2 ring-white ring-inset shadow-xl flex flex-col">
                        <div className="bg-white h-full w-full p-4 md:p-6 relative overflow-hidden flex flex-col">
                            <div className="flex justify-between items-start mb-4 relative z-10">
                                <div>
                                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider border-b-4 border-[#942CAE] pb-1 inline-block">Lead Activity</h3>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-2">Weekly Distribution</p>
                                </div>
                                <div className="flex items-center gap-2 px-4 py-2 bg-purple-50 rounded-full border border-purple-100 text-[10px] font-black text-[#942CAE] shadow-sm">
                                    <TrendingUpIconFallback className="w-3.5 h-3.5" />
                                    <span>+{stats.leadsOverTime.reduce((acc, curr) => acc + curr.count, 0)} NEW THIS WEEK</span>
                                </div>
                            </div>
                            <div className="flex-1 flex flex-col relative z-10 overflow-hidden py-1">
                                <div className="flex-1 flex items-center justify-center relative min-h-[180px] px-2 md:px-8">
                                    {/* ZERO-OVERLAP PROFESSIONAL 3D PIPE */}
                                    <svg className="w-full h-52 overflow-visible drop-shadow-[0_30px_50px_rgba(0,0,0,0.25)]" viewBox="0 0 850 180" preserveAspectRatio="none">
                                        <defs>
                                            <filter id="neonGlow"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                                            <linearGradient id="pipeSleeveGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                                                <stop offset="0%" stopColor="white" stopOpacity="0.2" />
                                                <stop offset="50%" stopColor="white" stopOpacity="0.05" />
                                                <stop offset="100%" stopColor="black" stopOpacity="0.1" />
                                            </linearGradient>
                                        </defs>

                                        {/* CONTINUOUS TRANSPARENT GLASS PIPE */}
                                        <rect x="0" y="5" width="850" height="140" rx="70" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
                                        <rect x="0" y="5" width="850" height="140" rx="70" fill="url(#pipeSleeveGrad)" pointerEvents="none" />

                                        {/* RENDER INDEPENDENT 3D CYLINDERS */}
                                        {(stats.leadsOverTime.length > 0 ? stats.leadsOverTime.slice(-7) : ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((d, i) => ({ dayName: d, count: 0, date: i.toString() }))).map((day, i) => {
                                            const segmentWidth = 84; 
                                            const spacing = 35; 
                                            const startPadding = 20;
                                            const x = startPadding + i * (segmentWidth + spacing);

                                            const colors = ['#3b82f6', '#942CAE', '#10b981', '#f59e0b', '#f43f5e', '#6366f1', '#0ea5e9'];
                                            const barColor = colors[i % colors.length];
                                            const opacity = 0.4; // Faded glassy look as per image

                                            return (
                                                <g key={day.date} className="group cursor-pointer">
                                                    {/* INDEPENDENT 3D CYLINDER BODY */}
                                                    <rect x={x} y="15" width={segmentWidth} height="120" fill={barColor} opacity={opacity} className="transition-all duration-500" />

                                                    {/* VOLUMETRIC SHADING */}
                                                    <linearGradient id={`zeroOverlapGrad-${i}`} x1="0%" y1="0%" x2="0%" y2="100%">
                                                        <stop offset="0%" stopColor="black" stopOpacity="0.5" />
                                                        <stop offset="25%" stopColor="white" stopOpacity="0.1" />
                                                        <stop offset="50%" stopColor="white" stopOpacity="0.4" />
                                                        <stop offset="75%" stopColor="white" stopOpacity="0.1" />
                                                        <stop offset="100%" stopColor="black" stopOpacity="0.5" />
                                                    </linearGradient>
                                                    <rect x={x} y="15" width={segmentWidth} height="120" fill={`url(#zeroOverlapGrad-${i})`} opacity={opacity} />

                                                    {/* 3D END CAPS */}
                                                    <ellipse cx={x} cy="75" rx="14" ry="60" fill={barColor} opacity={opacity} stroke="rgba(0,0,0,0.4)" strokeWidth="2.5" />
                                                    <ellipse cx={x + segmentWidth} cy="75" rx="14" ry="60" fill={barColor} opacity={opacity} stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" />

                                                    {/* ATTRACTIVE CIRCLE BORDER DATA DISC */}
                                                    <circle cx={x + segmentWidth / 2} cy="75" r="32" fill="rgba(255,255,255,0.15)" stroke="white" strokeWidth="2" className="group-hover:scale-110 transition-transform duration-500" />
                                                    <circle cx={x + segmentWidth / 2} cy="75" r="26" fill="white" className="group-hover:scale-110 transition-transform duration-500" />

                                                    {/* DYNAMIC LEAD COUNT NUMBER - AUTO SHRINK FOR LARGE NUMBERS */}
                                                    <text 
                                                        x={x + segmentWidth / 2} 
                                                        y="83" 
                                                        textAnchor="middle" 
                                                        fontSize={day.count > 999 ? "12" : day.count > 99 ? "18" : "22"} 
                                                        fontWeight="1000" 
                                                        fill="#0f172a" 
                                                        className="group-hover:scale-110 transition-transform duration-500 tabular-nums"
                                                    >
                                                        {day.count.toLocaleString()}
                                                    </text>

                                                    {/* DAY LABEL - BLACK & COLOR COMBINATION FOR MAXIMUM CONTRAST */}
                                                    <text 
                                                        x={x + segmentWidth / 2} 
                                                        y="165" 
                                                        textAnchor="middle" 
                                                        fill="#0f172a" 
                                                        style={{ filter: `drop-shadow(0px 1px 2px ${barColor})` }}
                                                        className="text-[11px] font-[1000] uppercase tracking-widest"
                                                    >
                                                        {day.dayName.substring(0, 3)}
                                                    </text>
                                                </g>
                                            );
                                        })}
                                        {/* CENTER SHINE LINE */}
                                        <rect x="0" y="40" width="850" height="5" fill="rgba(255,255,255,0.3)" filter="url(#neonGlow)" pointerEvents="none" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="xl:col-span-1 relative overflow-hidden rounded-[2rem] bg-white border-2 border-[#BF3131] ring-2 ring-white ring-inset shadow-xl flex flex-col">
                        <div className="bg-white h-full w-full p-6 md:p-8 flex flex-col relative overflow-hidden">
                            <div className="flex justify-between items-center mb-6 relative z-10">
                                <div>
                                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider border-b-4 border-[#BF3131] pb-1 inline-block">Lead Sources</h3>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-2">Conversion Origin</p>
                                </div>
                                <div className="p-2 bg-rose-50 rounded-xl">
                                    <svg className="w-5 h-5 text-[#BF3131]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                    </svg>
                                </div>
                            </div>

                            <div className="flex flex-col items-center justify-center gap-8 flex-1 relative z-10">
                                {/* MODERN PARTITIONED DONUT */}
                                <div className="relative w-48 h-48 flex-shrink-0 group">
                                    <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90 filter drop-shadow-xl overflow-visible">
                                        {/* BACKGROUND TRACK */}
                                        <circle cx="50" cy="50" r="42" fill="transparent" stroke="#f1f5f9" strokeWidth="12" />

                                        {stats.leadsBySource.length > 0 ? (() => {
                                            let cumulativePercent = 0;
                                            const total = stats.leadsBySource.reduce((acc, curr) => acc + curr.count, 0);
                                            const gap = 2; // DEGREE GAP BETWEEN SEGMENTS
                                            const totalGap = stats.leadsBySource.length > 1 ? gap * stats.leadsBySource.length : 0;
                                            const availablePercent = 100 - totalGap;

                                            return stats.leadsBySource.map((source, idx) => {
                                                const rawPercent = (source.count / total) * 100;
                                                const percent = (rawPercent / 100) * availablePercent;
                                                const circumference = 2 * Math.PI * 42;

                                                // CALCULATE START OFFSET
                                                const offset = ((cumulativePercent + (idx * gap)) * circumference) / 100;
                                                const colors = ['#3b82f6', '#942CAE', '#10b981', '#f59e0b', '#f43f5e'];
                                                const barColor = colors[idx % colors.length];

                                                cumulativePercent += rawPercent;

                                                return (
                                                    <g key={source.name} className="transition-all duration-500">
                                                        <circle
                                                            cx="50" cy="50" r="42"
                                                            fill="transparent"
                                                            stroke={barColor}
                                                            strokeWidth="12"
                                                            strokeDasharray={`${(percent * circumference) / 100} ${circumference}`}
                                                            strokeDashoffset={-offset}
                                                            strokeLinecap="round"
                                                            className="transition-all duration-700 ease-in-out hover:stroke-[14px] cursor-pointer"
                                                        >
                                                            <title>{source.name}: {source.count} leads</title>
                                                        </circle>
                                                        {/* ADD A SMALL INNER SHINE */}
                                                        <circle
                                                            cx="50" cy="50" r="38"
                                                            fill="transparent"
                                                            stroke="white"
                                                            strokeWidth="1"
                                                            strokeOpacity="0.2"
                                                            strokeDasharray={`${(percent * circumference) / 100} ${circumference}`}
                                                            strokeDashoffset={-offset}
                                                            className="pointer-events-none"
                                                        />
                                                    </g>
                                                );
                                            });
                                        })() : (
                                            /* VIBRANT CORAL SKELETON WHEN EMPTY */
                                            <circle 
                                                cx="50" cy="50" r="42" 
                                                fill="transparent" 
                                                stroke="#BF3131" 
                                                strokeWidth="12" 
                                                strokeDasharray="100 100"
                                                className="opacity-30 animate-pulse"
                                            />
                                        )}
                                    </svg>

                                    {/* CENTER STATS HUB */}
                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                        <div className="bg-white/80 backdrop-blur-md rounded-full w-28 h-28 flex flex-col items-center justify-center shadow-[0_0_40px_-10px_rgba(0,0,0,0.1)] border border-white/50">
                                            <span className="text-4xl font-[1000] text-slate-900 leading-none tracking-tighter tabular-nums">
                                                {(() => {
                                                    const sourceTotal = stats.leadsBySource.reduce((a, b) => a + b.count, 0);
                                                    return sourceTotal > 0 ? sourceTotal : stats.totalLeads;
                                                })()}
                                            </span>
                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">
                                                {stats.leadsBySource.reduce((a, b) => a + b.count, 0) > 0 ? 'Captured' : 'Total Leads'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* PARTITIONED LEGEND GRID */}
                                <div className="w-full grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                                    {stats.leadsBySource.length > 0 ? stats.leadsBySource.slice(0, 6).map((source, idx) => {
                                        const colors = [
                                            { bg: 'bg-blue-500', text: 'text-blue-500', border: 'border-blue-100', light: 'bg-blue-50' },
                                            { bg: 'bg-purple-500', text: 'text-purple-500', border: 'border-purple-100', light: 'bg-purple-50' },
                                            { bg: 'bg-emerald-500', text: 'text-emerald-500', border: 'border-emerald-100', light: 'bg-emerald-50' },
                                            { bg: 'bg-amber-500', text: 'text-amber-500', border: 'border-amber-100', light: 'bg-amber-50' },
                                            { bg: 'bg-rose-500', text: 'text-rose-500', border: 'border-rose-100', light: 'bg-rose-50' },
                                            { bg: 'bg-cyan-500', text: 'text-cyan-500', border: 'border-cyan-100', light: 'bg-cyan-50' }
                                        ];
                                        const theme = colors[idx % colors.length];
                                        const percent = Math.round((source.count / (stats.totalLeads || 1)) * 100);

                                        return (
                                            <div
                                                key={source.name}
                                                className="p-3 rounded-2xl bg-white border transition-all duration-300 group/source cursor-pointer shadow-sm hover:shadow-lg"
                                                style={{ borderColor: `${theme.bg.replace('bg-', '') === 'blue-500' ? '#3b82f680' : theme.bg.replace('bg-', '') === 'purple-500' ? '#a855f780' : theme.bg.replace('bg-', '') === 'emerald-500' ? '#10b98180' : theme.bg.replace('bg-', '') === 'amber-500' ? '#f59e0b80' : theme.bg.replace('bg-', '') === 'rose-500' ? '#f43f5e80' : '#06b6d480'}` }}
                                            >
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className={`w-6 h-6 rounded-lg ${theme.bg} flex items-center justify-center text-white font-black text-[9px] shadow-sm`}>
                                                        {source.name[0].toUpperCase()}
                                                    </div>
                                                    <span className="text-[9px] font-black text-slate-600 uppercase truncate flex-1">{source.name.replace('_', ' ')}</span>
                                                </div>
                                                <div className="flex items-end justify-between">
                                                    <span className="text-sm font-black text-slate-900 tabular-nums">{source.count}</span>
                                                    <div className="flex items-center gap-1">
                                                        <div className={`w-1.5 h-1.5 rounded-full ${theme.bg}`}></div>
                                                        <span className={`text-[10px] font-black ${theme.text}`}>{percent}%</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }) : (
                                        <div className="col-span-2 py-4 flex flex-col items-center justify-center opacity-40">
                                            <div className="w-12 h-12 rounded-2xl bg-slate-100 animate-pulse"></div>
                                            <p className="text-[9px] font-black text-slate-400 uppercase mt-2">Loading Sources...</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ROW 2: PERFORMANCE & ACTIONS */}
                    <div className="xl:col-span-3 space-y-6 md:space-y-8 flex flex-col">
                        {/* Main Dashboard Banner - REPOSITIONED */}
                        <div className="relative overflow-hidden rounded-2xl bg-[#6d2323] shadow-xl text-white px-5 py-4 w-full border-2 border-[#6d2323] ring-2 ring-white ring-inset">
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
                                            className="appearance-none w-full md:w-56 pl-4 pr-10 py-2 bg-white text-[#6d2323] border-2 border-white rounded-xl text-sm font-black focus:outline-none transition-all cursor-pointer shadow-xl"
                                        >
                                            {pipelines.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
                                        </select>
                                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#6d2323]">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 9l-7 7-7-7" /></svg>
                                        </div>
                                    </div>
                                    <button onClick={() => onNavigate('pipelines')} className="px-5 py-2 bg-white text-[#6d2323] border-2 border-white rounded-xl text-sm font-black shadow-xl flex items-center justify-center gap-2">
                                        <span>Go to Board</span>
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Pipeline Performance */}
                        <div className="relative overflow-hidden rounded-[2.5rem] bg-white border-2 border-[#756ab6] ring-2 ring-white ring-inset shadow-2xl flex flex-col min-h-[480px]">
                            <div className="bg-white h-full w-full flex flex-col relative overflow-hidden">
                                <div className="p-6 bg-[#756ab6] flex justify-between items-center relative z-10">
                                    <h3 className="text-lg font-black text-white uppercase tracking-wider">Pipeline Performance</h3>
                                    <div className="text-[10px] font-black text-white/80 uppercase tracking-widest">Real-time stats</div>
                                </div>
                                <div className="p-5 md:p-8 flex-1 flex flex-col relative z-10 overflow-hidden">
                                    {stats.leadsByStage.length > 0 ? (
                                        <div className="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar flex items-end justify-start p-8 md:p-10 gap-4 h-full relative z-10">
                                            {[...stats.leadsByStage].sort((a, b) => b.count - a.count).map((stage, idx) => {
                                                const percent = stats.totalLeads > 0 ? Math.round((stage.count / stats.totalLeads) * 100) : 0;
                                                const colorMap = [
                                                    { bg: 'bg-[#10b981]', border: 'border-[#059669]' },
                                                    { bg: 'bg-[#3b82f6]', border: 'border-[#2563eb]' },
                                                    { bg: 'bg-[#8b5cf6]', border: 'border-[#7c3aed]' },
                                                    { bg: 'bg-[#f59e0b]', border: 'border-[#d97706]' },
                                                    { bg: 'bg-[#f43f5e]', border: 'border-[#e11d48]' }
                                                ];
                                                const theme = colorMap[idx % colorMap.length];

                                                return (
                                                    <div key={stage.name} className="flex-shrink-0 flex flex-col items-center group h-full justify-end w-24">
                                                        <div className="mb-3 flex flex-col items-center">
                                                            <div className={`px-2.5 py-1 rounded-full bg-white shadow-lg border-[1.5px] ${theme.border} transition-all duration-500 group-hover:scale-110 z-30`}>
                                                                <span className="text-[10px] font-black text-slate-900 tracking-tight leading-none">{percent}%</span>
                                                            </div>
                                                        </div>
                                                        <div className={`relative w-14 h-[60%] bg-slate-50/10 rounded-full overflow-hidden border-[2.5px] ${theme.border} shadow-[0_15px_30px_-10px_rgba(0,0,0,0.1),inset_0_2px_15px_rgba(255,255,255,0.5)] transition-all flex flex-col justify-end group-hover:scale-105 duration-500`}>
                                                            <div
                                                                className={`w-full ${theme.bg} transition-all duration-1000 ease-out relative overflow-hidden`}
                                                                style={{ height: `${Math.max(percent, 2)}%`, minHeight: '8px' }}
                                                            >
                                                                <div className="absolute inset-0 bg-gradient-to-tr from-white/30 via-transparent to-transparent opacity-60"></div>
                                                                <div className="absolute top-0 left-0 right-0 h-1 bg-white/40 blur-[1px]"></div>
                                                                <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent_0%,rgba(255,255,255,0.4)_50%,transparent_100%)] animate-shimmer" style={{ backgroundSize: '200% 100%' }}></div>
                                                            </div>
                                                            {/* CENTERED LEAD COUNT ONLY - NO OVERLAP */}
                                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                                                                <span className={`text-[12px] font-[1000] ${percent > 45 ? 'text-white' : 'text-slate-900'} transition-colors duration-500 drop-shadow-sm`}>{stage.count}</span>
                                                            </div>
                                                        </div>
                                                        <div className="mt-4 text-center w-full px-1 relative h-16">
                                                            <div className="bg-white border-[1.5px] border-slate-100 p-2.5 rounded-2xl shadow-sm group-hover:border-slate-300 group-hover:shadow-xl transition-all duration-500 relative overflow-hidden flex items-center justify-center h-full min-h-[50px]">
                                                                <div className={`absolute top-0 left-0 right-0 h-1 ${theme.bg}`}></div>
                                                                <p className="text-[9px] font-black text-slate-800 uppercase leading-[1.1] tracking-tighter break-words max-w-[85px] text-center">{stage.name}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        /* ORIGINAL GREY SKELETON FOR PIPELINE */
                                        <div className="flex-1 flex items-end justify-around p-10 gap-4 h-full relative z-10">
                                            {[...Array(5)].map((_, i) => (
                                                <div key={i} className="flex flex-col items-center gap-4 w-14 h-full justify-end opacity-50">
                                                    <div className="w-10 h-10 rounded-full bg-slate-200"></div>
                                                    <div className="w-full h-40 bg-slate-100 rounded-full border-2 border-dashed border-slate-300"></div>
                                                    <div className="w-full h-10 bg-slate-50 rounded-xl"></div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="xl:col-span-1 h-full">
                        <div className="relative overflow-hidden rounded-[2rem] bg-white border-2 border-[#0a6847] ring-2 ring-white ring-inset shadow-2xl flex flex-col h-full min-h-[600px]">
                            <div className="bg-white h-full w-full p-6 md:p-8 flex flex-col gap-6 relative overflow-hidden">
                                <div className="p-5 bg-[#0a6847] -mx-8 -mt-8 mb-2 relative z-10 flex justify-between items-center">
                                    <div>
                                        <h3 className="text-xl font-black text-white tracking-tight uppercase">Quick Actions</h3>
                                        <p className="text-white/80 text-[10px] font-bold uppercase tracking-widest mt-1">Operational Hub</p>
                                    </div>
                                    <div className="p-2 bg-white/20 rounded-lg backdrop-blur-md">
                                        <PlusIconFallback className="w-6 h-6 text-white" />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-3 relative z-10 border-2 border-[#0a6847] p-5 rounded-[2rem] bg-slate-50/30 shadow-inner overflow-y-auto">
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

                    {/* Recent Leads / Contacts */}
                </div>

                {/* ROW 3: EQUAL PARTITION ANALYTICS */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
                    {/* Recent Leads / Contacts */}
                    <div className="bg-white rounded-[2rem] border-2 border-[#e13f7c] ring-2 ring-white ring-inset shadow-2xl overflow-hidden flex flex-col h-[580px]">
                        <div className="flex flex-col h-full">
                            <div className="p-6 flex justify-between items-center bg-[#e13f7c] relative z-10 shadow-lg">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
                                        <h3 className="text-xl font-[900] text-white uppercase tracking-tighter">Recent Leads</h3>
                                    </div>
                                    <p className="text-white/70 text-[10px] font-black uppercase tracking-[0.2em] mt-1">Latest Directory Entry</p>
                                </div>
                                <button
                                    onClick={() => onNavigate('contacts')}
                                    className="px-6 py-2.5 bg-white text-[#e13f7c] hover:bg-slate-50 rounded-xl transition-all shadow-xl font-[1000] text-[11px] uppercase tracking-widest"
                                >
                                    View All
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-3 relative z-10 bg-slate-50/10">
                                {stats.recentLeads.length > 0 ? stats.recentLeads.slice(0, 5).map((lead, idx) => {
                                    // Professional Palette for individual lead colors
                                    const leadColors = [
                                        { bg: 'from-emerald-500 to-emerald-700', text: 'text-emerald-500', shadow: 'shadow-emerald-200' },
                                        { bg: 'from-blue-500 to-blue-700', text: 'text-blue-500', shadow: 'shadow-blue-200' },
                                        { bg: 'from-orange-500 to-orange-700', text: 'text-orange-500', shadow: 'shadow-orange-200' },
                                        { bg: 'from-rose-500 to-rose-700', text: 'text-rose-500', shadow: 'shadow-rose-200' },
                                        { bg: 'from-indigo-500 to-indigo-700', text: 'text-indigo-500', shadow: 'shadow-indigo-200' },
                                        { bg: 'from-cyan-500 to-cyan-700', text: 'text-cyan-500', shadow: 'shadow-cyan-200' }
                                    ];
                                    const theme = leadColors[idx % leadColors.length];

                                    const name = lead.name || (lead.first_name ? `${lead.first_name} ${lead.last_name || ''}`.trim() : null);
                                    const primaryLabel = name || lead.phone || 'Anonymous Lead';
                                    const secondaryLabel = name ? lead.phone : 'Captured Recently';

                                    return (
                                        <div 
                                            key={lead.id || idx} 
                                            className="group flex items-center justify-between p-4 bg-white rounded-3xl border transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/50 cursor-pointer"
                                            style={{ borderColor: `${theme.text.replace('text-', '') === 'emerald-500' ? '#10b98180' : theme.text.replace('text-', '') === 'blue-500' ? '#3b82f680' : theme.text.replace('text-', '') === 'orange-500' ? '#f59e0b80' : theme.text.replace('text-', '') === 'rose-500' ? '#f43f5e80' : theme.text.replace('text-', '') === 'indigo-500' ? '#6366f180' : '#06b6d480'}` }}
                                        >
                                            <div className="flex items-center gap-4">
                                                {/* DYNAMIC COLORED CIRCLE AVATAR */}
                                                <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${theme.bg} flex items-center justify-center text-white font-black text-lg shadow-lg group-hover:scale-110 transition-transform`}>
                                                    {primaryLabel[0].toUpperCase()}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-[800] text-slate-900 group-hover:text-slate-950 transition-colors">
                                                        {primaryLabel}
                                                    </span>
                                                    {secondaryLabel && (
                                                        <span className="text-[11px] font-medium text-slate-400 mt-0.5">
                                                            {secondaryLabel}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="hidden sm:block text-right">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                        {lead.created_at ? new Date(lead.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Recently'}
                                                    </span>
                                                </div>
                                                <button className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition-all">
                                                    <ChevronRightIcon className="w-5 h-5 text-slate-300 group-hover:text-white" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                }) : (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4">
                                        <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center border-2 border-dashed border-slate-200">
                                            <UsersIcon className="w-10 h-10 opacity-20" />
                                        </div>
                                        <p className="text-xs font-black uppercase tracking-[0.2em]">No recent leads found</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Top Tags */}
                    <div className="relative overflow-hidden rounded-[2rem] bg-white border-2 border-[#ff6d1f] ring-2 ring-white ring-inset shadow-xl flex flex-col h-[580px]">
                        <div className="bg-white h-full w-full flex flex-col relative overflow-hidden">
                            <div className="p-6 bg-[#ff6d1f] relative z-10">
                                <h3 className="text-lg font-black text-white uppercase">Top Tags</h3>
                                <p className="text-white/70 text-[10px] font-black uppercase tracking-[0.2em] mt-1">Frequency Distribution</p>
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4 relative z-10">
                                {stats.leadsByTag.length > 0 ? [...stats.leadsByTag].sort((a, b) => b.count - a.count).map((tag, idx) => {
                                    const maxCount = Math.max(...stats.leadsByTag.map(t => t.count));
                                    const percent = maxCount > 0 ? Math.round((tag.count / maxCount) * 100) : 0;
                                    const colorMap = [
                                        { hex: '#10b981', shadow: 'rgba(16, 185, 129, 0.3)' },
                                        { hex: '#3b82f6', shadow: 'rgba(59, 130, 246, 0.3)' },
                                        { hex: '#f59e0b', shadow: 'rgba(245, 158, 11, 0.3)' },
                                        { hex: '#f43f5e', shadow: 'rgba(244, 63, 94, 0.3)' },
                                        { hex: '#8b5cf6', shadow: 'rgba(139, 92, 246, 0.3)' },
                                        { hex: '#ec4899', shadow: 'rgba(236, 72, 153, 0.3)' }
                                    ];
                                    const theme = colorMap[idx % colorMap.length];

                                    return (
                                        <div key={tag.name} className="group relative py-2 border-b border-slate-50 last:border-0">
                                            <div className="flex items-center justify-between mb-3 px-1">
                                                <div className="flex items-center gap-4">
                                                    {/* GLOWY ICON CONTAINER */}
                                                    <div
                                                        className="w-12 h-12 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 shadow-lg"
                                                        style={{
                                                            backgroundColor: theme.hex,
                                                            boxShadow: `0 10px 20px -5px ${theme.shadow}`
                                                        }}
                                                    >
                                                        <TagIcon className="w-6 h-6 text-white drop-shadow-md" />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[13px] font-[900] text-slate-900 uppercase tracking-tight group-hover:text-[#DA6279] transition-colors font-sans">
                                                            {tag.name}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end">
                                                    <span className="text-sm font-[1000] text-slate-900 leading-none tracking-tighter tabular-nums">
                                                        {tag.count.toLocaleString()}
                                                    </span>
                                                    <div className="mt-1 flex items-center gap-1.5">
                                                        <div className="w-1 h-1 rounded-full" style={{ backgroundColor: theme.hex }}></div>
                                                        <span className="text-[10px] font-black text-[#DA6279] uppercase tracking-widest">
                                                            {percent}%
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* ATTRACTIVE PLASMA TUBE BAR */}
                                            <div className="relative h-4 bg-slate-100 rounded-full overflow-hidden shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)] border border-slate-200/20 group/bar">
                                                {/* DYNAMIC PROGRESS BAR */}
                                                <div
                                                    className="absolute inset-y-0 left-0 transition-all duration-1000 ease-out rounded-full overflow-hidden"
                                                    style={{
                                                        width: `${Math.max(percent, 2)}%`,
                                                        backgroundColor: theme.hex,
                                                        boxShadow: `0 0 20px ${theme.shadow}`
                                                    }}
                                                >
                                                    {/* CORE GLOW LAYER */}
                                                    <div className="absolute inset-0 bg-gradient-to-r from-white/30 via-transparent to-black/10"></div>

                                                    {/* CONTINUOUS SHIMMER LAYER */}
                                                    <div className="absolute inset-0">
                                                        <div
                                                            className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.4)_50%,transparent_100%)] animate-shimmer"
                                                            style={{ backgroundSize: '200% 100%' }}
                                                        ></div>
                                                    </div>

                                                    {/* GLASS REFLECTION TOP */}
                                                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-b from-white/40 to-transparent"></div>
                                                    <div className="absolute top-0 left-0 right-0 h-[1px] bg-white/60"></div>

                                                    {/* HOVER PULSE */}
                                                    <div className="absolute inset-0 bg-white/20 animate-pulse opacity-0 group-hover/bar:opacity-100 transition-opacity"></div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }) : (
                                    /* VIBRANT THEME SKELETON FOR TAGS */
                                    <div className="flex-1 flex flex-col gap-8 justify-center p-4 animate-pulse">
                                        {[...Array(5)].map((_, i) => (
                                            <div key={i} className="flex flex-col gap-3 opacity-30">
                                                <div className="flex justify-between items-center">
                                                    <div className="w-24 h-4 bg-[#9B8EC7] rounded-lg opacity-40"></div>
                                                    <div className="w-12 h-4 bg-[#9B8EC7] rounded-lg opacity-20"></div>
                                                </div>
                                                <div className="w-full h-3 bg-[#9B8EC7] rounded-full border border-[#9B8EC7] border-dashed opacity-20"></div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Top Groups - Space Optimized Final Version */}
                    <div className="relative overflow-hidden rounded-[2rem] bg-white border-2 border-[#c81912] ring-2 ring-white ring-inset shadow-xl flex flex-col h-[580px]">
                        <div className="bg-white h-full w-full flex flex-col relative overflow-hidden">
                            <div className="p-6 bg-[#c81912] relative z-10">
                                <h3 className="text-lg font-black text-white uppercase">Top Groups</h3>
                                <p className="text-white/70 text-[10px] font-black uppercase tracking-[0.2em] mt-1">Contact Categorization</p>
                            </div>
                            
                            <div className="flex-1 p-6 relative z-10 flex flex-col justify-between overflow-hidden">
                                {stats.groups && stats.groups.length > 0 ? (
                                    <div className="flex-1 flex flex-col h-full">
                                        {/* OPTIMIZED HIGH-FIDELITY VERTICAL PILLAR CHART */}
                                        <div className="h-60 flex items-end justify-around gap-4 mb-6 px-4 pt-10 relative bg-slate-50/50 rounded-[2rem] border border-slate-100 shadow-inner">
                                            {/* CHART BACKGROUND GRID */}
                                            <div className="absolute inset-x-6 bottom-0 top-12 flex flex-col justify-between pointer-events-none opacity-[0.06]">
                                                {[...Array(5)].map((_, i) => <div key={i} className="border-t border-slate-500 w-full"></div>)}
                                            </div>

                                            {stats.groups.slice(0, 5).map((group, idx) => {
                                                const maxCount = Math.max(...stats.groups.map(g => g.count));
                                                const percent = maxCount > 0 ? (group.count / maxCount) * 100 : 0;
                                                const colorMap = ['#10b981', '#3b82f6', '#f59e0b', '#f43f5e', '#8b5cf6'];
                                                const barColor = colorMap[idx % colorMap.length];

                                                return (
                                                    <div key={group.name} className="flex flex-col items-center flex-1 h-full group/pillar relative">
                                                        <div className="absolute -top-10 bg-slate-900 text-white text-[10px] font-black px-2.5 py-1.5 rounded-xl opacity-0 group-hover/pillar:opacity-100 transition-all transform -translate-y-1 z-20 shadow-2xl border border-white/10">
                                                            {group.count.toLocaleString()}
                                                        </div>

                                                        <div className="relative w-full max-w-[40px] flex-1 flex flex-col justify-end">
                                                            <div 
                                                                className="w-full rounded-t-xl relative transition-all duration-1000 ease-out shadow-lg overflow-hidden group-hover/pillar:scale-x-110 cursor-pointer"
                                                                style={{ 
                                                                    height: `${Math.max(percent, 10)}%`,
                                                                    backgroundColor: barColor,
                                                                    boxShadow: `0 10px 20px -5px ${barColor}60, inset 0 2px 8px rgba(255,255,255,0.4)`
                                                                }}
                                                            >
                                                                <div className="absolute inset-0 bg-gradient-to-tr from-black/20 via-transparent to-white/40"></div>
                                                                <div className="absolute inset-y-0 left-0 w-1/3 bg-white/20 blur-[1px]"></div>
                                                                <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent_0%,rgba(255,255,255,0.4)_50%,transparent_100%)] animate-shimmer" style={{ backgroundSize: '200% 100%' }}></div>
                                                            </div>
                                                        </div>

                                                        <div className="mt-4 flex flex-col items-center">
                                                            <div 
                                                                className="w-8 h-8 rounded-xl flex items-center justify-center shadow-sm group-hover/pillar:shadow-md transition-all border"
                                                                style={{ backgroundColor: `${barColor}15`, borderColor: `${barColor}40` }}
                                                            >
                                                                <UsersIcon className="w-4 h-4" style={{ color: barColor }} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div className="flex-1 flex flex-col justify-around gap-2">
                                            {stats.groups.slice(0, 4).map((group, idx) => {
                                                const maxCount = Math.max(...stats.groups.map(g => g.count));
                                                const percent = maxCount > 0 ? Math.round((group.count / maxCount) * 100) : 0;
                                                const colorMap = ['#10b981', '#3b82f6', '#f59e0b', '#f43f5e', '#8b5cf6'];
                                                const barColor = colorMap[idx % colorMap.length];

                                                return (
                                                    <div 
                                                        key={group.name} 
                                                        className="flex items-center justify-between p-3.5 rounded-2xl bg-white transition-all duration-300 group/item border cursor-pointer shadow-sm hover:shadow-md"
                                                        style={{ borderColor: `${barColor}80` }}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: barColor }}></div>
                                                            <div className="flex flex-col">
                                                                <span className="text-[11px] font-black text-slate-700 uppercase tracking-tight truncate max-w-[150px]">{group.name}</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-xs font-black text-slate-900 tabular-nums">{group.count.toLocaleString()}</span>
                                                            <div className={`px-2 py-0.5 rounded-lg font-black text-[9px] uppercase tracking-tighter shadow-sm`} style={{ backgroundColor: `${barColor}10`, color: barColor }}>
                                                                {percent}%
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : (
                                    /* VIBRANT THEME SKELETON FOR GROUPS */
                                    <div className="flex-1 flex flex-col gap-6 p-4 animate-pulse">
                                        <div className="h-48 bg-slate-50/50 rounded-[2rem] border border-[#10b981]/20 flex items-end justify-around p-8 gap-3 opacity-30">
                                            {[...Array(5)].map((_, i) => (
                                                <div key={i} className="w-8 h-32 bg-[#10b981] rounded-t-lg border-2 border-[#10b981] border-dashed"></div>
                                            ))}
                                        </div>
                                        <div className="flex-1 flex flex-col gap-3 opacity-20 mt-4">
                                            {[...Array(3)].map((_, i) => (
                                                <div key={i} className="h-12 bg-[#10b981] rounded-2xl border border-[#10b981]/10"></div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default LeadDashboard;
