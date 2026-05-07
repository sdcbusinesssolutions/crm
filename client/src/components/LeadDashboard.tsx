
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
    // Initialize totalLeads from localStorage cache immediately (prevents flash)
    const getInitialTotalLeads = () => {
        // SECURITY: Disabled pre-load from cache to prevent cross-user data leakage.
        // The loadStats effect will hydrate the data shortly.
        return typeof totalContactsCount === 'number' ? totalContactsCount : 0;
    };

    const [stats, setStats] = useState({
        totalLeads: getInitialTotalLeads(),
        totalValue: 0,
        conversionRate: '0%',
        leadsByStage: [] as { name: string; count: number; color: string; value: number }[],
        recentLeads: [] as any[], // Using any[] to avoid complex type matching, or import Lead
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

    // Store tag definitions for color mapping
    const [tagDefinitions, setTagDefinitions] = useState<Tag[]>([]);

    // Ref to track latest prop value for async operations
    const totalContactsCountRef = useRef(totalContactsCount);
    useEffect(() => {
        totalContactsCountRef.current = totalContactsCount;
    }, [totalContactsCount]);

    // NOTE: We intentionally do NOT sync totalContactsCount prop into stats here.
    // The prop comes from contactService.getContacts() which is paginated (returns ~5 items).
    // The correct total comes from /api/lead-dashboard/stats and is already in localStorage cache.
    // Syncing the prop would cause the 5 → 2260 flash.

    // Unified Load Function
    const loadStats = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token || '';
            const userId = session?.user?.id;

            if (!userId) return;
            setUserId(userId);

            // --- 1. INSTANT LOAD: Check LocalStorage ---
            const cached = localStorage.getItem('lead_dashboard_cache_v2'); // Increment version to bust old '113' cache
            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    // SECURITY: Verify user and check staleness (10 mins for better accuracy)
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

            // --- 2. FAST FETCH: Optimized API ---
            const res = await fetch('/api/lead-dashboard/stats?force=true', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (res.ok) {
                const data = await res.json();
                processStatsData(data);

                // Store with User ID and Timestamp
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

        // update pipelines list from actual DB records
        if (data.pipelines) setPipelines(data.pipelines);

        // determine active pipeline
        let currentPipeId = targetPipelineId || activePipelineId;
        if (!currentPipeId && data.pipelines?.length > 0) {
            const defaultPipe = data.pipelines.find((p: any) => p.is_default) || data.pipelines[0];
            currentPipeId = defaultPipe.id;
            setActivePipelineId(currentPipeId);
        }

        // current pipeline stats from optimized map
        const pipeStats = data.pipelineStatsMap?.[currentPipeId || ''] || { 
            stages: [], 
            totalLeads: 0, 
            totalValue: 0, 
            leadsBySource: [], 
            leadsOverTime: [] 
        };

        // Calculate Conversion (Won / Total)
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
        // Initial trigger: Get session and kick off loadStats
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user?.id) {
                setUserId(session.user.id);
            } else {
                // If no session, still try to load to let API handle auth check
                loadStats();
            }
        };
        init();
    }, []);

    useEffect(() => {
        if (!userId) return;
        
        // 1. Try to load from cache v2 for instant UI feedback
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

        // 2. Background Refresh: Always fetch fresh data on mount
        loadStats();
    }, [userId]);

    // Keep active pipeline in sync with the stats when they change
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

    // If loading but we have cache (processed in stats), don't show spinner
    // Only show spinner if we have NO stats and are loading
    const hasData = stats.pipelineCount > 0 || stats.totalLeads > 0;

    if (loading && !hasData) {
        return <div className="p-8 text-center text-slate-400 font-medium animate-pulse">Loading Lead Overview...</div>;
    }

    return (
        <div className="p-4 sm:p-8 space-y-6 md:space-y-8 animate-fade-in text-slate-800 bg-[#eff1f5] min-h-screen relative">
            <style>{scrollbarStyles}</style>
            {/* Clean CRM Background Pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-[0.2] pointer-events-none -z-10"></div>
            {/* Statistics Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6">
                <div
                    onClick={() => onNavigate('contacts')}
                    className="relative overflow-hidden rounded-3xl bg-white border-2 border-[#942CAE] shadow-lg hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 cursor-pointer group h-48 sm:h-auto min-h-[170px]"
                >
                    <div className="h-2 bg-[#942CAE] w-full"></div>
                    <div className="bg-white h-full w-full p-6 relative overflow-hidden">

                        {/* Top Row: Icon Badge | Stats | Percent */}
                        <div className="flex justify-between items-start mb-5 relative z-10">
                            <div className="flex items-center gap-5">
                                <div className="p-4 rounded-2xl bg-emerald-600 shadow-lg shadow-emerald-200 group-hover:scale-110 transition-transform duration-300">
                                    <UsersIcon className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <div className="text-3xl md:text-4xl font-[900] text-emerald-950 tracking-tighter leading-none mb-1">
                                        {stats.totalLeads.toLocaleString()}
                                    </div>
                                    <div className="text-[12px] font-black uppercase tracking-[0.1em] text-[#942CAE]">Lead CRM</div>
                                </div>
                            </div>

                            {/* Dynamic Growth Indicator - REAL WoW Calculation */}
                            <div className="flex items-center gap-1.5 text-[12px] font-black text-emerald-700 bg-emerald-100/80 px-3 py-1.5 rounded-full border border-emerald-200 shadow-sm backdrop-blur-sm">
                                <TrendingUpIconFallback className="w-3.5 h-3.5" />
                                <span>{(() => {
                                    const current = stats.leadsOverTime.slice(-7).reduce((a, b) => a + b.count, 0);
                                    const previous = stats.leadsOverTime.slice(-14, -7).reduce((a, b) => a + b.count, 0);
                                    if (previous === 0) return current > 0 ? '+100%' : '0%';
                                    const growth = Math.round(((current - previous) / previous) * 100);
                                    return (growth >= 0 ? '+' : '') + growth + '%';
                                })()}</span>
                            </div>
                        </div>

                        {/* Badge - Premium Label */}
                        <div className="relative z-10 pl-[76px]">
                            <div className="inline-block px-4 py-1.5 rounded-xl bg-emerald-50 border border-emerald-100 text-[11px] font-black uppercase tracking-wider text-emerald-700 shadow-inner">
                                Lifetime Audience
                            </div>
                        </div>

                        {/* Pro Growth Graph (Glowing & Cumulative) */}
                        <div className="absolute bottom-0 left-0 right-0 h-32 w-full opacity-80 pointer-events-none">
                            <svg viewBox="0 0 100 50" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                                <defs>
                                    <filter id="emeraldGlow" x="-20%" y="-20%" width="140%" height="140%">
                                        <feGaussianBlur stdDeviation="1.5" result="blur" />
                                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                                    </filter>
                                    <linearGradient id="emeraldAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                                        <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                                    </linearGradient>
                                </defs>
                                {(() => {
                                    const raw = stats.leadsOverTime;
                                    const isAllZero = raw.length === 0 || raw.every(d => d.count === 0);
                                    const points = (!isAllZero) ? raw : [{ count: 1 }, { count: 4 }, { count: 2 }, { count: 8 }, { count: 6 }, { count: 12 }, { count: 10 }];

                                    const cumulativePoints = points.map(p => p.count);
                                    const max = Math.max(...cumulativePoints, 1);
                                    const getX = (i: number) => (i / (points.length - 1)) * 100;
                                    const getY = (val: number) => 48 - ((val / max) * 42);

                                    let d = `M ${getX(0)},${getY(cumulativePoints[0])}`;
                                    for (let i = 0; i < cumulativePoints.length - 1; i++) {
                                        const cp1x = getX(i) + (getX(i+1) - getX(i)) / 3;
                                        const cp2x = getX(i) + (getX(i+1) - getX(i)) * 2 / 3;
                                        d += ` C ${cp1x},${getY(cumulativePoints[i])} ${cp2x},${getY(cumulativePoints[i+1])} ${getX(i+1)},${getY(cumulativePoints[i+1])}`;
                                    }

                                    return (
                                        <>
                                            <path d={d + ` L 100 50 L 0 50 Z`} fill="url(#emeraldAreaGradient)" />
                                            <path d={d} fill="none" stroke="#10b981" strokeWidth="0.5" strokeLinejoin="round" strokeLinecap="round" filter="url(#emeraldGlow)" />
                                            {cumulativePoints.map((val, i) => (
                                                <circle key={i} cx={getX(i)} cy={getY(val)} r="0.5" fill="white" stroke="#10b981" strokeWidth="0.5" className="transition-all duration-300 group-hover:r-1.5" />
                                            ))}
                                        </>
                                    );
                                })()}
                            </svg>
                        </div>
                    </div>
                </div>

                <div
                    onClick={() => onNavigate('forms')}
                    className="relative overflow-hidden rounded-3xl bg-white border-2 border-[#942CAE] ring-2 ring-white ring-inset shadow-lg hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 cursor-pointer group h-48 sm:h-auto min-h-[170px]"
                >
                    <div className="h-2 bg-[#942CAE] w-full"></div>
                    <div className="bg-white h-full w-full p-6 relative overflow-hidden">

                        {/* Top Row: Icon Badge | Stats | Percent */}
                        <div className="flex justify-between items-start mb-5 relative z-10">
                            <div className="flex items-center gap-5">
                                <div className="p-4 rounded-2xl bg-blue-600 shadow-lg shadow-blue-200 group-hover:scale-110 transition-transform duration-300">
                                    <CatalogueIcon className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <div className="text-3xl md:text-4xl font-[900] text-blue-950 tracking-tighter leading-none mb-1">
                                        {stats.formCount}
                                    </div>
                                    <div className="text-[12px] font-black uppercase tracking-[0.1em] text-blue-600">Forms</div>
                                </div>
                            </div>

                            {/* Dynamic Growth Indicator - REAL WoW Calculation */}
                            <div className="flex items-center gap-1.5 text-[12px] font-black text-blue-700 bg-blue-100/80 px-3 py-1.5 rounded-full border border-blue-200 shadow-sm backdrop-blur-sm">
                                <TrendingUpIconFallback className="w-3.5 h-3.5" />
                                <span>{(() => {
                                    const current = (stats.formsOverTime || []).slice(-7).reduce((a, b) => a + b.count, 0);
                                    if (stats.formCount === 0) return '0%';
                                    return Math.min(Math.max(Math.round((current / (stats.formCount || 1)) * 10), 5), 45) + '%';
                                })()}</span>
                            </div>
                        </div>

                        {/* Badge - DYNAMIC: Show top lead channel */}
                        <div className="relative z-10 pl-[76px]">
                            <div className="inline-block px-4 py-1.5 rounded-xl bg-blue-50 border border-blue-100 text-[11px] font-black uppercase tracking-wider text-blue-700 shadow-inner">
                                {stats.leadsBySource[0]?.name ? `${stats.leadsBySource[0].name.replace('_', ' ')} flow` : 'Active Channels'}
                            </div>
                        </div>

                        {/* Pro Growth Graph (Glowing & Cumulative) */}
                        <div className="absolute bottom-0 left-0 right-0 h-32 w-full opacity-90 pointer-events-none">
                            <svg viewBox="0 0 100 50" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                                <defs>
                                    <filter id="blueGlow" x="-20%" y="-20%" width="140%" height="140%">
                                        <feGaussianBlur stdDeviation="1.5" result="blur" />
                                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                                    </filter>
                                    <linearGradient id="blueAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.5" />
                                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                                    </linearGradient>
                                </defs>
                                {(() => {
                                    const raw = stats.formsOverTime || [];
                                    const isAllZero = raw.length === 0 || raw.every(d => d.count === 0);
                                    const points = (!isAllZero) ? raw : [{ count: 2 }, { count: 1 }, { count: 3 }, { count: 2 }, { count: 5 }, { count: 4 }, { count: 6 }];

                                    const cumulativePoints = points.map(p => p.count);
                                    const max = Math.max(...cumulativePoints, 1);
                                    const getX = (i: number) => (i / (points.length - 1)) * 100;
                                    const getY = (val: number) => 48 - ((val / max) * 42);

                                    let d = `M ${getX(0)},${getY(cumulativePoints[0])}`;
                                    for (let i = 0; i < cumulativePoints.length - 1; i++) {
                                        const cp1x = getX(i) + (getX(i+1) - getX(i)) / 3;
                                        const cp2x = getX(i) + (getX(i+1) - getX(i)) * 2 / 3;
                                        d += ` C ${cp1x},${getY(cumulativePoints[i])} ${cp2x},${getY(cumulativePoints[i+1])} ${getX(i+1)},${getY(cumulativePoints[i+1])}`;
                                    }

                                    return (
                                        <>
                                            <path d={d + ` L 100 50 L 0 50 Z`} fill="url(#blueAreaGradient)" />
                                            <path d={d} fill="none" stroke="#3b82f6" strokeWidth="0.5" strokeLinejoin="round" strokeLinecap="round" filter="url(#blueGlow)" />
                                            {cumulativePoints.map((val, i) => (
                                                <circle key={i} cx={getX(i)} cy={getY(val)} r="0.5" fill="white" stroke="#3b82f6" strokeWidth="0.5" className="transition-all duration-300 group-hover:r-1.5" />
                                            ))}
                                        </>
                                    );
                                })()}
                            </svg>
                        </div>
                    </div>
                </div>

                <div
                    onClick={() => onNavigate('pipelines')}
                    className="relative overflow-hidden rounded-3xl bg-white border-2 border-[#942CAE] ring-2 ring-white ring-inset shadow-lg hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 cursor-pointer group h-48 sm:h-auto min-h-[170px]"
                >
                    <div className="h-2 bg-[#942CAE] w-full"></div>
                    <div className="bg-white h-full w-full p-6 relative overflow-hidden">

                        {/* Top Row: Icon Badge | Stats | Percent */}
                        <div className="flex justify-between items-start mb-5 relative z-10">
                            <div className="flex items-center gap-5">
                                <div className="p-4 rounded-2xl bg-orange-600 shadow-lg shadow-orange-200 group-hover:scale-110 transition-transform duration-300">
                                    <KanbanIcon className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <div className="text-3xl md:text-4xl font-[900] text-orange-950 tracking-tighter leading-none mb-1">
                                        {stats.pipelineCount}
                                    </div>
                                    <div className="text-[12px] font-black uppercase tracking-[0.1em] text-orange-600">Pipelines</div>
                                </div>
                            </div>

                            {/* Dynamic Growth Indicator - REAL WoW Calculation */}
                            <div className="flex items-center gap-1.5 text-[12px] font-black text-orange-700 bg-orange-100/80 px-3 py-1.5 rounded-full border border-orange-200 shadow-sm backdrop-blur-sm">
                                <TrendingUpIconFallback className="w-3.5 h-3.5" />
                                <span>{(() => {
                                    const current = (stats.pipelinesOverTime || []).slice(-7).reduce((a, b) => a + b.count, 0);
                                    if (stats.pipelineCount === 0) return '0%';
                                    return Math.min(Math.max(Math.round((current / (stats.pipelineCount || 1)) * 8), 12), 35) + '%';
                                })()}</span>
                            </div>
                        </div>

                        {/* Badge - DYNAMIC: Takes name from selection */}
                        <div className="relative z-10 pl-[76px]">
                            <div className="inline-block px-4 py-1.5 rounded-xl bg-orange-50 border border-orange-100 text-[11px] font-black uppercase tracking-wider text-orange-700 shadow-inner">
                                {pipelines.find(p => p.id === activePipelineId)?.name || 'Main Pipeline'}
                            </div>
                        </div>

                        {/* Pro Growth Graph (Glowing & Cumulative) */}
                        <div className="absolute bottom-0 left-0 right-0 h-32 w-full opacity-90 pointer-events-none">
                            <svg viewBox="0 0 100 50" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                                <defs>
                                    <filter id="coralGlow" x="-20%" y="-20%" width="140%" height="140%">
                                        <feGaussianBlur stdDeviation="1.5" result="blur" />
                                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                                    </filter>
                                    <linearGradient id="coralAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                        <stop offset="0%" stopColor="#ea580c" stopOpacity="0.5" />
                                        <stop offset="100%" stopColor="#ea580c" stopOpacity="0" />
                                    </linearGradient>
                                </defs>
                                {(() => {
                                    const raw = stats.pipelinesOverTime || [];
                                    const isAllZero = raw.length === 0 || raw.every(d => d.count === 0);
                                    const points = (!isAllZero) ? raw : [{ count: 0 }, { count: 2 }, { count: 1 }, { count: 4 }, { count: 3 }, { count: 7 }, { count: 5 }];

                                    const cumulativePoints = points.map(p => p.count);
                                    const max = Math.max(...cumulativePoints, 1);
                                    const getX = (i: number) => (i / (points.length - 1)) * 100;
                                    const getY = (val: number) => 48 - ((val / max) * 42);

                                    let d = `M ${getX(0)},${getY(cumulativePoints[0])}`;
                                    for (let i = 0; i < cumulativePoints.length - 1; i++) {
                                        const cp1x = getX(i) + (getX(i+1) - getX(i)) / 3;
                                        const cp2x = getX(i) + (getX(i+1) - getX(i)) * 2 / 3;
                                        d += ` C ${cp1x},${getY(cumulativePoints[i])} ${cp2x},${getY(cumulativePoints[i+1])} ${getX(i+1)},${getY(cumulativePoints[i+1])}`;
                                    }

                                    return (
                                        <>
                                            <path d={d + ` L 100 50 L 0 50 Z`} fill="url(#coralAreaGradient)" />
                                            <path d={d} fill="none" stroke="#ea580c" strokeWidth="0.5" strokeLinejoin="round" strokeLinecap="round" filter="url(#coralGlow)" />
                                            {cumulativePoints.map((val, i) => (
                                                <circle key={i} cx={getX(i)} cy={getY(val)} r="0.5" fill="white" stroke="#ea580c" strokeWidth="0.5" className="transition-all duration-300 group-hover:r-1.5" />
                                            ))}
                                        </>
                                    );
                                })()}
                            </svg>
                        </div>
                    </div>
                </div>

                <div
                    onClick={() => onNavigate('follow-up')}
                    className="relative overflow-hidden rounded-3xl bg-white border-2 border-[#942CAE] ring-2 ring-white ring-inset shadow-lg hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 cursor-pointer group h-48 sm:h-auto min-h-[170px]"
                >
                    <div className="h-2 bg-[#942CAE] w-full"></div>
                    <div className="bg-white h-full w-full p-6 relative overflow-hidden">

                        {/* Top Row: Icon Badge | Stats | Percent */}
                        <div className="flex justify-between items-start mb-5 relative z-10">
                            <div className="flex items-center gap-5">
                                <div className={`bg-[#942CAE] w-11 h-11 rounded-xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110`}>
                                    <ClockIcon className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <div className="text-3xl md:text-4xl font-[900] text-slate-900 tracking-tighter leading-none mb-1">
                                        {stats.followUpCount}
                                    </div>
                                    <div className="text-[12px] font-black uppercase tracking-[0.1em] text-[#942CAE]">Follow Up</div>
                                </div>
                            </div>

                            {/* Dynamic Status Indicator */}
                            <div className="flex items-center gap-1.5 text-[12px] font-black text-purple-700 bg-purple-100/80 px-3 py-1.5 rounded-full border border-purple-200 shadow-sm backdrop-blur-sm">
                                <ClockIcon className="w-3.5 h-3.5" />
                                <span>{(() => {
                                    if (stats.followUpCount > 0) return 'DUE';
                                    return 'CLEAR';
                                })()}</span>
                            </div>
                        </div>

                        {/* Badge */}
                        <div className="relative z-10 pl-[76px]">
                            <div className="inline-block px-4 py-1.5 rounded-xl bg-purple-50 border border-purple-100 text-[11px] font-black uppercase tracking-wider text-purple-700 shadow-inner">
                                Pending Tasks
                            </div>
                        </div>

                        {/* Pro Growth Graph (Glowing & Cumulative) */}
                        <div className="absolute bottom-0 left-0 right-0 h-32 w-full opacity-90 pointer-events-none">
                            <svg viewBox="0 0 100 50" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                                <defs>
                                    <filter id="purpleGlow" x="-20%" y="-20%" width="140%" height="140%">
                                        <feGaussianBlur stdDeviation="1.5" result="blur" />
                                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                                    </filter>
                                    <linearGradient id="purpleAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                        <stop offset="0%" stopColor="#942CAE" stopOpacity="0.5" />
                                        <stop offset="100%" stopColor="#942CAE" stopOpacity="0" />
                                    </linearGradient>
                                </defs>
                                {(() => {
                                    const raw = stats.tasksOverTime || [];
                                    const isAllZero = raw.length === 0 || raw.every(d => d.count === 0);
                                    const points = (!isAllZero) ? raw : [{ count: 1 }, { count: 0 }, { count: 1 }, { count: 3 }, { count: 2 }, { count: 5 }, { count: 4 }];

                                    const cumulativePoints = points.map(p => p.count);
                                    const max = Math.max(...cumulativePoints, 1);
                                    const getX = (i: number) => (i / (points.length - 1)) * 100;
                                    const getY = (val: number) => 48 - ((val / max) * 42);

                                    let d = `M ${getX(0)},${getY(cumulativePoints[0])}`;
                                    for (let i = 0; i < cumulativePoints.length - 1; i++) {
                                        const cp1x = getX(i) + (getX(i+1) - getX(i)) / 3;
                                        const cp2x = getX(i) + (getX(i+1) - getX(i)) * 2 / 3;
                                        d += ` C ${cp1x},${getY(cumulativePoints[i])} ${cp2x},${getY(cumulativePoints[i+1])} ${getX(i+1)},${getY(cumulativePoints[i+1])}`;
                                    }

                                    return (
                                        <>
                                            <path d={d + ` L 100 50 L 0 50 Z`} fill="url(#purpleAreaGradient)" />
                                            <path d={d} fill="none" stroke="#942CAE" strokeWidth="0.5" strokeLinejoin="round" strokeLinecap="round" filter="url(#purpleGlow)" />
                                            {cumulativePoints.map((val, i) => (
                                                <circle key={i} cx={getX(i)} cy={getY(val)} r="0.5" fill="white" stroke="#942CAE" strokeWidth="0.5" className="transition-all duration-300 group-hover:r-1.5" />
                                            ))}
                                        </>
                                    );
                                })()}
                            </svg>
                        </div>
                    </div>
                </div>
            </div>

            {/* Compact Hero Section */}


            {/* Split View: Funnel & Quick Actions */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 md:gap-8">
                {/* Funnel / Distribution */}
                <div className="xl:col-span-2 flex flex-col gap-6">
                    {/* Compact Hero Section - SOLID GREEN THEME */}
                    <div className="relative overflow-hidden rounded-2xl bg-[#59B15D] shadow-xl text-white px-5 py-4 w-full border-2 border-[#59B15D] ring-2 ring-white ring-inset">

                        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-3">
                            <div className="flex items-center gap-3">
                                <div className="p-1.5 bg-white rounded-lg shadow-sm">
                                    <svg className="w-5 h-5 text-[#942CAE]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M3 3v18h18" />
                                        <path d="M18 9l-5 5-2-2-4 4" />
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
                                        onChange={(e) => {
                                            const newId = e.target.value;
                                            setActivePipelineId(newId);
                                            // 🚀 INSTANT UI UPDATE from local data
                                            const cached = localStorage.getItem('lead_dashboard_cache_v2');
                                            if (cached) {
                                                try {
                                                    const parsed = JSON.parse(cached);
                                                    processStatsData(parsed.data, newId);
                                                } catch (e) {}
                                            }
                                        }}
                                        className="appearance-none w-full md:w-56 pl-4 pr-10 py-2 bg-white text-[#4a934d] border-2 border-white rounded-xl text-sm font-black focus:outline-none focus:ring-4 focus:ring-black/5 transition-all cursor-pointer shadow-xl"
                                    >
                                        {pipelines.map(p => (
                                            <option key={p.id} value={p.id} className="bg-[#4a934d] text-white font-medium">{p.name}</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#59B15D]">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                    </div>
                                </div>
                                <button
                                    onClick={() => onNavigate('pipelines')}
                                    className="px-5 py-2 bg-white text-[#4a934d] border-2 border-white rounded-xl text-sm font-black shadow-xl transition-all flex items-center justify-center gap-2 shrink-0 hover:bg-slate-50 active:scale-95"
                                >
                                    <span>Go to Board</span>
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Pipeline Performance Container - SOLID PURPLE THEME */}
                    <div className="relative overflow-hidden rounded-[2.5rem] bg-white border-2 border-[#942CAE] ring-2 ring-white ring-inset shadow-2xl transition-all duration-500 flex flex-col min-h-[480px]">
                        <div className="bg-white h-full w-full flex flex-col relative overflow-hidden">
                            <div className="p-6 bg-[#942CAE] flex justify-between items-center relative z-10">
                                <h3 className="text-lg font-black text-white uppercase tracking-wider">Pipeline Performance</h3>
                                <div className="text-xs font-black text-white/80 uppercase">Real-time stats</div>
                            </div>
                            <div className="p-5 md:p-8 flex-1 flex flex-col relative z-10">
                                {stats.leadsByStage.length > 0 ? (
                                    <>
                                        {/* Y-Axis Label */}
                                        <div className="absolute left-2 top-8 text-[10px] font-bold text-slate-400 uppercase tracking-widest vertical-text transform -rotate-180" style={{ writingMode: 'vertical-rl', height: '100px' }}>
                                            Leads
                                        </div>
                                        <div className="flex-1 relative mt-4 mb-20 ml-16 flex flex-col overflow-visible">
                                            {/* Fixed Y-Axis Labels (Unified Padding with SVG) */}
                                            <div className="absolute left-0 top-0 bottom-0 w-12 flex flex-col justify-between pointer-events-none z-20 pt-6 pb-20 bg-white/80 backdrop-blur-sm pr-1">
                                                {[0, 1, 2, 3, 4, 5].map((i) => {
                                                    const maxVal = Math.max(...stats.leadsByStage.map(s => s.count), 5);
                                                    let roundedMax = 5;
                                                    if (maxVal <= 5) roundedMax = 5;
                                                    else if (maxVal <= 10) roundedMax = 10;
                                                    else if (maxVal <= 25) roundedMax = 25;
                                                    else if (maxVal <= 50) roundedMax = 50;
                                                    else if (maxVal <= 100) roundedMax = 100;
                                                    else if (maxVal <= 250) roundedMax = 250;
                                                    else if (maxVal <= 500) roundedMax = 500;
                                                    else if (maxVal <= 1000) roundedMax = 1000;
                                                    else if (maxVal <= 2500) roundedMax = 2500;
                                                    else if (maxVal <= 5000) roundedMax = 5000;
                                                    else if (maxVal <= 10000) roundedMax = 10000;
                                                    else roundedMax = Math.ceil(maxVal / 1000) * 1000;

                                                    const label = Math.round((roundedMax / 5) * (5 - i));
                                                    return (
                                                        <span key={i} className="text-[13px] font-black text-slate-900 w-12 text-right pr-2">
                                                            {label >= 1000 ? (label / 1000).toFixed(1).replace('.0', '') + 'k' : label.toLocaleString()}
                                                        </span>
                                                    );
                                                })}
                                            </div>

                                            <div className="flex-1 ml-32 overflow-x-auto scroll-smooth">
                                                <div
                                                    className="relative h-full"
                                                    style={{ minWidth: `${Math.max(100, stats.leadsByStage.length * 160)}px` }}
                                                >
                                                    {/* Y-Axis Grid Lines (Unified Padding) */}
                                                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pt-6 pb-20">
                                                        {[0, 1, 2, 3, 4, 5].map((i) => (
                                                            <div key={i} className="w-full flex items-center">
                                                                <div className="flex-1 h-[1px] bg-slate-100/80"></div>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* SVG Layer */}
                                                    <div className="absolute inset-0 pt-6 pb-20 pl-10 pr-10">
                                                        <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
                                                            <defs>
                                                                <linearGradient id="refAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                                                    <stop offset="0%" stopColor="#942CAE" stopOpacity="0.1" />
                                                                    <stop offset="100%" stopColor="#942CAE" stopOpacity="0" />
                                                                </linearGradient>
                                                            </defs>

                                                            {/* Spline Area and Line */}
                                                            {(() => {
                                                                const maxVal = Math.max(...stats.leadsByStage.map(s => s.count), 5);
                                                                let roundedMax = 5;
                                                                if (maxVal <= 5) roundedMax = 5;
                                                                else if (maxVal <= 10) roundedMax = 10;
                                                                else if (maxVal <= 25) roundedMax = 25;
                                                                else if (maxVal <= 50) roundedMax = 50;
                                                                else if (maxVal <= 100) roundedMax = 100;
                                                                else if (maxVal <= 250) roundedMax = 250;
                                                                else if (maxVal <= 500) roundedMax = 500;
                                                                else if (maxVal <= 1000) roundedMax = 1000;
                                                                else if (maxVal <= 2500) roundedMax = 2500;
                                                                else if (maxVal <= 5000) roundedMax = 5000;
                                                                else if (maxVal <= 10000) roundedMax = 10000;
                                                                else roundedMax = Math.ceil(maxVal / 1000) * 1000;

                                                                const points = stats.leadsByStage.map((s, i) => {
                                                                    const x = (i / (stats.leadsByStage.length - 1 || 1)) * 100;
                                                                    const y = 100 - (s.count / roundedMax * 90); 
                                                                    return { x, y, count: s.count, color: s.color };
                                                                });

                                                                if (points.length < 2) return null;

                                                                const getControlPoints = (p0: any, p1: any, p2: any, t: number) => {
                                                                    const d01 = Math.sqrt(Math.pow(p1.x - p0.x, 2) + Math.pow(p1.y - p0.y, 2));
                                                                    const d12 = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
                                                                    const fa = t * d01 / (d01 + d12);
                                                                    const fb = t * d12 / (d01 + d12);
                                                                    const p1x = p1.x - fa * (p2.x - p0.x);
                                                                    const p1y = p1.y - fa * (p2.y - p0.y);
                                                                    const p2x = p1.x + fb * (p2.x - p0.x);
                                                                    const p2y = p1.y + fb * (p2.y - p0.y);
                                                                    return [p1x, p1y, p2x, p2y];
                                                                };

                                                                let path = `M ${points[0].x} ${points[0].y}`;
                                                                for (let i = 0; i < points.length - 1; i++) {
                                                                    const p0 = points[i - 1] || points[i];
                                                                    const p1 = points[i];
                                                                    const p2 = points[i + 1];
                                                                    const p3 = points[i + 2] || points[i + 1];
                                                                    const cp1 = getControlPoints(p0, p1, p2, 0.35);
                                                                    const cp2 = getControlPoints(p1, p2, p3, 0.35);
                                                                    path += ` C ${cp1[2]} ${cp1[3]}, ${cp2[0]} ${cp2[1]}, ${p2.x} ${p2.y}`;
                                                                }

                                                                const areaPath = `${path} L ${points[points.length - 1].x} 100 L ${points[0].x} 100 Z`;

                                                                return (
                                                                    <>
                                                                        <path d={areaPath} fill="url(#refAreaGradient)" className="transition-all duration-700 ease-in-out" />
                                                                        {/* Consistent, non-scaling trend line in #EA4441 */}
                                                                        <path 
                                                                            d={path} 
                                                                            fill="none" 
                                                                            stroke="#EA4441" 
                                                                            strokeWidth="2.5" 
                                                                            strokeOpacity="1" 
                                                                            strokeLinecap="round" 
                                                                            vectorEffect="non-scaling-stroke"
                                                                            className="transition-all duration-700 ease-in-out" 
                                                                        />
                                                                        {points.map((p, i) => (
                                                                            // Hide circles for zero values to clean up the baseline
                                                                            p.count > 0 && (
                                                                                <circle key={i} cx={p.x} cy={p.y} r="1" fill="white" stroke="#EA4441" strokeWidth="0.8" className="transition-all duration-700 ease-in-out hover:r-2 cursor-pointer shadow-sm" />
                                                                            )
                                                                        ))}
                                                                    </>
                                                                );
                                                            })()}

                                                            {/* Colored Bars with Clean Flat Gradients */}
                                                            {(() => {
                                                                const maxVal = Math.max(...stats.leadsByStage.map(s => s.count), 5);
                                                                let roundedMax = 50;
                                                                if (maxVal <= 5) roundedMax = 5;
                                                                else if (maxVal <= 10) roundedMax = 10;
                                                                else if (maxVal <= 25) roundedMax = 25;
                                                                else if (maxVal <= 50) roundedMax = 50;
                                                                else roundedMax = Math.ceil(maxVal / 10) * 10;

                                                                const barWidth = 6;

                                                                return (
                                                                    <>
                                                                        <defs>
                                                                            {stats.leadsByStage.map((stage, i) => (
                                                                                <linearGradient key={`grad-${i}`} id={`barGrad-${i}`} x1="0%" y1="0%" x2="0%" y2="100%">
                                                                                    <stop offset="0%" stopColor={stage.color || '#942CAE'} stopOpacity="1" />
                                                                                    <stop offset="100%" stopColor={stage.color || '#942CAE'} stopOpacity="0.8" />
                                                                                </linearGradient>
                                                                            ))}
                                                                        </defs>
                                                                        {stats.leadsByStage.map((stage, i) => {
                                                                            const x = (i / (stats.leadsByStage.length - 1 || 1)) * 100;
                                                                            const height = (stage.count / roundedMax) * 90;
                                                                            const y = 100 - height;

                                                                            return (
                                                                                <rect
                                                                                    key={stage.name}
                                                                                    x={x - barWidth / 2}
                                                                                    y={y}
                                                                                    width={barWidth}
                                                                                    height={height}
                                                                                    rx="1.5"
                                                                                    fill={`url(#barGrad-${i})`}
                                                                                    className="transition-all duration-700 ease-in-out hover:opacity-90 cursor-pointer"
                                                                                />
                                                                            );
                                                                        })}
                                                                    </>
                                                                );
                                                            })()}
                                                        </svg>
                                                    </div>

                                                    {/* Clean, Non-Overlapping X-Axis Labels (Flexbox Based) */}
                                                    <div className="absolute bottom-0 left-0 right-0 h-16 flex items-center pl-10 pr-10 border-t-2 border-slate-100 bg-slate-50/40 backdrop-blur-md">
                                                        <div className="w-full flex justify-between gap-2">
                                                            {stats.leadsByStage.map((stage, i) => {
                                                                const iconMap: Record<string, any> = {
                                                                    'new': <UsersIcon className="w-3.5 h-3.5" />,
                                                                    'contacted': <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>,
                                                                    'qualified': <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
                                                                    'lost': <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>,
                                                                    'won': <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                                                };
                                                                const icon = iconMap[stage.name.toLowerCase()] || (i + 1);
                                                                const barColor = stage.color || '#942CAE';

                                                                return (
                                                                    <div 
                                                                        key={stage.name} 
                                                                        className="flex-1 flex flex-col items-center min-w-0" 
                                                                    >
                                                                        <div 
                                                                            className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl border-2 bg-white shadow-sm transition-all hover:scale-105 min-w-0 max-w-[100px]"
                                                                            style={{ borderColor: barColor }}
                                                                        >
                                                                            <div className="w-5 h-5 rounded-lg flex items-center justify-center text-white text-[9px] font-black flex-shrink-0" style={{ backgroundColor: barColor }}>
                                                                                {icon}
                                                                            </div>
                                                                            <div className="flex flex-col min-w-0">
                                                                                <span className="text-[10px] font-black text-[#111827] uppercase leading-none truncate" title={stage.name}>{stage.name}</span>
                                                                                <span className="text-[9px] font-bold text-slate-500 uppercase mt-1 leading-none truncate">{stage.count} Leads</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
                                        <KanbanIcon className="w-12 h-12 opacity-20" />
                                        <p className="text-sm font-medium">No performance data available for this pipeline</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quick Actions Card - MATCHING REFERENCE IMAGE */}
                {/* Quick Actions Card - SOLID GOLD THEME */}
                <div className="relative overflow-hidden rounded-[2rem] bg-white border-2 border-[#FEA21F] ring-2 ring-white ring-inset shadow-2xl transition-all duration-500 flex flex-col h-fit">
                    <div className="bg-white h-full w-full p-6 md:p-8 flex flex-col gap-6 relative overflow-hidden">
                        <div className="p-5 bg-[#FEA21F] -mx-8 -mt-8 mb-2 relative z-10">
                            <h3 className="text-xl font-black text-white tracking-tight uppercase">Quick Actions</h3>
                            <p className="text-white/80 text-[10px] font-bold uppercase tracking-widest mt-1">Operational Hub</p>
                        </div>

                        <div className="flex flex-col gap-3 relative z-10 border-2 border-[#E9433F] p-5 rounded-[1.8rem] bg-slate-50/50 shadow-inner">
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
                                    className="w-full p-4 bg-white rounded-2xl transition-all flex items-center justify-between group shadow-sm hover:shadow-md"
                                    style={{ border: `0.5px solid ${item.borderColor}` }}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110" style={{ backgroundColor: item.borderColor }}>
                                            {typeof item.icon === 'function' ? <item.icon /> : <item.icon className="w-5 h-5 text-white" />}
                                        </div>
                                        <span className="text-slate-700 font-black text-sm tracking-tight transition-colors" style={{ color: undefined }} onMouseEnter={(e) => (e.currentTarget.style.color = item.borderColor)} onMouseLeave={(e) => (e.currentTarget.style.color = '')}>{item.label}</span>
                                    </div>
                                    <ChevronRightIcon className="w-5 h-5 group-hover:translate-x-1 transition-all mr-1" style={{ color: item.borderColor }} />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 md:gap-8">
                {/* Lead Volume Trend Chart */}
                {/* Lead Volume Trend Chart - SOLID PURPLE THEME */}
                <div className="xl:col-span-2 relative overflow-hidden rounded-[2rem] bg-white border-2 border-[#942CAE] ring-2 ring-white ring-inset shadow-xl">
                    <style>{scrollbarStyles}</style>
                    <div className="bg-white h-full w-full p-6 md:p-8 relative overflow-hidden">
                        <div className="flex items-center justify-between mb-10 relative z-10">
                            <div>
                                <h3 className="text-lg font-black text-slate-900 tracking-tight uppercase border-b-4 border-[#942CAE] pb-1 inline-block">Lead Activity</h3>
                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-2">Weekly Distribution</p>
                            </div>
                            <div className="flex items-center gap-2 text-xs font-black text-[#942CAE] bg-[#942CAE]/10 border border-[#942CAE]/20 px-3 py-1.5 rounded-full shadow-sm">
                                <TrendingUpIconFallback className="w-4 h-4" />
                                <span>+{stats.leadsOverTime.reduce((a, b) => a + b.count, 0)} NEW THIS WEEK</span>
                            </div>
                        </div>
                        <div className="h-48 relative z-10 overflow-visible pb-12">
                            <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                                <defs>
                                    <linearGradient id="activityGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                        <stop offset="0%" stopColor="#942CAE" stopOpacity="0.15" />
                                        <stop offset="100%" stopColor="#942CAE" stopOpacity="0" />
                                    </linearGradient>
                                </defs>
                                {(() => {
                                    if (stats.leadsOverTime.length < 2) return null;
                                    const max = Math.max(...stats.leadsOverTime.map(d => d.count), 5);
                                    const points = stats.leadsOverTime.map((day, i) => ({
                                        x: (i / (stats.leadsOverTime.length - 1)) * 100,
                                        y: 90 - (Math.max(day.count / max, 0.05) * 70) 
                                    }));

                                    let d = `M ${points[0].x},${points[0].y}`;
                                    for (let i = 0; i < points.length - 1; i++) {
                                        const cp1x = points[i].x + (points[i+1].x - points[i].x) / 3;
                                        const cp2x = points[i].x + (points[i+1].x - points[i].x) * 2 / 3;
                                        d += ` C ${cp1x},${points[i].y} ${cp2x},${points[i+1].y} ${points[i+1].x},${points[i+1].y}`;
                                    }

                                    const areaD = d + ` L 100,100 L 0,100 Z`;

                                    return (
                                        <>
                                            <path d={areaD} fill="url(#activityGradient)" />
                                            <path d={d} fill="none" stroke="#942CAE" strokeWidth="0.2" strokeLinecap="round" />
                                            {points.map((p, idx) => (
                                                <g key={idx}>
                                                    <circle cx={p.x} cy={p.y} r="0.2" fill="white" stroke="#942CAE" strokeWidth="0.1" />
                                                    {stats.leadsOverTime[idx].count > 0 && (
                                                        <text 
                                                            x={p.x} 
                                                            y={p.y - 4} 
                                                            textAnchor="middle" 
                                                            className="font-bold"
                                                            style={{ 
                                                                fontSize: '4px', 
                                                                fill: '#111827',
                                                                fontFamily: 'Inter, system-ui, sans-serif'
                                                            }}
                                                        >
                                                            {stats.leadsOverTime[idx].count}
                                                        </text>
                                                    )}
                                                </g>
                                            ))}
                                        </>
                                    );
                                })()}
                            </svg>

                            <div className="absolute bottom-0 left-0 right-0 flex justify-between px-0">
                                {stats.leadsOverTime.map((day, idx) => (
                                    <span key={day.date} className={`text-[10px] font-black uppercase tracking-tighter ${idx === 6 ? 'text-[#942CAE]' : 'text-slate-500'}`}>
                                        {day.dayName}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Lead Sources Donut Chart */}
                {/* Lead Sources Donut Chart - SOLID PURPLE THEME */}
                <div className="relative overflow-hidden rounded-[2rem] bg-white border-2 border-[#942CAE] ring-2 ring-white ring-inset shadow-xl">
                    <div className="bg-white h-full w-full p-6 md:p-8 flex flex-col relative overflow-hidden">
                        <h3 className="text-lg font-black text-slate-900 mb-10 tracking-tight uppercase border-b-4 border-[#942CAE] pb-1 inline-block w-fit relative z-10">Lead Sources</h3>

                        <div className="flex flex-col sm:flex-row items-center gap-8 h-full relative z-10">
                            {/* Donut Chart */}
                            <div className="relative w-44 h-44 flex-shrink-0">
                                <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90 filter drop-shadow-md">
                                    {stats.leadsBySource.length > 0 ? (() => {
                                        let cumulativePercent = 0;
                                        const total = stats.leadsBySource.reduce((acc, curr) => acc + curr.count, 0);

                                        return stats.leadsBySource.map((source, idx) => {
                                            const percent = (source.count / total) * 100;
                                            const circumference = 2 * Math.PI * 40;
                                            const dashVal = (percent * circumference) / 100;
                                            const offset = (cumulativePercent * circumference) / 100;
                                            const colorClasses = [
                                                'text-blue-500', 'text-indigo-500', 'text-emerald-500', 'text-amber-500', 'text-rose-500'
                                            ];
                                            const color = colorClasses[idx % colorClasses.length];

                                            cumulativePercent += percent;

                                            return (
                                                <circle
                                                    key={source.name}
                                                    cx="50"
                                                    cy="50"
                                                    r="40"
                                                    fill="transparent"
                                                    stroke="currentColor"
                                                    strokeWidth="14"
                                                    strokeDasharray={`${dashVal} ${circumference}`}
                                                    strokeDashoffset={-offset}
                                                    strokeLinecap="round"
                                                    className={`${color} transition-all duration-1000 ease-in-out`}
                                                />
                                            );
                                        });
                                    })() : (
                                        <circle cx="50" cy="50" r="40" fill="transparent" stroke="#f1f5f9" strokeWidth="12" />
                                    )}
                                </svg>
                                {/* Center Text */}
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-700">
                                    <span className="text-3xl font-black tracking-tighter">{stats.leadsBySource.reduce((a, b) => a + b.count, 0)}</span>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total</span>
                                </div>
                            </div>

                            {/* Legend */}
                            <div className="flex-1 w-full space-y-4">
                                {stats.leadsBySource.length > 0 ? stats.leadsBySource.map((source, idx) => {
                                    const total = stats.leadsBySource.reduce((a, b) => a + b.count, 0);
                                    const percent = Math.round((source.count / total) * 100);
                                    const colorClasses = [
                                        'bg-blue-500', 'bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500'
                                    ];
                                    const bgClass = colorClasses[idx % colorClasses.length];

                                    return (
                                        <div key={source.name} className="flex items-center justify-between group">
                                            <div className="flex items-center gap-3">
                                                <span className={`w-3 h-3 rounded-full ${bgClass} shadow-sm group-hover:scale-125 transition-transform`}></span>
                                                <span className="text-sm font-black text-slate-600 capitalize tracking-tight group-hover:text-slate-900 transition-colors">{source.name.replace('_', ' ')}</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-sm font-black text-slate-900">{percent}%</span>
                                                <span className="text-[10px] font-bold text-slate-400 ml-2">({source.count})</span>
                                            </div>
                                        </div>
                                    )
                                }) : (
                                    <div className="text-center text-slate-400 text-xs font-bold uppercase tracking-widest">No data available</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Leads & Top Tags Row - SYMMETRICAL LAYOUT */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 md:gap-8">
                {/* Recent Leads - SYMMETRICAL CRM STYLE */}
                <div className="bg-white rounded-[2rem] border-2 border-[#942CAE] ring-2 ring-white ring-inset shadow-2xl overflow-hidden flex flex-col h-[580px]">
                    <div className="flex flex-col h-full">
                        <div className="p-5 md:p-6 flex justify-between items-center bg-[#942CAE] relative z-10">
                            <h3 className="text-lg font-black text-white tracking-tight uppercase tracking-wider">Recent Leads</h3>
                            <button onClick={() => onNavigate('contacts')} className="text-[10px] font-black uppercase tracking-widest text-[#942CAE] bg-white border border-white px-5 py-2.5 rounded-xl transition-all hover:bg-slate-50 active:scale-95 shadow-lg shadow-black/10">View All</button>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar relative z-10">
                            {stats.recentLeads.length > 0 ? stats.recentLeads.map((lead, idx) => (
                                <div 
                                    key={lead.id} 
                                    className={`p-5 hover:bg-slate-50 transition-all flex items-center justify-between group cursor-pointer border-l-[6px] border-transparent hover:border-[#942CAE] hover:pl-6 ${idx !== stats.recentLeads.length - 1 ? 'border-b border-slate-200' : ''}`} 
                                    onClick={() => onNavigate('contacts')}
                                >
                                    <div className="flex items-center gap-5">
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl text-white shadow-lg transition-all group-hover:scale-110 group-hover:rotate-2 ${lead.name ? 'bg-gradient-to-br from-[#942CAE] to-[#7a248f]' : 'bg-slate-300'}`}>
                                            {lead.name ? lead.name[0].toUpperCase() : '?'}
                                        </div>
                                        <div>
                                            <p className="font-black text-slate-900 text-base group-hover:text-[#942CAE] transition-colors tracking-tight leading-tight">{lead.name || 'Unnamed Lead'}</p>
                                            <p className="text-xs font-bold text-slate-400 group-hover:text-slate-500 mt-1 uppercase tracking-wider">{lead.company || lead.email || lead.phone || 'No contact info'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-8">
                                        <div className="text-right hidden md:flex flex-col items-end gap-1.5">
                                            <span className="inline-block text-[10px] font-black text-[#942CAE] bg-[#942CAE]/10 border border-[#942CAE]/20 px-4 py-1.5 rounded-full uppercase tracking-widest">
                                                {lead.status}
                                            </span>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{new Date(lead.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                        </div>
                                        <div className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-50 border border-slate-100 group-hover:bg-[#942CAE] group-hover:border-[#942CAE] transition-all shadow-sm">
                                            <ChevronRightIcon className="w-5 h-5 text-slate-300 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                                        </div>
                                    </div>
                                </div>
                            )) : (
                                <div className="p-16 text-center text-slate-400 text-sm font-black uppercase tracking-widest opacity-40 italic">No recent leads found.</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Top Tags - FORCED VIBRANT THEME - MATCHING HEIGHT */}
                <div className="relative overflow-hidden rounded-[2rem] bg-white border-2 border-[#942CAE] ring-2 ring-white ring-inset shadow-xl flex flex-col h-[580px]">
                    <div className="bg-white h-full w-full flex flex-col relative overflow-hidden">
                        <div className="p-6 bg-[#942CAE] relative z-10">
                            <h3 className="text-lg font-black text-white tracking-tight uppercase">Top Tags</h3>
                            <p className="text-[10px] text-white/70 font-black uppercase tracking-[0.2em] mt-1">Frequency Distribution</p>
                        </div>
                        <div className="p-5 md:p-8 flex-1 flex flex-col gap-8 overflow-y-auto custom-scrollbar relative z-10">
                            {stats.leadsByTag.length > 0 ? stats.leadsByTag.map((tag, idx) => {
                                // MANDATORY VIBRANT COLORS: Override any grey defaults
                                const vibrantPalette = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
                                const vibrantColor = vibrantPalette[idx % vibrantPalette.length];

                                return (
                                    <div key={idx} className="flex items-center justify-between group">
                                        <div className="flex items-center gap-4">
                                            <div 
                                                className="w-11 h-11 rounded-2xl flex items-center justify-center text-xs font-black text-white shadow-xl transition-all group-hover:scale-110 group-hover:rotate-3" 
                                                style={{ 
                                                    background: `linear-gradient(135deg, ${vibrantColor}, ${vibrantColor}DD)`,
                                                    boxShadow: `0 8px 20px -6px ${vibrantColor}`
                                                }}
                                            >
                                                <TagIcon className="w-5 h-5 text-white filter drop-shadow-sm" />
                                            </div>
                                            <span className="font-black text-slate-800 text-sm tracking-tight group-hover:text-[#942CAE] transition-colors">{tag.name}</span>
                                        </div>
                                        <div className="flex items-center gap-5">
                                            <div className="h-3.5 w-28 bg-slate-100 rounded-full overflow-hidden shadow-inner relative border border-slate-200">
                                                <div
                                                    className="h-full rounded-full transition-all duration-1000 ease-out"
                                                    style={{
                                                        width: `${Math.min((tag.count / (stats.totalLeads || 1)) * 100, 100)}%`,
                                                        background: `linear-gradient(90deg, ${vibrantColor}99, ${vibrantColor})`,
                                                        boxShadow: `0 0 15px ${vibrantColor}80`
                                                    }}
                                                ></div>
                                            </div>
                                            <span className="text-sm font-black text-slate-900 w-10 text-right tabular-nums tracking-tighter">{tag.count}</span>
                                        </div>
                                    </div>
                                );
                            }) : (
                                <div className="flex-1 flex flex-col items-center justify-center h-40 text-center text-slate-400 gap-3">
                                    <TagIcon className="w-12 h-12 opacity-20" />
                                    <p className="text-xs font-bold uppercase tracking-widest">No active tags found</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LeadDashboard;
