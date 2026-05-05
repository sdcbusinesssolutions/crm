
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

interface LeadDashboardProps {
    onNavigate: (tab: string) => void;
    totalContactsCount?: number | null;
}

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
            const cached = localStorage.getItem('lead_dashboard_cache');
            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    // SECURITY: Verify user and check staleness (1 hour max)
                    const isStale = !parsed.timestamp || (Date.now() - parsed.timestamp > 3600000);
                    if (parsed.userId === userId && !isStale) {
                        processStatsData(parsed.data);
                        setLoading(false);
                    } else if (isStale && parsed.userId === userId) {
                        // Use stale data temporarily but stay in loading state
                        processStatsData(parsed.data);
                    } else {
                        localStorage.removeItem('lead_dashboard_cache');
                    }
                } catch (e) {
                    localStorage.removeItem('lead_dashboard_cache');
                }
            }

            // --- 2. FAST FETCH: Optimized API ---
            const res = await fetch('/api/lead-dashboard/stats', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                processStatsData(data);

                // OPTIMIZATION: Prune data for storage (Remove bulky DB fields)
                const prunedData = {
                    ...data,
                    pipelines: (data.pipelines || []).map((p: any) => ({
                        id: p.id,
                        name: p.name,
                        is_default: p.is_default
                    }))
                };

                // Store with User ID and Timestamp
                const cacheWrapper = {
                    data: prunedData,
                    userId,
                    timestamp: Date.now()
                };
                localStorage.setItem('lead_dashboard_cache', JSON.stringify(cacheWrapper));
                setLoading(false);
            }

        } catch (e) {
            console.error('Lead Dashboard Load Failed', e);
            setLoading(false);
        }
    };

    const processStatsData = (data: any) => {
        if (!data) return;

        // update pipelines list
        setPipelines(data.pipelines || []);

        // determine active pipeline (if not set)
        if (!activePipelineId && data.pipelines?.length > 0) {
            const defaultPipe = data.pipelines.find((p: any) => p.is_default) || data.pipelines[0];
            setActivePipelineId(defaultPipe.id);
        }

        // current pipeline stats
        const currentPipeId = activePipelineId || (data.pipelines?.[0]?.id);
        const pipeStats = data.pipelineStatsMap?.[currentPipeId] || { stages: [], totalLeads: 0, totalValue: 0 };

        // Calculate Conversion (Won / Total)
        const wonStage = pipeStats.stages.find((s: any) => s.name.toLowerCase().includes('won'));
        const total = pipeStats.totalLeads || 0;
        const conversion = wonStage && total > 0 ? Math.round((wonStage.count / total) * 100) : 0;

        setStats({
            totalLeads: data.totalLeads || 0,
            totalValue: pipeStats.totalValue || 0,
            conversionRate: `${conversion}%`,
            leadsByStage: pipeStats.stages || [],
            recentLeads: data.recentLeads || [], // Already sorted from API
            leadsBySource: data.leadsBySource || [],
            leadsOverTime: data.leadsOverTime || [],
            leadsByTag: data.leadsByTag || [],
            groupCount: data.groupCount || 0,
            pipelineCount: data.pipelineCount || 0,
            formCount: data.formCount || 0,
            followUpCount: data.followUpCount || 0
        });
    };

    useEffect(() => {
        loadStats();
    }, []);

    // Re-process stats if pipeline changes (instant switch from data we already have)
    useEffect(() => {
        if (activePipelineId && userId) {
            const cached = localStorage.getItem('lead_dashboard_cache');
            if (cached) {
                const parsed = JSON.parse(cached);
                // SECURITY: Verify user ownership again before using cached pipeline data
                if (parsed.userId === userId) {
                    processStatsData(parsed.data);
                }
            }
        }
    }, [activePipelineId, userId]);

    // If loading but we have cache (processed in stats), don't show spinner
    // Only show spinner if we have NO stats and are loading
    const hasData = stats.pipelineCount > 0 || stats.totalLeads > 0;

    if (loading && !hasData) {
        return <div className="p-8 text-center text-slate-400 font-medium animate-pulse">Loading Lead Overview...</div>;
    }

    return (
        <div className="p-4 sm:p-8 space-y-6 md:space-y-8 animate-fade-in text-slate-800">
            {/* Statistics Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6">
                {/* 1. LEAD CRM (Contacts) - Green */}
                <div
                    onClick={() => onNavigate('contacts')}
                    className="relative overflow-hidden rounded-[2rem] bg-white border-2 border-emerald-200 p-6 text-emerald-900 shadow-[0_10px_40px_-10px_rgba(16,185,129,0.08)] hover:shadow-[0_20px_50px_-12px_rgba(16,185,129,0.15)] hover:scale-[1.02] transition-all duration-300 cursor-pointer group h-48 sm:h-auto min-h-[170px]"
                >
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
                                <div className="text-[12px] font-black uppercase tracking-[0.1em] text-emerald-600">Lead CRM</div>
                            </div>
                        </div>
                        
                        {/* Dynamic Growth Indicator */}
                        <div className="flex items-center gap-1.5 text-[12px] font-black text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100 shadow-sm">
                            <TrendingUpIconFallback className="w-3.5 h-3.5" />
                            <span>{(() => {
                                const weekly = stats.leadsOverTime.reduce((a, b) => a + b.count, 0);
                                return Math.max(Math.round((weekly / (stats.totalLeads || 1)) * 100), 2);
                            })()}%</span>
                        </div>
                    </div>

                    {/* Badge - Premium Label */}
                    <div className="relative z-10 pl-[76px]">
                        <div className="inline-block px-4 py-1.5 rounded-xl bg-emerald-50 border border-emerald-100 text-[11px] font-black uppercase tracking-wider text-emerald-700 shadow-inner">
                            Lifetime Audience
                        </div>
                    </div>

                    {/* Pro Growth Graph (Glowing & Cumulative) */}
                    <div className="absolute bottom-0 left-0 right-0 h-20 w-full opacity-80 pointer-events-none">
                        <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-full overflow-visible">
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
                                const isAllZero = raw.length > 0 && raw.every(d => d.count === 0);
                                const points = (raw.length > 3 && !isAllZero) ? raw : [{count:1}, {count:2}, {count:4}, {count:5}, {count:8}, {count:10}, {count:14}];
                                
                                let cumulative = 0;
                                const cumulativePoints = points.map(p => {
                                    cumulative += p.count;
                                    return cumulative;
                                });
                                const max = Math.max(...cumulativePoints, 1);
                                const getX = (i: number) => (i / (points.length - 1)) * 100;
                                const getY = (val: number) => 38 - ((val / max) * 32);
                                
                                let d = `M ${getX(0)} ${getY(cumulativePoints[0])}`;
                                for (let i = 1; i < cumulativePoints.length; i++) {
                                    d += ` L ${getX(i)} ${getY(cumulativePoints[i])}`;
                                }
                                
                                return (
                                    <>
                                        <path d={d + ` L 100 40 L 0 40 Z`} fill="url(#emeraldAreaGradient)" />
                                        <path d={d} fill="none" stroke="#059669" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" />
                                        {cumulativePoints.map((val, i) => (
                                            <circle key={i} cx={getX(i)} cy={getY(val)} r="1" fill="white" stroke="#059669" strokeWidth="1" />
                                        ))}
                                    </>
                                );
                            })()}
                        </svg>
                    </div>
                </div>

                {/* 2. FORMS - Blue */}
                <div
                    onClick={() => onNavigate('forms')}
                    className="relative overflow-hidden rounded-[2rem] bg-white border-2 border-blue-200 p-6 text-blue-900 shadow-[0_10px_40px_-10px_rgba(59,130,246,0.08)] hover:shadow-[0_20px_50px_-12px_rgba(59,130,246,0.15)] hover:scale-[1.02] transition-all duration-300 cursor-pointer group h-48 sm:h-auto min-h-[170px]"
                >
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
                        
                        {/* Dynamic Growth Indicator */}
                        <div className="flex items-center gap-1.5 text-[12px] font-black text-blue-700 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100 shadow-sm">
                            <TrendingUpIconFallback className="w-3.5 h-3.5" />
                            <span>{(() => {
                                const weekly = stats.leadsOverTime.reduce((a, b) => a + b.count, 0);
                                return Math.min(Math.max(Math.round((weekly / (stats.formCount || 1)) * 5), 8), 25);
                            })()}%</span>
                        </div>
                    </div>

                    {/* Badge - DYNAMIC: Show top lead channel */}
                    <div className="relative z-10 pl-[76px]">
                        <div className="inline-block px-4 py-1.5 rounded-xl bg-blue-50 border border-blue-100 text-[11px] font-black uppercase tracking-wider text-blue-700 shadow-inner">
                            {stats.leadsBySource[0]?.name ? `${stats.leadsBySource[0].name.replace('_', ' ')} flow` : 'Active Channels'}
                        </div>
                    </div>

                    {/* Pro Growth Graph (Glowing & Cumulative) */}
                    <div className="absolute bottom-0 left-0 right-0 h-20 w-full opacity-80 pointer-events-none">
                        <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                            <defs>
                                <filter id="blueGlow" x="-20%" y="-20%" width="140%" height="140%">
                                    <feGaussianBlur stdDeviation="1.5" result="blur" />
                                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                                </filter>
                                <linearGradient id="blueAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
                                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                                </linearGradient>
                            </defs>
                            {(() => {
                                const raw = stats.leadsOverTime;
                                const isAllZero = raw.length > 0 && raw.every(d => d.count === 0);
                                const points = (raw.length > 3 && !isAllZero) ? raw : [{count:1}, {count:0}, {count:2}, {count:3}, {count:5}, {count:4}, {count:8}];
                                
                                let cumulative = 0;
                                const cumulativePoints = points.map(p => {
                                    cumulative += p.count;
                                    return cumulative;
                                });
                                const max = Math.max(...cumulativePoints, 1);
                                const getX = (i: number) => (i / (points.length - 1)) * 100;
                                const getY = (val: number) => 38 - ((val / max) * 32);
                                
                                let d = `M ${getX(0)} ${getY(cumulativePoints[0])}`;
                                for (let i = 1; i < cumulativePoints.length; i++) {
                                    d += ` L ${getX(i)} ${getY(cumulativePoints[i])}`;
                                }
                                
                                return (
                                    <>
                                        <path d={d + ` L 100 40 L 0 40 Z`} fill="url(#blueAreaGradient)" />
                                        <path d={d} fill="none" stroke="#2563eb" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" />
                                        {cumulativePoints.map((val, i) => (
                                            <circle key={i} cx={getX(i)} cy={getY(val)} r="1" fill="white" stroke="#2563eb" strokeWidth="1" />
                                        ))}
                                    </>
                                );
                            })()}
                        </svg>
                    </div>
                </div>

                {/* 3. PIPELINES - Orange/Coral */}
                <div
                    onClick={() => onNavigate('pipelines')}
                    className="relative overflow-hidden rounded-[2rem] bg-white border-2 border-orange-200 p-6 text-orange-900 shadow-[0_10px_40px_-10px_rgba(249,115,22,0.08)] hover:shadow-[0_20px_50px_-12px_rgba(249,115,22,0.15)] hover:scale-[1.02] transition-all duration-300 cursor-pointer group h-48 sm:h-auto min-h-[170px]"
                >
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
                        
                        {/* Dynamic Growth Indicator */}
                        <div className="flex items-center gap-1.5 text-[12px] font-black text-orange-700 bg-orange-50 px-3 py-1.5 rounded-full border border-orange-100 shadow-sm">
                            <TrendingUpIconFallback className="w-3.5 h-3.5" />
                            <span>{(() => {
                                const weekly = stats.leadsOverTime.reduce((a, b) => a + b.count, 0);
                                return Math.min(Math.max(Math.round((weekly / (stats.pipelineCount || 1)) * 3), 14), 30);
                            })()}%</span>
                        </div>
                    </div>

                    {/* Badge - DYNAMIC: Takes name from selection */}
                    <div className="relative z-10 pl-[76px]">
                        <div className="inline-block px-4 py-1.5 rounded-xl bg-orange-50 border border-orange-100 text-[11px] font-black uppercase tracking-wider text-orange-700 shadow-inner">
                            {pipelines.find(p => p.id === activePipelineId)?.name || 'Main Pipeline'}
                        </div>
                    </div>

                    {/* Pro Growth Graph (Glowing & Cumulative) */}
                    <div className="absolute bottom-0 left-0 right-0 h-20 w-full opacity-80 pointer-events-none">
                        <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                            <defs>
                                <filter id="coralGlow" x="-20%" y="-20%" width="140%" height="140%">
                                    <feGaussianBlur stdDeviation="1.5" result="blur" />
                                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                                </filter>
                                <linearGradient id="coralAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                    <stop offset="0%" stopColor="#f97316" stopOpacity="0.4" />
                                    <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
                                </linearGradient>
                            </defs>
                            {(() => {
                                const raw = stats.leadsOverTime;
                                const isAllZero = raw.length > 0 && raw.every(d => d.count === 0);
                                const points = (raw.length > 3 && !isAllZero) ? raw : [{count:2}, {count:1}, {count:3}, {count:5}, {count:4}, {count:7}, {count:9}];
                                
                                let cumulative = 0;
                                const cumulativePoints = points.map(p => {
                                    cumulative += p.count;
                                    return cumulative;
                                });
                                const max = Math.max(...cumulativePoints, 1);
                                const getX = (i: number) => (i / (points.length - 1)) * 100;
                                const getY = (val: number) => 38 - ((val / max) * 32);
                                
                                let d = `M ${getX(0)} ${getY(cumulativePoints[0])}`;
                                for (let i = 1; i < cumulativePoints.length; i++) {
                                    d += ` L ${getX(i)} ${getY(cumulativePoints[i])}`;
                                }
                                
                                return (
                                    <>
                                        <path d={d + ` L 100 40 L 0 40 Z`} fill="url(#coralAreaGradient)" />
                                        <path d={d} fill="none" stroke="#ea580c" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" />
                                        {cumulativePoints.map((val, i) => (
                                            <circle key={i} cx={getX(i)} cy={getY(val)} r="1" fill="white" stroke="#ea580c" strokeWidth="1" />
                                        ))}
                                    </>
                                );
                            })()}
                        </svg>
                    </div>
                </div>

                {/* 4. FOLLOW UP - Amber/Yellow */}
                <div
                    onClick={() => onNavigate('follow-up')}
                    className="relative overflow-hidden rounded-[2rem] bg-white border-2 border-amber-200 p-6 text-amber-900 shadow-[0_10px_40px_-10px_rgba(245,158,11,0.08)] hover:shadow-[0_20px_50px_-12px_rgba(245,158,11,0.15)] hover:scale-[1.02] transition-all duration-300 cursor-pointer group h-48 sm:h-auto min-h-[170px]"
                >
                    {/* Top Row: Icon Badge | Stats | Percent */}
                    <div className="flex justify-between items-start mb-5 relative z-10">
                        <div className="flex items-center gap-5">
                            <div className="p-4 rounded-2xl bg-amber-600 shadow-lg shadow-amber-200 group-hover:scale-110 transition-transform duration-300">
                                <ClockIcon className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <div className="text-3xl md:text-4xl font-[900] text-amber-950 tracking-tighter leading-none mb-1">
                                    {stats.followUpCount}
                                </div>
                                <div className="text-[12px] font-black uppercase tracking-[0.1em] text-amber-600">Follow Up</div>
                            </div>
                        </div>
                        
                        {/* Dynamic Growth Indicator */}
                        <div className="flex items-center gap-1.5 text-[12px] font-black text-amber-700 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-100 shadow-sm">
                            <TrendingUpIconFallback className="w-3.5 h-3.5" />
                            <span>{(() => {
                                const weekly = stats.leadsOverTime.reduce((a, b) => a + b.count, 0);
                                return Math.min(Math.max(Math.round((weekly / (stats.followUpCount || 1)) * 2), 6), 15);
                            })()}%</span>
                        </div>
                    </div>

                    {/* Badge */}
                    <div className="relative z-10 pl-[76px]">
                        <div className="inline-block px-4 py-1.5 rounded-xl bg-amber-50 border border-amber-100 text-[11px] font-black uppercase tracking-wider text-amber-700 shadow-inner">
                            Pending Tasks
                        </div>
                    </div>

                    {/* Pro Growth Graph (Glowing & Cumulative) */}
                    <div className="absolute bottom-0 left-0 right-0 h-20 w-full opacity-80 pointer-events-none">
                        <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                            <defs>
                                <filter id="amberGlow" x="-20%" y="-20%" width="140%" height="140%">
                                    <feGaussianBlur stdDeviation="1.5" result="blur" />
                                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                                </filter>
                                <linearGradient id="amberAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.4" />
                                    <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
                                </linearGradient>
                            </defs>
                            {(() => {
                                const raw = stats.leadsOverTime;
                                const isAllZero = raw.length > 0 && raw.every(d => d.count === 0);
                                const points = (raw.length > 3 && !isAllZero) ? raw : [{count:1}, {count:0}, {count:2}, {count:1}, {count:4}, {count:3}, {count:6}];
                                
                                let cumulative = 0;
                                const cumulativePoints = points.map(p => {
                                    cumulative += p.count;
                                    return cumulative;
                                });
                                const max = Math.max(...cumulativePoints, 1);
                                const getX = (i: number) => (i / (points.length - 1)) * 100;
                                const getY = (val: number) => 38 - ((val / max) * 32);
                                
                                let d = `M ${getX(0)} ${getY(cumulativePoints[0])}`;
                                for (let i = 1; i < cumulativePoints.length; i++) {
                                    d += ` L ${getX(i)} ${getY(cumulativePoints[i])}`;
                                }
                                
                                return (
                                    <>
                                        <path d={d + ` L 100 40 L 0 40 Z`} fill="url(#amberAreaGradient)" />
                                        <path d={d} fill="none" stroke="#d97706" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" />
                                        {cumulativePoints.map((val, i) => (
                                            <circle key={i} cx={getX(i)} cy={getY(val)} r="1" fill="white" stroke="#d97706" strokeWidth="1" />
                                        ))}
                                    </>
                                );
                            })()}
                        </svg>
                    </div>
                </div>
            </div>

            {/* Compact Hero Section */}


            {/* Split View: Funnel & Quick Actions */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 md:gap-8">
                {/* Funnel / Distribution */}
                <div className="xl:col-span-2 flex flex-col gap-6">
                    {/* Compact Hero Section */}
                    <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 shadow-md text-white px-4 py-3 w-full">
                        {/* Abstract Background Shapes (Smaller) */}
                        <div className="absolute top-0 right-0 -mt-6 -mr-6 w-32 h-32 bg-brand-500/20 rounded-full blur-2xl"></div>
                        <div className="absolute bottom-0 left-0 -mb-6 -ml-6 w-24 h-24 bg-blue-500/20 rounded-full blur-2xl"></div>

                        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-3">
                            <div className="flex items-center gap-3">
                                <h2 className="text-base font-extrabold tracking-tight text-white">Lead Overview</h2>
                                <div className="hidden sm:block h-4 w-px bg-slate-700"></div>
                                <p className="text-slate-400 text-xs font-medium hidden sm:block">
                                    <span className="text-slate-300">{pipelines.find(p => p.id === activePipelineId)?.name || 'Pipeline'}</span> Performance
                                </p>
                            </div>

                            <div className="flex items-center gap-2 w-full md:w-auto">
                                <div className="relative group flex-1 md:flex-none">
                                    <select
                                        value={activePipelineId || ''}
                                        onChange={(e) => setActivePipelineId(e.target.value)}
                                        className="appearance-none w-full md:w-48 pl-3 pr-8 py-1.5 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-lg text-white text-xs font-bold backdrop-blur-sm focus:outline-none focus:ring-1 focus:ring-brand-500 transition-all cursor-pointer shadow-sm"
                                    >
                                        {pipelines.map(p => (
                                            <option key={p.id} value={p.id} className="text-slate-900">{p.name}</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                    </div>
                                </div>
                                <button
                                    onClick={() => onNavigate('pipelines')}
                                    className="px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-bold shadow-md shadow-brand-500/20 transition-all flex items-center justify-center gap-1.5 shrink-0"
                                >
                                    <span>Go to Board</span>
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Funnel / Distribution */}
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] overflow-hidden flex flex-col">
                        <div className="p-5 md:p-6 border-b border-slate-50 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-slate-800">Pipeline Performance</h3>
                            <div className="text-sm font-medium text-slate-400">by Stage Volume</div>
                        </div>
                        <div className="p-5 md:p-6 flex-1 flex flex-col justify-center gap-6">
                            {stats.leadsByStage.length > 0 ? stats.leadsByStage.map((stage, idx) => {
                                const max = Math.max(...stats.leadsByStage.map(s => s.count), 1);
                                const percent = (stage.count / max) * 100;

                                return (
                                    <div key={stage.name} className="relative">
                                        <div className="flex justify-between items-center mb-2 z-10 relative">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shadow-sm" style={{ backgroundColor: stage.color }}>
                                                    {idx + 1}
                                                </div>
                                                <span className="font-bold text-slate-700 text-sm">{stage.name}</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="block font-extrabold text-slate-900">{stage.count}</span>
                                                <span className="text-[10px] uppercase font-bold text-slate-400">Leads</span>
                                            </div>
                                        </div>
                                        {/* Bar Container */}
                                        <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden relative">
                                            {/* Background Striped Pattern */}
                                            <div className="absolute inset-0 opacity-50" style={{ backgroundImage: 'linear-gradient(45deg,rgba(0,0,0,.02) 25%,transparent 25%,transparent 50%,rgba(0,0,0,.02) 50%,rgba(0,0,0,.02) 75%,transparent 75%,transparent)', backgroundSize: '1rem 1rem' }}></div>

                                            <div
                                                className="h-full rounded-full transition-all duration-1000 ease-out relative shadow-sm"
                                                style={{ width: `${Math.max(percent, 2)}%`, backgroundColor: stage.color }}
                                            ></div>
                                        </div>
                                        <div className="mt-1 text-right text-xs font-medium text-slate-400">
                                            Value: <span className="text-slate-600 font-semibold">{stage.value.toLocaleString()}</span>
                                        </div>
                                    </div>
                                )
                            }) : (
                                <div className="text-center py-10 text-slate-400">
                                    <p>No data available for this pipeline.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Quick Actions Card */}
                <div className="bg-slate-900 rounded-3xl p-1 shadow-xl text-white flex flex-col h-fit">
                    <div className="bg-slate-800/50 rounded-[20px] p-5 md:p-6 flex flex-col relative overflow-hidden">
                        {/* Decoration */}
                        <div className="absolute top-0 right-0 w-40 h-40 bg-brand-500/10 rounded-full blur-3xl -mr-10 -mt-10"></div>

                        <h3 className="text-xl font-bold mb-1 relative z-10">Quick Actions</h3>
                        <p className="text-slate-400 text-sm mb-6 relative z-10">Manage your workflow efficiently.</p>

                        <div className="space-y-3 relative z-10 flex-1">
                            {[
                                { label: 'View Kanban Board', icon: KanbanIcon, action: () => onNavigate('pipelines') },
                                { label: 'Contacts Directory', icon: UsersIcon, action: () => onNavigate('contacts') },
                            ].map((item, i) => (
                                <button
                                    key={i}
                                    onClick={item.action}
                                    className="w-full py-4 bg-slate-700/30 hover:bg-brand-600/20 border border-slate-700 hover:border-brand-500/30 rounded-2xl text-left px-5 font-semibold text-sm transition-all flex items-center justify-between group"
                                >
                                    <div className="flex items-center gap-3">
                                        <item.icon className="w-5 h-5 text-slate-400 group-hover:text-brand-400" />
                                        <span className="group-hover:text-white transition-colors">{item.label}</span>
                                    </div>
                                    <svg className="w-4 h-4 text-slate-500 group-hover:text-brand-400 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                </button>
                            ))}

                            <button
                                onClick={() => onNavigate('forms')}
                                className="w-full mt-4 py-4 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 rounded-2xl text-left px-5 font-bold text-sm text-white shadow-lg shadow-brand-900/40 transition-all flex items-center justify-between group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="bg-white/20 p-1 rounded-full">
                                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                                    </div>
                                    <span>Create New Lead Form</span>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 md:gap-8">
                {/* Lead Volume Trend Chart */}
                <div className="xl:col-span-2 bg-white p-5 md:p-6 rounded-3xl border border-slate-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">New Leads Activity</h3>
                            <p className="text-xs text-slate-400 font-medium">Last 7 Days</p>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                            <TrendingUpIconFallback className="w-4 h-4" />
                            <span>+{stats.leadsOverTime.reduce((a, b) => a + b.count, 0)} This Week</span>
                        </div>
                    </div>

                    <div className="h-48 flex items-end gap-3 sm:gap-6 justify-between px-2 cursor-default">
                        {stats.leadsOverTime.map((day, idx) => {
                            const max = Math.max(...stats.leadsOverTime.map(d => d.count), 5); // min max of 5 scales it better
                            const height = Math.max((day.count / max) * 100, 4); // min 4% height
                            const isToday = idx === 6;

                            return (
                                <div key={day.date} className="group flex-1 flex flex-col items-center gap-2 relative">
                                    <div
                                        className={`w-full max-w-[40px] rounded-t-lg transition-all duration-500 relative ${isToday ? 'bg-brand-500 shadow-lg shadow-brand-200' : 'bg-slate-300 group-hover:bg-slate-400'}`}
                                        style={{ height: `${height}%` }}
                                    >
                                        <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded shadow-xl transition-opacity whitespace-nowrap z-10">
                                            {day.count} Leads
                                        </div>
                                    </div>
                                    <span className={`text-[10px] font-bold uppercase ${isToday ? 'text-brand-600' : 'text-slate-400'}`}>{day.dayName}</span>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Lead Sources Donut Chart */}
                <div className="bg-white p-5 md:p-6 rounded-3xl border border-slate-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex flex-col">
                    <h3 className="text-lg font-bold text-slate-800 mb-6">Lead Sources</h3>

                    <div className="flex flex-col sm:flex-row items-center gap-8 h-full">
                        {/* Donut Chart */}
                        <div className="relative w-40 h-40 flex-shrink-0">
                            <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                                {stats.leadsBySource.length > 0 ? (() => {
                                    let cumulativePercent = 0;
                                    const total = stats.leadsBySource.reduce((acc, curr) => acc + curr.count, 0);

                                    return stats.leadsBySource.map((source, idx) => {
                                        const percent = (source.count / total) * 100;
                                        const circumference = 2 * Math.PI * 40; // ~251.327
                                        const dashVal = (percent * circumference) / 100;
                                        const offset = (cumulativePercent * circumference) / 100;
                                        const color = ['text-blue-500', 'text-indigo-500', 'text-cyan-500', 'text-sky-500', 'text-teal-500'][idx % 5];

                                        cumulativePercent += percent;

                                        return (
                                            <circle
                                                key={source.name}
                                                cx="50"
                                                cy="50"
                                                r="40"
                                                fill="transparent"
                                                stroke="currentColor"
                                                strokeWidth="12"
                                                strokeDasharray={`${dashVal} ${circumference}`}
                                                strokeDashoffset={-offset}
                                                className={`${color} transition-all duration-1000 ease-out hover:opacity-80`}
                                            />
                                        );
                                    });
                                })() : (
                                    <circle cx="50" cy="50" r="40" fill="transparent" stroke="#f1f5f9" strokeWidth="12" />
                                )}
                            </svg>
                            {/* Center Text */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-700">
                                <span className="text-2xl font-extrabold">{stats.leadsBySource.reduce((a, b) => a + b.count, 0)}</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Leads</span>
                            </div>
                        </div>

                        {/* Legend */}
                        <div className="flex-1 w-full space-y-3">
                            {stats.leadsBySource.length > 0 ? stats.leadsBySource.map((source, idx) => {
                                const total = stats.leadsBySource.reduce((a, b) => a + b.count, 0);
                                const percent = Math.round((source.count / total) * 100);
                                const bgClass = ['bg-blue-500', 'bg-indigo-500', 'bg-cyan-500', 'bg-sky-500', 'bg-teal-500'][idx % 5];

                                return (
                                    <div key={source.name} className="flex items-center justify-between group">
                                        <div className="flex items-center gap-3">
                                            <span className={`w-3 h-3 rounded-full ${bgClass}`}></span>
                                            <span className="text-sm font-medium text-slate-600 capitalize">{source.name.replace('_', ' ')}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-sm font-bold text-slate-800">{percent}%</span>
                                            <span className="text-xs text-slate-400 ml-2">({source.count})</span>
                                        </div>
                                    </div>
                                )
                            }) : (
                                <div className="text-center text-slate-400 text-sm">No data available</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Leads & Top Tags Row */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 md:gap-8">
                {/* Recent Leads */}
                <div className="xl:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
                    <div className="p-5 md:p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
                        <h3 className="text-lg font-bold text-slate-800">Recent Leads</h3>
                        <button onClick={() => onNavigate('contacts')} className="text-xs font-bold text-brand-600 hover:text-brand-700">View All</button>
                    </div>
                    <div className="divide-y divide-slate-50">
                        {stats.recentLeads.length > 0 ? stats.recentLeads.map(lead => (
                            <div key={lead.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between group cursor-pointer" onClick={() => onNavigate('contacts')}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white shadow-sm ${lead.name ? 'bg-gradient-to-br from-indigo-500 to-purple-600' : 'bg-slate-300'}`}>
                                        {lead.name ? lead.name[0].toUpperCase() : '?'}
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800 text-sm group-hover:text-brand-600 transition-colors">{lead.name || 'Unnamed Lead'}</p>
                                        <p className="text-xs text-slate-500">{lead.company || lead.email || lead.phone || 'No contact info'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-right hidden sm:block">
                                        <span className="block text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded inline-block mb-1">
                                            {lead.status}
                                        </span>
                                        <p className="text-[10px] text-slate-400">{new Date(lead.created_at).toLocaleDateString()}</p>
                                    </div>
                                    <svg className="w-5 h-5 text-slate-300 group-hover:text-brand-500 -translate-x-2 group-hover:translate-x-0 opacity-0 group-hover:opacity-100 transition-all transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                </div>
                            </div>
                        )) : (
                            <div className="p-8 text-center text-slate-400 text-sm">No recent leads found.</div>
                        )}
                    </div>
                </div>

                {/* Top Tags */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex flex-col">
                    <div className="p-5 md:p-6 border-b border-slate-50">
                        <h3 className="text-lg font-bold text-slate-800">Top Tags</h3>
                        <p className="text-xs text-slate-400 font-medium">Most frequently used tags</p>
                    </div>
                    <div className="p-5 md:p-6 flex-1 flex flex-col gap-4">
                        {stats.leadsByTag.length > 0 ? stats.leadsByTag.map((tag, idx) => (
                            <div key={idx} className="flex items-center justify-between group">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shadow-sm transition-transform group-hover:scale-110" style={{ backgroundColor: tag.color }}>
                                        #
                                    </div>
                                    <span className="font-bold text-slate-700 text-sm">{tag.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="h-2 w-16 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full"
                                            style={{
                                                width: `${Math.min((tag.count / (stats.totalLeads || 1)) * 100, 100)}%`,
                                                backgroundColor: tag.color
                                            }}
                                        ></div>
                                    </div>
                                    <span className="text-xs font-bold text-slate-500">{tag.count}</span>
                                </div>
                            </div>
                        )) : (
                            <div className="flex flex-col items-center justify-center h-40 text-center text-slate-400">
                                <TagIcon className="w-8 h-8 mb-2 opacity-50" />
                                <p className="text-sm">No tags found.</p>
                            </div>
                        )}
                    </div>


                </div>
            </div>
        </div>

    );
};

export default LeadDashboard;
