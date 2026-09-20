import React, { useState, useEffect } from 'react';
import { MenuItem } from './Sidebar';
import { DashboardStats } from './Dashboard';

// --- Icons ---
const Icons = {
    // Exact "Database + User" Icon from Reference (Detailed)
    ServerUserGroup: () => (
        <svg viewBox="0 0 42 40" className="w-20 h-16 overflow-visible">
            {/* Database Stack (Left) */}
            <g transform="translate(0, 4)">
                <rect x="2" y="0" width="10" height="8" rx="2" fill="#84cc16" stroke="#334155" strokeWidth="1.5" />
                <rect x="2" y="11" width="10" height="8" rx="2" fill="#84cc16" stroke="#334155" strokeWidth="1.5" />
                <rect x="2" y="22" width="10" height="8" rx="2" fill="#84cc16" stroke="#334155" strokeWidth="1.5" />
            </g>

            {/* Curly Bracket (Middle) */}
            <path d="M15 8 C 18 8, 18 10, 18 14 V 15 C 18 18, 20 19, 22 19 C 20 19, 18 20, 18 23 V 24 C 18 28, 18 30, 15 30"
                fill="none" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" />

            {/* User Figure (Right) */}
            <g transform="translate(28, 4)">
                {/* Head */}
                <circle cx="7" cy="5" r="3.5" fill="#84cc16" stroke="#334155" strokeWidth="1.5" />
                {/* Body - Simple Rounded Shoulder Outline */}
                <path d="M1 21 V 13 C 1 9 4 7 7 7 C 10 7 13 9 13 13 V 21" fill="none" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" />
                {/* Legs/Base - Just vertical lines? Ref shows simple standing figure */}
                <line x1="4.5" y1="21" x2="4.5" y2="30" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="9.5" y1="21" x2="9.5" y2="30" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" />
            </g>
        </svg>
    ),
    Chart: ({ className }: { className?: string }) => <svg className={className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>,
    Users: ({ className, style }: { className?: string; style?: React.CSSProperties }) => <svg className={className || "w-5 h-5"} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
    User: ({ className, style }: { className?: string; style?: React.CSSProperties }) => <svg className={className || "w-5 h-5"} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
    MoreVerticalIcon: ({ className }: { className?: string }) => <svg className={className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>,

    // Stats Icons (Dark Outline inside Green Circle)
    Search: () => <svg className="w-5 h-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /><circle cx="10" cy="10" r="3" fill="currentColor" className="text-slate-700 opacity-20" /></svg>,
    Network: () => <svg className="w-5 h-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><circle cx="12" cy="7" r="3" /><circle cx="7" cy="17" r="3" /><circle cx="17" cy="17" r="3" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v4 m-2 2l-2-2 m8 0l-2 2" /></svg>,
    Roles: () => <svg className="w-5 h-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><circle cx="12" cy="12" r="3" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.4 15a1.65 1.65 0 00 .33 1.82l.06.06a2 2 0 01 0 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 00 9 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 01 0 2.83l.06.06a1.65 1.65 0 00 .33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 01 2-2h.09A1.65 1.65 0 00 4.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 01 0-2.83 2 2 0 01 2.83 0l.06.06a1.65 1.65 0 00 1.82.33H9a1.65 1.65 0 00 1.51-1V3a2 2 0 01 2-2 2 2 0 01 2 2v.09a1.65 1.65 0 00 1 1.51 1.65 1.65 0 00 1.82-.33l.06-.06a2 2 0 01 2.83 0 2 2 0 01 0 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 00 1.51 1H21a2 2 0 01 2 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" /></svg>,
    Selected: () => <svg className="w-5 h-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" /></svg>,
    // New Icons for Dynamic Stats
    Template: ({ className }: { className?: string }) => <svg className={className || "w-6 h-6"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>,
    Flow: ({ className }: { className?: string }) => <svg className={className || "w-6 h-6"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
    Campaign: ({ className }: { className?: string }) => <svg className={className || "w-6 h-6"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>,
    Pipeline: ({ className }: { className?: string }) => <svg className={className || "w-6 h-6"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" /></svg>,
    // New Icons for Categories
    Group: ({ className }: { className?: string }) => <svg className={className || "w-4 h-4"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
    Tag: ({ className }: { className?: string }) => <svg className={className || "w-4 h-4"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 8V3h4z" /></svg>,
    Globe: ({ className }: { className?: string }) => <svg className={className || "w-4 h-4"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>,
    ArrowRight: ({ className }: { className?: string }) => <svg className={className || "w-4 h-4"} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>,
    Bot: ({ className }: { className?: string }) => <svg className={className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
};


const CRMPerformanceHub: React.FC<{ stats: DashboardStats | null; onNavigate: (item: MenuItem) => void }> = ({ stats, onNavigate }) => {
    // --- Data - Use real stats from props. Fallback to 0 (no mocks) ---
    const totalLeads = stats?.summary.totalContacts || 0;
    const activeLeads = stats?.summary.activeLeads || 0;
    const inactiveLeads = totalLeads - activeLeads; // ~1900

    const [isGaugeHovered, setIsGaugeHovered] = useState(false);

    // Dynamic Stats for Bottom Grid
    const totalTemplates = stats?.summary.totalTemplates || 0;
    const totalFlows = stats?.summary.totalFlows || 0;
    const totalCampaigns = stats?.summary.totalCampaigns || 0;
    const totalPipelines = stats?.summary.totalPipelines || 0;

    // Funnel Data - Dynamic Calculations
    let warmCount = 0;
    let hotCount = 0;
    let wonLostCount = 0;

    if (stats?.pipelineStats) {
        stats.pipelineStats.forEach(pipeline => {
            pipeline.stages.forEach(stage => {
                const name = stage.name.toLowerCase();
                if (name.includes('contacted') || name.includes('follow') || name.includes('warm')) warmCount += stage.count;
                if (name.includes('qualified') || name.includes('proposal') || name.includes('hot')) hotCount += stage.count;
                if (name.includes('closed') || name.includes('won') || name.includes('lost')) wonLostCount += stage.count;
            });
        });
    }

    // Fallback if no pipeline data (e.g. initial load)
    if (warmCount === 0 && stats?.taskStats) warmCount = stats.taskStats.due;

    // Helper for proper percentage calculation with precision
    const calculatePercentNum = (val: number, total: number) => {
        if (total === 0) return 0;
        return (val / total) * 100;
    };

    const formatPercent = (val: number, total: number) => {
        if (total === 0) return '0';
        const p = (val / total) * 100;
        if (p === 0) return '0';
        if (p < 0.1) return p.toFixed(2);
        if (p < 1) return p.toFixed(1);
        return Math.round(p).toString();
    };

    // Funnel Steps Mapping
    const funnelSteps = [
        { label: 'Leads:', value: totalLeads },
        { label: 'Active:', value: activeLeads },
        { label: 'Warm:', value: warmCount },
        { label: 'Won / Lost:', value: wonLostCount }
    ];

    // Calculate Percentages for side markers (Reference Style)
    // For Leads, show percentage of goal (1500), capped at 100%
    const leadsGoal = 1500;
    const leadsPercentRaw = Math.min(calculatePercentNum(totalLeads, leadsGoal), 100);
    const leadsPercent = leadsPercentRaw < 100 ? formatPercent(totalLeads, leadsGoal) : "100";

    // For sub-stages, show percentage of total leads with better precision
    const activePercent = formatPercent(activeLeads, totalLeads);
    const warmPercent = formatPercent(warmCount, totalLeads);
    const wonLostPercent = formatPercent(wonLostCount, totalLeads);

    // Forecast Data - Dynamic Pipeline Value
    const pipelineValRaw = stats?.summary.pipelineValue || 0;
    const forecastTarget = 10000000; // Example Target: 1 Crore
    const forecastPercentRaw = Math.min(calculatePercentNum(pipelineValRaw, forecastTarget), 100);
    const forecastPercentDisplay = forecastPercentRaw < 100 ? formatPercent(pipelineValRaw, forecastTarget) : "100";

    const formatINR = (val: number) => {
        if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
        if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
        if (val >= 1000) return `₹${(val / 1000).toFixed(1)}k`;
        return `₹${val}`;
    };

    const forecastDisplayVal = formatINR(pipelineValRaw);

    // Animation Effect
    const [displayedPercent, setDisplayedPercent] = useState(0);
    const [animatedFollowupWidths, setAnimatedFollowupWidths] = useState<number[]>([0, 0, 0, 0]);
        const [breathingOffset, setBreathingOffset] = useState(0);

    // Breathing Animation Loop
    useEffect(() => {
        const interval = setInterval(() => {
            setBreathingOffset(prev => (prev === 0 ? 5 : 0)); // Move 5 degrees then back
        }, 1500);
        return () => clearInterval(interval);
    }, []);

    // Followup Data for Right Panel
    const overdueTotal = stats?.taskStats?.overdue || stats?.taskStats?.breakdown?.overdue?.total || 0;
    const upcomingTotal = Math.max(0, (stats?.taskStats?.due || 0) - (stats?.taskStats?.today || 0) - overdueTotal);
    const followupData = [
        { label: 'TODAY', val: stats?.taskStats?.today || 0, color: '#facc15' }, // Yellow
        { label: 'NEXT', val: upcomingTotal, color: '#3b82f6' }, // Blue
        { label: 'LATE', val: overdueTotal, color: '#ef4444' }, // Red
        { label: 'DONE', val: stats?.taskStats?.completed || 1, color: '#22c55e' }  // Green
    ];

    // Calculate max value for scaling widths
    const maxFollowupVal = Math.max(...followupData.map(d => d.val), 1);

    useEffect(() => {
        // Delay to allow start-at-zero animation on mount
        const timer = setTimeout(() => {
            setDisplayedPercent(forecastPercentRaw);

            // Animate widths for followup bars
            setAnimatedFollowupWidths(followupData.map(d => (d.val / maxFollowupVal) * 100));
        }, 100);

        return () => clearTimeout(timer);
    }, [forecastPercentRaw, stats]); // Recalculate when stats update


    // Category Data for Bottom Right Card
    const categoryData: { label: string; val: number; icon: React.ReactNode; target: MenuItem }[] = [
        { label: 'Groups', val: stats?.summary.totalGroups || 0, icon: <Icons.Group className="w-4 h-4 text-blue-500" />, target: 'Contact Groups' },
        { label: 'Tags', val: 0, icon: <Icons.Tag className="w-4 h-4 text-purple-500" />, target: 'Tags' }, // Placeholder for now
        { label: 'Form Builder', val: stats?.summary.totalFlows || 0, icon: <Icons.Flow className="w-4 h-4 text-orange-500" />, target: 'Form Builder' },
        { label: 'WhatsForm', val: stats?.integrationStats?.breakdown?.['whatsform'] || 0, icon: <Icons.Globe className="w-4 h-4 text-green-500" />, target: 'Whatsapp Forms' },
        { label: 'Sheet Automation', val: stats?.integrationStats?.breakdown?.['google'] || 0, icon: <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18m-9-4v8m-7.5-4h15M3 6a2 2 0 012-2h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6z" /></svg>, target: 'G Automation' }
    ];

    return (
        <div className="w-full h-full border-2 border-blue-600 rounded-[24px] p-4 shadow-sm font-sans flex flex-col" style={{ backgroundColor: '#f8fafc', backgroundImage: 'radial-gradient(circle at top right, #ffffff, #f1f5f9)' }}>
            {/* Header */}
            <div className="w-full flex justify-center items-center gap-3 pb-2 relative">
                <h2 className="text-lg font-black tracking-wide uppercase flex items-center gap-2" style={{ color: '#07523d' }}>
                    Lead Pipeline Automation CRM
                </h2>
                            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr_2.2fr] gap-4 h-full">

                {/* COL 1: Donuts - THICK Rings (Restored per Ref) */}
                <div className="flex flex-col gap-4 h-full">
                    {/* Leads (Total) */}
                    <div
                        className="flex-1 border border-[#84cc16] rounded-lg p-3 flex flex-col relative cursor-pointer hover:shadow-md transition-all active:scale-[0.98] backdrop-blur-md"
                        style={{ backgroundColor: '#1e3a8a08' }}
                    >
                        <div className="w-full flex justify-between items-center mb-1">
                            <h3 className="font-bold text-slate-800 text-[11px]">Leads</h3>
                            <div className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full border border-blue-900 bg-[#84cc16]"></span>
                                <span className="w-6 h-[1px] bg-slate-200"></span>
                            </div>
                        </div>
                        <div className="flex-1 flex items-center justify-center">
                            <DonutRing
                                value={totalLeads}
                                target={1500}
                                color="#1e3a8a" // Navy
                                trackColor="#2563eb" // Blue-600 solid - Darker
                                label=""
                                icon="group"
                                knobColor="#1e3a8a"
                                knobBg="#84cc16"
                                size={135}
                                valueClassName="animate-soft-blink"
                            />
                        </div>
                    </div>

                    {/* Won / Lost */}
                    <div
                        onClick={() => onNavigate('Follow-up')}
                        className="flex-1 border border-[#84cc16] rounded-lg p-3 flex flex-col relative cursor-pointer hover:shadow-md transition-all active:scale-[0.98] backdrop-blur-md"
                        style={{ backgroundColor: '#84cc1608' }}
                    >
                        {/* Header */}
                        <div className="w-full flex justify-between items-center mb-1">
                            <h3 className="font-bold text-slate-800 text-[11px]">Follow up</h3>
                            <div className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full border border-lime-500 bg-[#1e3a8a]"></span>
                                <span className="w-6 h-[1px] bg-slate-200"></span>
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col items-center justify-between py-1 px-1">
                            {/* Center: Pending Donut */}
                            <div className="flex items-center justify-center mt-1">
                                <DonutRing
                                    value={followupData[3].val}
                                    target={100}
                                    color="#84cc16"
                                    trackColor="#84cc16"
                                    label=""
                                    icon=""
                                    knobColor="#84cc16"
                                    knobBg="#84cc16"
                                    size={135}
                                    valueClassName="text-3xl"
                                />
                            </div>

                            {/* Bottom: Stats Rows */}
                            <div className="w-full flex flex-col gap-1.5 mt-2">
                                {/* Row 1: Today & Upcoming */}
                                <div className="flex items-center justify-between px-1">
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: followupData[0].color }}></span>
                                        <span className="text-[9px] font-bold text-slate-500 uppercase">DUE TODAY</span>
                                        <span className="text-[10px] font-black text-slate-800">{followupData[0].val}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: followupData[1].color }}></span>
                                        <span className="text-[9px] font-bold text-slate-500 uppercase">UPCOMING</span>
                                        <span className="text-[10px] font-black text-slate-800">{followupData[1].val}</span>
                                    </div>
                                </div>
                                {/* Row 2: Overdue & Completed */}
                                <div className="flex items-center justify-between px-1">
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: followupData[2].color }}></span>
                                        <span className="text-[9px] font-bold text-slate-500 uppercase">OVERDUE</span>
                                        <span className="text-[10px] font-black text-slate-800">{followupData[2].val}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: followupData[3].color }}></span>
                                        <span className="text-[9px] font-bold text-slate-500 uppercase">COMPLETED</span>
                                        <span className="text-[10px] font-black text-slate-800">{followupData[3].val}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* COL 2: 3D Funnel - Boxed & Centered */}
                <div
                    onClick={() => onNavigate('Contacts')}
                    className="border border-[#84cc16] rounded-lg relative flex flex-col items-center justify-center p-2 h-full cursor-pointer hover:shadow-md transition-all active:scale-[0.98] backdrop-blur-md"
                    style={{ backgroundColor: '#17255408' }}
                >
                    {/* Header */}
                    <div className="absolute top-1 w-full flex flex-col items-center z-20">
                        {/* Title */}
                        <div className="w-full flex items-center justify-center gap-2 mb-0">
                            <div className="w-1.5 h-1.5 rounded-full border border-[#84cc16] bg-white"></div>
                            <h3 className="font-black text-[#1e293b] text-[13px] tracking-wide">Lead CRM Pipeline</h3>
                        </div>

                        {/* Branching Line SVG & Labels - Perfectly Aligned */}
                        <div className="w-[85%] h-[42px] relative mt-[-2px]">
                            <svg viewBox="0 0 300 42" className="w-full h-full overflow-visible">
                                <style>
                                    {`
                                        @keyframes flowOutLight {
                                            to { stroke-dashoffset: -16; }
                                        }
                                        .animate-flow-out-light {
                                            animation: flowOutLight 1.5s linear infinite;
                                        }
                                    `}
                                </style>

                                {/* Base Faint Track */}
                                <path
                                    d="M150,0 L150,10 M150,10 L40,10 M150,10 L260,10 M40,10 L40,20 M150,10 L150,20 M260,10 L260,20"
                                    fill="none"
                                    stroke="#e2e8f0"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                />

                                {/* Center Stem (Starts the flow) */}
                                <path d="M150,0 L150,10" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 5" className="animate-flow-out-light" />

                                {/* Left Branch (Engaged) - Indigo Flow */}
                                <path d="M150,10 L40,10 M40,10 L40,20" fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 5" className="animate-flow-out-light" />

                                {/* Center Branch (FollowUp) - Teal Flow */}
                                <path d="M150,10 L150,20" fill="none" stroke="#14b8a6" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 5" className="animate-flow-out-light" />

                                {/* Right Branch (Automation) - Rose Flow */}
                                <path d="M150,10 L260,10 M260,10 L260,20" fill="none" stroke="#f43f5e" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 5" className="animate-flow-out-light" />
                                {/* Labels and Icons positioned precisely beneath the downward strokes */}
                                <foreignObject x="0" y="20" width="300" height="40">
                                    <div className="w-full h-full flex items-center justify-between px-2 pt-1">
                                        {/* Engaged Section */}
                                        <div className="flex items-center gap-1.5 min-w-[70px] justify-center">
                                            <div className="w-7 h-7 rounded-full bg-[#84cc16] flex items-center justify-center border border-[#84cc16] ring-1 ring-slate-900 shadow-sm shrink-0">
                                                <Icons.Users className="w-4 h-4 text-white" />
                                            </div>
                                            <span className="text-sm font-bold text-[#0f172a] tracking-tight">Engaged</span>
                                        </div>

                                        {/* Arrow 1 */}
                                        <div className="flex items-center justify-center opacity-40">
                                            <Icons.ArrowRight className="w-3 h-3 text-slate-400" />
                                        </div>

                                        {/* FollowUp Section */}
                                        <div className="flex items-center gap-1.5 min-w-[70px] justify-center">
                                            <div className="w-7 h-7 rounded-full bg-[#84cc16] flex items-center justify-center border border-[#84cc16] ring-1 ring-slate-900 shadow-sm shrink-0">
                                                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                                </svg>
                                            </div>
                                            <span className="text-sm font-bold text-[#0f172a] tracking-tight">FollowUp</span>
                                        </div>

                                        {/* Arrow 2 */}
                                        <div className="flex items-center justify-center opacity-40">
                                            <Icons.ArrowRight className="w-3 h-3 text-slate-400" />
                                        </div>

                                        {/* Automation Section */}
                                        <div className="flex items-center gap-1.5 min-w-[70px] justify-center">
                                            <div className="w-7 h-7 rounded-full bg-[#84cc16] flex items-center justify-center border border-[#84cc16] ring-1 ring-slate-900 shadow-sm shrink-0">
                                                <Icons.Bot className="w-4 h-4 text-white" />
                                            </div>
                                            <span className="text-sm font-bold text-[#0f172a] tracking-tight">Automation</span>
                                        </div>
                                    </div>
                                </foreignObject>
                            </svg>
                        </div>
                    </div>

                    {/* Funnel Container - Centered */}
                    <div className="w-full relative h-[340px] flex justify-center scale-[0.85] mt-12">

                        {/* 1. Top Icon - Centered in 'Middle of Circle' */}
                        <div className="absolute top-[-14px] left-1/2 -translate-x-1/2 z-20">
                            <Icons.ServerUserGroup />
                        </div>

                        {/* 2. Top Disc */}
                        <div className="w-[300px] h-[50px] absolute top-[26px] z-10">
                            <svg viewBox="0 0 300 50" className="w-full h-full drop-shadow-md overflow-visible">
                                <ellipse cx="150" cy="25" rx="148" ry="24" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1" />
                                {/* Rotating Dashed Border Overlay */}
                                <ellipse
                                    cx="150" cy="25" rx="148" ry="24"
                                    fill="none"
                                    stroke="#84cc16"
                                    strokeWidth="4"
                                    strokeDasharray="20 20"
                                    strokeLinecap="round"
                                    className="animate-stroke-spin"
                                />
                                {/* Red Dashes Interspersed */}
                                <ellipse
                                    cx="150" cy="25" rx="148" ry="24"
                                    fill="none"
                                    stroke="#ef4444"
                                    strokeWidth="4"
                                    strokeDasharray="20 20"
                                    strokeDashoffset="20"
                                    strokeLinecap="round"
                                    className="animate-stroke-spin"
                                />
                                <ellipse cx="150" cy="25" rx="110" ry="14" fill="#334155" /> {/* Dark Hole */}
                            </svg>
                        </div>

                        {/* 3. Funnel Body */}
                        <div className="w-[300px] h-[340px] absolute top-[48px] z-0 filter drop-shadow-xl">
                            {/* KEY FIX: viewBox reverted to 0 0 300 340 to prevent the massive gap caused by vertical centering of a wider SVG */}
                            <svg viewBox="0 0 300 340" className="w-full h-full overflow-visible">
                                <defs>
                                    <marker id="arrowhead-blue" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                                        <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
                                    </marker>
                                </defs>

                                {/* Level 1: Navy Blue */}
                                <path d="M0,0 L300,0 L260,86 L40,86 Z" fill="#172554" stroke="white" strokeWidth="2" />
                                <text x="150" y="48" textAnchor="middle" fill="white" className="text-sm font-bold tracking-wider">Leads</text>
                                <text x="150" y="78" textAnchor="middle" fill="white" className="text-2xl font-black animate-soft-blink">{Number(funnelSteps[0].value).toLocaleString()}</text>

                                {/* Level 2: Lime Green */}
                                <path d="M40,86 L260,86 L226,172 L74,172 Z" fill="#84cc16" stroke="white" strokeWidth="2" />
                                <text x="150" y="117" textAnchor="middle" fill="white" className="text-sm font-bold tracking-wider">Active</text>
                                <text x="150" y="147" textAnchor="middle" fill="white" className="text-2xl font-black">{funnelSteps[1].value}</text>

                                {/* Level 3: Navy Blue */}
                                <path d="M74,172 L226,172 L200,258 L100,258 Z" fill="#172554" stroke="white" strokeWidth="2" />
                                <text x="150" y="202" textAnchor="middle" fill="white" className="text-sm font-bold tracking-wider">Warm</text>
                                <text x="150" y="232" textAnchor="middle" fill="white" className="text-2xl font-black">{funnelSteps[2].value}</text>

                                {/* Level 4: Lime Green (Rounded Cup Bottom) */}
                                <path d="M100,258 L200,258 L195,300 Q150,340 105,300 L100,258 Z" fill="#84cc16" stroke="white" strokeWidth="2" />
                                <text x="150" y="285" textAnchor="middle" fill="white" className="text-sm font-bold tracking-wider">Won / Lost</text>
                                <text x="150" y="310" textAnchor="middle" fill="white" className="text-2xl font-black">{funnelSteps[3].value}</text>

                                {/* --- Side Percentage Markers (Tightly aligned to prevent bleeding) --- */}
                                {/* Row 1 Marker (Right) - Royal Blue */}
                                <g className="opacity-0 animate-slide-in-right" style={{ animationDelay: '600ms', animationFillMode: 'forwards' }}>
                                    <circle cx="303" cy="72" r="21" fill="#eff6ff" stroke="#1e3a8a" strokeWidth="1.5" className="drop-shadow-sm" />
                                    <text x="303" y="76" textAnchor="middle" className="text-[11px] font-black fill-[#1e3a8a]">{leadsPercent}%</text>
                                    <text x="285" y="105" textAnchor="middle" className="text-sm font-bold fill-[#0f172a] tracking-tight">Awareness</text>
                                    <line x1="282" y1="72" x2="272" y2="72" stroke="#1e3a8a" strokeWidth="1" strokeDasharray="2 2" />
                                    <path d="M266,72 L272,69 L272,75 Z" fill="#1e3a8a" />
                                </g>

                                {/* Row 2 Marker (Left) - Green */}
                                <g className="opacity-0 animate-slide-in-left" style={{ animationDelay: '800ms', animationFillMode: 'forwards' }}>
                                    <circle cx="20" cy="129" r="21" fill="#f0fdf4" stroke="#84cc16" strokeWidth="1.5" className="drop-shadow-sm" />
                                    <text x="20" y="133" textAnchor="middle" className="text-[11px] font-black fill-[#166534]">{activePercent}%</text>
                                    <text x="20" y="162" textAnchor="middle" className="text-sm font-bold fill-[#0f172a] tracking-tight">Interested</text>
                                    <line x1="41" y1="129" x2="51" y2="129" stroke="#84cc16" strokeWidth="1" strokeDasharray="2 2" />
                                    <path d="M57,129 L51,126 L51,132 Z" fill="#84cc16" />
                                </g>

                                {/* Row 3 Marker (Right) - Orange */}
                                <g className="opacity-0 animate-slide-in-right" style={{ animationDelay: '1000ms', animationFillMode: 'forwards' }}>
                                    <circle cx="250" cy="215" r="21" fill="#fffaf2" stroke="#f97316" strokeWidth="1.5" className="drop-shadow-sm" />
                                    <text x="250" y="219" textAnchor="middle" className="text-[11px] font-black fill-[#9a3412]">{warmPercent}%</text>
                                    <text x="250" y="248" textAnchor="middle" className="text-sm font-bold fill-[#0f172a] tracking-tight">Connect</text>
                                    <line x1="229" y1="215" x2="219" y2="215" stroke="#f97316" strokeWidth="1" strokeDasharray="2 2" />
                                    <path d="M213,215 L219,212 L219,218 Z" fill="#f97316" />
                                </g>

                                {/* Row 4 Marker (Left) - Sky Blue */}
                                <g className="opacity-0 animate-slide-in-left" style={{ animationDelay: '1200ms', animationFillMode: 'forwards' }}>
                                    <circle cx="67" cy="300" r="21" fill="#f0f9ff" stroke="#3b82f6" strokeWidth="1.5" className="drop-shadow-sm" />
                                    <text x="67" y="304" textAnchor="middle" className="text-[11px] font-black fill-[#075985]">{wonLostPercent}%</text>
                                    <line x1="88" y1="300" x2="98" y2="300" stroke="#3b82f6" strokeWidth="1" strokeDasharray="2 2" />
                                    <path d="M104,300 L98,297 L98,303 Z" fill="#3b82f6" />
                                </g>
                            </svg>
                        </div>

                    </div>
                </div>

                {/* COL 3: Right Panel (Merged) */}
                <div className="flex flex-col gap-2 h-full pt-1">

                    {/* Top Row: Forecast + Bar Chart */}
                    <div className="flex gap-4 h-[180px]">
                        {/* Forecast Gauge - Card Style */}
                        <div
                            onClick={() => onNavigate('Pipelines')}
                            onMouseEnter={() => setIsGaugeHovered(true)}
                            onMouseLeave={() => setIsGaugeHovered(false)}
                            className="w-[45%] flex flex-col items-center border border-[#84cc16] rounded-lg p-3 relative cursor-pointer hover:shadow-md transition-all active:scale-[0.98] group backdrop-blur-md"
                            style={{ backgroundColor: '#ffffff0d' }}
                        >
                            <div className="w-full flex justify-between items-start mb-0.5">
                                <h3 className="font-bold text-slate-800 text-[11px] leading-tight max-w-[120px]">Pipeline Value Sales Forecast</h3>
                                <Icons.MoreVerticalIcon className="w-3 h-3 text-slate-400" />
                            </div>

                            <div className="w-full flex-1 flex flex-col items-center justify-end relative">
                                <svg viewBox="0 0 200 105" className="w-full overflow-visible max-h-[80px]">
                                    {/* Defs for Gradient Arc */}
                                    <defs>
                                        <linearGradient id="gaugeGradient" x1="0" y1="0" x2="1" y2="0">
                                            <stop offset="0%" stopColor="#dc2626" /> {/* Red */}
                                            <stop offset="40%" stopColor="#f97316" /> {/* Orange */}
                                            <stop offset="100%" stopColor="#10b981" /> {/* Green */}
                                        </linearGradient>
                                    </defs>
                                    {/* Track Background with subtle border */}
                                    <path 
                                        d="M20,100 A80,80 0 0,1 180,100" 
                                        fill="none" 
                                        stroke="#f1f5f9" 
                                        strokeWidth="20" 
                                        strokeLinecap="round" 
                                    />
                                    <path 
                                        d="M20,100 A80,80 0 0,1 180,100" 
                                        fill="none" 
                                        stroke="#e2e8f0" 
                                        strokeWidth="22" 
                                        strokeLinecap="round" 
                                        className="opacity-50"
                                    />
                                    {/* Value Arc */}
                                    <path d="M20,100 A80,80 0 0,1 180,100" fill="none" stroke="url(#gaugeGradient)" strokeWidth="20" strokeLinecap="round" />

                                    {/* Labels - Positioned Inside the Arc for Clarity */}
                                    <text x="20" y="115" className="text-[8px] fill-slate-500 font-extrabold" textAnchor="middle">0</text>
                                    <text x="180" y="115" className="text-[8px] fill-slate-500 font-extrabold" textAnchor="middle">{formatINR(forecastTarget)}</text>

                                    {/* Inner Labels */}
                                    <text x="60" y="72" className="text-[7px] fill-slate-600 font-black" textAnchor="middle">{formatINR(forecastTarget * 0.25)}</text>
                                    <text x="100" y="55" className="text-[7px] fill-slate-600 font-black" textAnchor="middle">{formatINR(forecastTarget * 0.5)}</text>
                                    <text x="140" y="72" className="text-[7px] fill-slate-600 font-black" textAnchor="middle">{formatINR(forecastTarget * 0.75)}</text>

                                    {/* Needle with Border for Clarity */}
                                    <path
                                        d="M100 100 L100 35"
                                        stroke="#1e293b"
                                        strokeWidth="4"
                                        strokeLinecap="round"
                                        transform={`rotate(${((isGaugeHovered ? Math.min(displayedPercent + 10, 100) : displayedPercent) * 1.8 - 90) + breathingOffset}, 100, 100)`}
                                        style={{ transition: 'transform 1s ease-in-out' }}
                                    />
                                    <circle cx="100" cy="100" r="7" fill="#1e293b" stroke="#ffffff" strokeWidth="2" />
                                </svg>

                                <div className="text-center mt-1 z-10">
                                    <div className="text-lg font-black text-[#0f172a] leading-none">
                                        {forecastDisplayVal}
                                    </div>
                                    <div className="text-[9px] font-bold text-slate-500 mt-0.5">
                                        ({forecastPercentDisplay}% of Goal)
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Bar Chart - Card Style */}
                        <div
                            onClick={() => onNavigate('Follow-up')}
                            className="w-[55%] flex flex-col h-full border border-[#84cc16] rounded-lg p-3 cursor-pointer hover:shadow-md transition-all active:scale-[0.98] backdrop-blur-md"
                            style={{ backgroundColor: '#84cc1608' }}
                        >
                            <div className="flex items-center gap-1 mb-1">
                                <div className="w-1.5 h-1.5 rounded-full border border-[#84cc16] bg-white"></div>
                                <h3 className="font-bold text-slate-800 text-[11px]">Followup Status</h3>
                            </div>
                            <div className="flex-1 flex flex-col justify-around gap-1 mt-1">
                                {followupData.map((d, i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <div className="w-12 text-left text-[10px] font-black text-slate-700 tracking-wide">{d.label}</div>
                                        <div className="flex-1 h-3 bg-slate-200 rounded-full relative overflow-hidden border border-slate-300/30 shadow-inner">
                                            {/* Progress with gradient effect */}
                                            <div
                                                className="absolute left-0 top-0 h-full rounded-full transition-all duration-1000 ease-out"
                                                style={{
                                                    width: `${animatedFollowupWidths[i] || 0}%`,
                                                    backgroundColor: d.color,
                                                    boxShadow: '0 0 10px rgba(0,0,0,0.1) inset'
                                                }}
                                            ></div>
                                            {/* Fading trail effect */}
                                            <div className="absolute left-0 top-0 h-full w-full bg-gradient-to-r from-transparent to-white/20"></div>
                                        </div>
                                        <div className="text-[11px] font-black text-slate-800 w-4 text-right">{d.val}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Bottom Row: Stats + Selection */}
                    <div className="flex gap-4 flex-1">
                        <div className="w-[45%] grid grid-cols-2 gap-2 mt-1">
                            <StatItem
                                label="Template"
                                val={totalTemplates}
                                icon={<Icons.Template />}
                                color="#3b82f6"
                                onClick={() => onNavigate('Whatsapp Templates')}
                                delay={0}
                            />
                            <StatItem
                                label="Automation Flow"
                                val={totalFlows}
                                icon={<Icons.Flow />}
                                color="#3b82f6"
                                onClick={() => onNavigate('Flows')}
                                delay={100}
                            />
                            <StatItem
                                label="Active Campaigns"
                                val={totalCampaigns}
                                icon={<Icons.Campaign />}
                                color="#f97316"
                                onClick={() => onNavigate('Campaigns')}
                                delay={200}
                            />
                            <StatItem
                                label="Pipeline"
                                val={totalPipelines}
                                icon={<Icons.Pipeline />}
                                color="#075985"
                                onClick={() => onNavigate('Pipelines')}
                                delay={300}
                            />
                        </div>

                        {/* Lead Categories (Replaces Selection Rate) */}
                        <div className="w-[55%] border border-[#84cc16] rounded-lg p-3 flex flex-col justify-between h-full backdrop-blur-md" style={{ backgroundColor: '#ffffff08' }}>
                            <h3 className="text-[11px] font-bold text-slate-800 mb-2">Lead Categories</h3>
                            <div className="flex flex-col gap-2">
                                {categoryData.map((d, i) => (
                                    <div
                                        key={i}
                                        onClick={() => onNavigate(d.target)}
                                        className="flex items-center justify-between border-b border-slate-50 last:border-0 pb-1 last:pb-0 cursor-pointer hover:bg-emerald-50/50 rounded-md px-1 transition-all duration-300 group hover:scale-[1.02] hover:shadow-md hover:border-emerald-200 opacity-0 animate-slide-in-right"
                                        style={{ animationDelay: `${i * 100}ms`, animationFillMode: 'forwards' }}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className="p-2 bg-slate-50 rounded-full group-hover:bg-white border border-transparent ring-1 ring-slate-900 group-hover:border-slate-100 transition-all shadow-sm">{d.icon}</div>
                                            <span className="text-sm font-bold text-[#0f172a] tracking-tight">{d.label}</span>
                                        </div>
                                        <span className="text-[11px] font-black text-slate-800 bg-slate-100 px-2 py-0.5 rounded-full">{d.val}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            

        </div>
    );

};

// --- Sub Components ---

const DonutRing: React.FC<{ value: number; target: number; color: string; trackColor?: string; label: string; icon: string; knobColor: string; knobBg?: string; size?: number; valueClassName?: string }> = ({ value, target, color, trackColor = '#f1f5f9', label, icon, knobColor, knobBg = 'white', size = 120, valueClassName = '' }) => {
    return (
        <div className="relative" style={{ width: size, height: size }}>
            <svg viewBox="0 0 40 40" className="w-full h-full -rotate-90">
                {/* Thick Track */}
                <circle cx="20" cy="20" r="15.5" fill="none" stroke={trackColor} strokeWidth="6" />
                {/* Thick Value Arc */}
                <circle
                    cx="20" cy="20" r="15.5"
                    fill="none"
                    stroke={color}
                    strokeWidth="6"
                    strokeDasharray={`${(value / target) * 100} 100`}
                    strokeLinecap="butt"
                />
            </svg>
            {/* Center Content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pt-1">
                <div className="mb-0.5">
                    {icon === 'group' ? <Icons.Users className="w-5 h-5" style={{ color }} /> : <Icons.User className="w-5 h-5" style={{ color }} />}
                </div>
                <span className={`text-2xl font-black text-slate-800 tracking-tight leading-none ${valueClassName}`}>{value.toLocaleString()}</span>
                <span className="text-[9px] font-bold text-slate-400 mt-0.5">{label}</span>
            </div>

        </div>
    );
};

const StatItem: React.FC<{ label: string; val: number; icon: React.ReactNode; color: string; onClick?: () => void; delay?: number }> = ({ label, val, icon, color, onClick, delay = 0 }) => (
    <div
        onClick={onClick}
        className={`h-full w-full border rounded-lg p-2 flex flex-col items-center justify-center text-center opacity-0 animate-fade-in-up backdrop-blur-md ${onClick ? 'cursor-pointer hover:shadow-xl hover:scale-105 transition-all duration-300 transform' : ''}`}
        style={{
            animationDelay: `${delay}ms`,
            animationFillMode: 'forwards',
            backgroundColor: `${color}14`, // ~8% opacity for a lighter transparent look
            borderColor: '#84cc16' // Restored original green border
        }}
    >
        <div className="w-10 h-10 min-w-[2.5rem] min-h-[2.5rem] rounded-full bg-[#84cc16] flex items-center justify-center mb-2 ring-1 ring-slate-900 shadow-sm group-hover:scale-110 transition-transform">
            <div className="text-white">
                {icon}
            </div>
        </div>
        <div className="text-sm font-bold text-[#0f172a] mb-1 tracking-tight leading-tight">{label}</div>
        <div className="text-xl font-black text-[#1e293b] leading-none">{val}</div>
    </div>
);

export default CRMPerformanceHub;
