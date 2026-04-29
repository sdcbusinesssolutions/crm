import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { tokenService } from '../services/tokenService';
import { MenuItem } from './Sidebar';
import EngagementCard from './EngagementCard';
import CRMPerformanceHub from './CRMPerformanceHub';
import { QRCodeCanvas } from 'qrcode.react';
import { useDashboardStats, useRevenueStats } from '../hooks/useDashboard';
import { monitorApiCall } from '../utils/apiOptimization';

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
    revenueStats?: {
        totalValue: number;
        wonValue: number;
        conversionRate: string;
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
    Shield: ({ className }: { className?: string }) => <svg className={className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
    Clock: ({ className }: { className?: string }) => <svg className={className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    Zap: ({ className }: { className?: string }) => <svg className={className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
    BadgeCheck: ({ className }: { className?: string }) => <svg className={className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138z" /></svg>
};

// --- Custom Complex Chart Components ---

const EmptyStateChart = ({ text }: { text: string }) => (
    <div className="flex flex-col items-center justify-center h-[200px] w-full text-slate-500 border-2 border-dashed border-slate-700/50 rounded-xl bg-white/5">
        <Icons.Chart />
        <p className="text-xs font-semibold mt-2">{text}</p>
    </div>
);

const IntegrationsBarChart: React.FC<{ breakdown: Record<string, number>; total: number }> = ({ breakdown, total }) => {
    // Brand Icons
    const BrandIcons: Record<string, (props: any) => JSX.Element> = {
        facebook: (props) => (
            <svg {...props} viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.791-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" fill="#1877F2" />
            </svg>
        ),
        google: (props) => (
            <svg {...props} viewBox="0 0 24 24" fill="currentColor">
                <path d="M16.2 3.6H7.8C6.81 3.6 6 4.41 6 5.4V18.6C6 19.59 6.81 20.4 7.8 20.4H16.2C17.19 20.4 18 19.59 18 18.6V5.4C18 4.41 17.19 3.6 16.2 3.6ZM14.4 12H9.6V10.8H14.4V12ZM14.4 9H9.6V7.8H14.4V9ZM14.4 15H9.6V13.8H14.4V15Z" fill="#34A853" />
            </svg>
        ),
        gmail: (props) => (
            <svg {...props} viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" fill="#EA4335" />
            </svg>
        ),
        google_calendar: (props) => (
            <svg {...props} viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2zm-7 5h5v5h-5v-5z" fill="#4285F4" />
            </svg>
        ),
        google_contacts: (props) => (
            <svg {...props} viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="#FBBC05" />
            </svg>
        )
    };

    const items = [
        { key: 'facebook', label: 'FB Lead Ads', bgColor: 'bg-blue-50', ring: 'ring-blue-100' },
        { key: 'google', label: 'Google Sheets', bgColor: 'bg-green-50', ring: 'ring-green-100' },
        { key: 'gmail', label: 'Gmail', bgColor: 'bg-red-50', ring: 'ring-red-100' },
        { key: 'google_calendar', label: 'Google Calendar', bgColor: 'bg-blue-50', ring: 'ring-blue-100' },
        { key: 'google_contacts', label: 'Google Contacts', bgColor: 'bg-yellow-50', ring: 'ring-yellow-100' }
    ];

    const data = items.map(item => ({
        ...item,
        count: breakdown[item.key] || 0
    }));

    return (
        <div className="flex flex-col gap-5 w-full h-full overflow-y-auto px-1 custom-scrollbar">
            {data.map((d) => {
                const isConnected = d.count > 0;
                const Icon = BrandIcons[d.key] || Icons.Link;

                return (
                    <div key={d.key} className="flex items-center justify-between group">
                        {/* Label & Status */}
                        <div className="flex items-center gap-4">
                            {/* Avatar Icon */}
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${d.bgColor} ${isConnected ? 'shadow-sm ring-1 ' + d.ring : 'shadow-sm ring-1 ring-slate-200'}`}>
                                <Icon className="w-6 h-6" />
                            </div>

                            <div className="flex flex-col">
                                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">{d.label}</span>
                                <span className={`text-[10px] font-medium ${isConnected ? 'text-emerald-500' : 'text-slate-500'}`}>
                                    {isConnected ? 'Active' : 'Not Connected'}
                                </span>
                            </div>
                        </div>

                        {/* Bar Visual */}
                        <div className="flex items-center gap-3">
                            <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden shrink-0">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ease-out shadow-sm ${isConnected ? '' : 'w-0'}`}
                                    style={{
                                        width: isConnected ? '100%' : '0%',
                                        backgroundColor: isConnected ? '#10b981' : undefined // Emerald-500 for active
                                    }}
                                />
                            </div>
                            <span className="text-xs font-black w-6 text-right text-slate-800">
                                {d.count > 0 ? d.count : '-'}
                            </span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const MultiLineChart: React.FC<{ data: any[]; categories: string[]; colors: string[] }> = ({ data, categories, colors }) => {
    const width = 800;
    const height = 300;
    const padding = 40;

    // Robust check for real data
    const hasData = data && data.length > 0 && data.some(d => categories.some(c => d[c] > 0));
    // Force display of grid even if no data
    const safeData = hasData ? data : Array.from({ length: 7 }, (_, i) => ({
        date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { weekday: 'short' }),
        ...categories.reduce((acc, c) => ({ ...acc, [c]: 0 }), {})
    }));

    // Calculate max value for scaling, ensure it's not 0 to avoid NaN
    const allValues = safeData.flatMap(d => categories.map(c => d[c] || 0));
    const maxVal = Math.max(...allValues, 10); // Minimum chart cap of 10 for better scale visually

    const getPoints = (category: string) => {
        return safeData.map((d, i) => {
            const x = (i / (safeData.length - 1)) * (width - padding * 2) + padding;
            const val = d[category] || 0;
            const y = height - padding - (val / maxVal) * (height - padding * 2);
            return `${x},${y}`;
        }).join(' ');
    };

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
            {/* Grid */}
            {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
                const y = height - padding - tick * (height - padding * 2);
                if (isNaN(y)) return null;
                return (
                    <g key={tick}>
                        <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#f1f5f9" strokeWidth="1" />
                        <text x={padding - 10} y={y + 4} textAnchor="end" className="text-[10px] fill-slate-500 font-medium">
                            {Math.round(tick * maxVal)}
                        </text>
                    </g>
                );
            })}

            {/* Definitions for Gradients */}
            <defs>
                {colors.map((color, i) => (
                    <linearGradient key={`grad-${i}`} id={`gradient-${categories[i]}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity="0.2" />
                        <stop offset="100%" stopColor={color} stopOpacity="0" />
                    </linearGradient>
                ))}
            </defs>

            {/* Render Area Fills First (so they are behind lines) */}
            {categories.map((cat, i) => {
                const points = getPoints(cat);
                if (points.includes('NaN')) return null;
                const firstPoint = points.split(' ')[0];
                const areaPath = `M ${firstPoint} L ${points} L ${width - padding},${height - padding} L ${padding},${height - padding} Z`;

                return (
                    <path
                        key={`area-${cat}`}
                        d={areaPath}
                        fill={`url(#gradient-${cat})`}
                        className="transition-all duration-500 ease-in-out"
                    />
                );
            })}

            {/* Render Lines & Dots */}
            {categories.map((cat, i) => {
                const points = getPoints(cat);
                if (points.includes('NaN')) return null;
                const color = colors[i % colors.length];

                return (
                    <g key={cat} className="group">
                        <path
                            d={`M ${points}`}
                            fill="none"
                            stroke={color}
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="drop-shadow-sm transition-all duration-500"
                        />

                        {/* Interactive Dots */}
                        {safeData.map((d, idx) => {
                            const x = (idx / (safeData.length - 1)) * (width - padding * 2) + padding;
                            const val = d[cat];
                            const y = height - padding - (val / maxVal) * (height - padding * 2);
                            if (isNaN(y)) return null;
                            return (
                                <circle key={idx} cx={x} cy={y} r="4" fill="white" stroke={color} strokeWidth="2" className="hover:scale-150 hover:fill-slate-50 cursor-crosshair transition-all duration-200">
                                    <title>{`${d.date} - ${cat}: ${val}`}</title>
                                </circle>
                            );
                        })}
                    </g>
                );
            })}

            {/* X-Axis Labels */}
            {safeData.map((d, i) => {
                const x = (i / (safeData.length - 1)) * (width - padding * 2) + padding;
                if (isNaN(x)) return null;
                if (safeData.length > 14 && i % Math.ceil(safeData.length / 7) !== 0) return null;
                return (
                    <text key={i} x={x} y={height - 10} textAnchor="middle" className="text-[10px] fill-slate-500 font-medium uppercase tracking-wide">{d.date}</text>
                );
            })}
        </svg>
    );
};

const LeadsBarChart: React.FC<{ data: any[]; days: number }> = ({ data, days }) => {
    // Filter data based on days (last 7 or 30)
    // Assuming data is already sorted by date desc or asc in backend, but backend sends 30 days usually.
    // Let's slice the last 'days' items.
    const chartData = data ? data.slice(-days) : [];
    const hasData = chartData.length > 0 && chartData.some(d => d.count > 0);

    const width = 800;
    const height = 300;
    const padding = 40;

    // Generate dummy data if empty to show grid
    const displayData = hasData ? chartData : Array.from({ length: days }, (_, i) => ({
        date: new Date(Date.now() - (days - 1 - i) * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { day: '2-digit', month: 'short' }),
        count: 0
    }));

    const maxVal = Math.max(...displayData.map(d => d.count), 5);
    const barWidth = (width - padding * 2) / displayData.length * 0.6; // 60% width

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
            <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="1" />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity="1" />
                </linearGradient>
            </defs>
            {/* Grid */}
            {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
                const y = height - padding - tick * (height - padding * 2);
                if (isNaN(y)) return null;
                return (
                    <line key={tick} x1={padding} y1={y} x2={width - padding} y2={y} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4 4" />
                );
            })}

            {/* Bars */}
            {displayData.map((d, i) => {
                const x = padding + i * ((width - padding * 2) / displayData.length) + ((width - padding * 2) / displayData.length - barWidth) / 2;
                const barHeight = (d.count / maxVal) * (height - padding * 2);
                const y = height - padding - barHeight;

                return (
                    <g key={i} className="group">
                        <rect
                            x={x}
                            y={y}
                            width={barWidth}
                            height={barHeight}
                            rx="4"
                            className="transition-all duration-300"
                            fill="url(#barGradient)"
                        />
                        {/* Tooltip-like text on hover (simple) or value on top */}
                        <text x={x + barWidth / 2} y={y - 5} textAnchor="middle" className="text-[10px] font-bold fill-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity">
                            {d.count}
                        </text>
                        {/* Date Label */}
                        {(displayData.length <= 14 || i % Math.ceil(displayData.length / 7) === 0) && (
                            <text x={x + barWidth / 2} y={height - 15} textAnchor="middle" className="text-[9px] fill-slate-500 font-medium uppercase tracking-wide">
                                {d.date}
                            </text>
                        )}
                    </g>
                );
            })}
        </svg>
    );
};



const PipelineHorizontalChart: React.FC<{ data: { name: string; totalLeads: number; stages: { name: string; count: number }[] }[] }> = ({ data }) => {
    const hasData = data && data.length > 0 && data.some(d => d.totalLeads > 0);
    if (!hasData) return <EmptyStateChart text="No pipeline data available" />;

    // Configuration
    const barHeight = 24;
    const gap = 36;
    const labelWidth = 120;
    const width = 800; // ViewBox Width
    const height = data.length * (barHeight + gap) + 40; // Dynamic Height
    const chartWidth = width - labelWidth - 40; // Available width for bars

    const maxVal = Math.max(...data.map(d => d.totalLeads), 1);

    // Highly distinct, vibrant gradients/colors for stages
    const stageColors = [
        ['#22d3ee', '#06b6d4'], // Cyan
        ['#818cf8', '#6366f1'], // Indigo
        ['#a78bfa', '#8b5cf6'], // Violet
        ['#c084fc', '#a855f7'], // Purple
        ['#e879f9', '#d946ef'], // Fuchsia
        ['#fb7185', '#f43f5e']  // Rose
    ];

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible font-sans">
            {data.map((d, i) => {
                const y = i * (barHeight + gap) + 20;
                let currentX = labelWidth;

                return (
                    <g key={i} className="group">
                        {/* Pipeline Name */}
                        <text
                            x={0}
                            y={y + barHeight / 2 + 5}
                            className="text-xs font-bold fill-slate-300 uppercase tracking-wide"
                            style={{ dominantBaseline: 'middle' }}
                        >
                            {d.name}
                        </text>

                        {/* Background Track */}
                        <rect
                            x={labelWidth}
                            y={y}
                            width={chartWidth}
                            height={barHeight}
                            rx="12"
                            fill="#1e293b" // slate-800
                            className="opacity-50"
                        />

                        {/* Stacked Bars */}
                        {d.stages.map((stage, sIdx) => {
                            if (stage.count === 0) return null;
                            const segmentWidth = (stage.count / maxVal) * chartWidth;

                            // Prevent tiny slivers from breaking rounded corners visual (or just keep simplistic)
                            // We can use a ClipPath or just simple rects. Linear stacking is fine.
                            const x = currentX;
                            currentX += segmentWidth;

                            const [c1, c2] = stageColors[sIdx % stageColors.length];

                            return (
                                <g key={sIdx}>
                                    <defs>
                                        <linearGradient id={`grad-${i}-${sIdx}`} x1="0" y1="0" x2="1" y2="0">
                                            <stop offset="0%" stopColor={c1} />
                                            <stop offset="100%" stopColor={c2} />
                                        </linearGradient>
                                    </defs>
                                    <rect
                                        x={x}
                                        y={y}
                                        width={Math.max(segmentWidth - 2, 2)} // Tiny gap
                                        height={barHeight}
                                        rx="4"
                                        fill={`url(#grad-${i}-${sIdx})`}
                                        className="hover:brightness-110 transition-all cursor-pointer"
                                    >
                                        <title>{`${stage.name}: ${stage.count} Leads`}</title>
                                    </rect>
                                </g>
                            );
                        })}

                        {/* Total Count Label at End */}
                        <text
                            x={currentX + 10}
                            y={y + barHeight / 2 + 5}
                            className="text-xs font-black fill-white"
                            style={{ dominantBaseline: 'middle' }}
                        >
                            {d.totalLeads}
                        </text>
                    </g>
                );
            })}
        </svg>
    );
};

const TaskPipelineBreakdown: React.FC<{ breakdown: Record<string, any>; totalDue: number }> = ({ breakdown, totalDue }) => {
    const pipelines = Object.values(breakdown || {});
    const hasData = pipelines.length > 0;

    if (!hasData) return (
        <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
                <Icons.Check className="w-6 h-6 opacity-50" />
            </div>
            <p className="text-xs font-medium">No pending tasks found</p>
        </div>
    );

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
                {pipelines.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/20 to-indigo-900/20 flex items-center justify-center text-indigo-400 font-bold text-xs border border-indigo-500/30">
                                {p.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-slate-200">{p.name}</h4>
                                <p className="text-[10px] text-slate-500 font-medium">{p.total} Total Tasks</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {p.today > 0 && (
                                <div className="px-2 py-1 rounded-md bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[10px] font-bold shadow-sm shadow-amber-900/20">
                                    {p.today} Today
                                </div>
                            )}
                            {p.overdue > 0 && (
                                <div className="px-2 py-1 rounded-md bg-red-500/20 border border-red-500/30 text-red-300 text-[10px] font-bold shadow-sm shadow-red-900/20">
                                    {p.overdue} Overdue
                                </div>
                            )}
                            {p.today === 0 && p.overdue === 0 && (
                                <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                                    <Icons.Check className="w-3 h-3" /> All Good
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- WhatsApp Connection Card (Click to Chat QR) ---
const WhatsAppScannerCard: React.FC<{
    phone: string | null;
    id: string | null;
    quality?: string;
    limit?: string;
    metaStatus?: string;
    displayPhone?: string | null;
    onConnect: () => void
}> = ({ phone, id, quality, limit, metaStatus, displayPhone, onConnect }) => {
    // Use Meta's display phone if available, else fallback to formatted local phone
    const formattedPhone = displayPhone || (phone ? phone.replace(/\D/g, '').replace(/(\d{2})(\d{5})(\d{5})/, '+$1 $2 $3') : 'Not Connected');
    // Link for the QR code: wa.me/<number>
    const qrLink = phone ? `https://wa.me/${phone.replace(/\D/g, '')}` : 'https://whatsapp.com';

    // Map tier to readable string
    // Uses whatsapp_business_manager_messaging_limit field values (non-deprecated Meta API)
    const formatLimit = (tier: string) => {
        if (!tier || tier === 'UNKNOWN' || tier === 'CHECKING') return tier || 'N/A';
        const map: any = {
            'TIER_50': '50 / 24h',
            'TIER_250': '250 / 24h',
            'TIER_1K': '1K / 24h',
            'TIER_2K': '2K / 24h',
            'TIER_5K': '5K / 24h',
            'TIER_10K': '10K / 24h',
            'TIER_100K': '100K / 24h',
            'TIER_UNLIMITED': 'Unlimited',
        };
        return map[tier] || tier.replace('TIER_', '').replace('K', 'K / 24h');
    };

    // ── KEY FIX: Phone presence = connected (ground truth) ────────────────────
    // If we have a phone number, the account IS connected regardless of Meta API status.
    // Only show 'Verifying...' when we truly have NO phone number AND status is LOADING.
    // This prevents the 'Verifying...' state from persisting if Meta API is slow.
    const isConnected = !!phone; // phone number = confirmed connected
    const isLoading = !phone && metaStatus === 'LOADING'; // only verifying if no phone yet
    const isDisconnected = !phone && metaStatus !== 'LOADING';

    // Status badge config
    const statusLabel = isConnected
        ? 'Connected'
        : isLoading
            ? 'Verifying...'
            : 'Disconnected';

    const statusClass = isConnected
        ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
        : isLoading
            ? 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/30 animate-pulse'
            : 'bg-red-500/10 text-red-400 ring-1 ring-red-500/30';

    const metaPending = phone && metaStatus === 'LOADING';

    return (
        <div className="bg-[#05342E] rounded-[2.5rem] p-4 relative overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.6),_inset_0_0_0_1px_rgba(255,255,255,0.05)] text-white flex flex-col items-center justify-start gap-4 h-full w-full border border-white/10 ring-[1.5px] ring-[#C5A059]/40 group transition-all duration-500 hover:ring-[#C5A059]/60 hover:border-white/20">
            {/* Highly Visible Texture Mix Layer */}
            <div className="absolute inset-0 rounded-[2.5rem] opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] pointer-events-none mix-blend-overlay"></div>
            <div className="absolute inset-0 rounded-[2.5rem] opacity-20 bg-[url('https://www.transparenttextures.com/patterns/white-diamond.png')] pointer-events-none mix-blend-soft-light"></div>

            <div className="z-10 text-center w-full mt-0.5">
                <div className="flex items-center justify-center mb-1">
                    <div className="relative group/icon">
                        <div className="absolute inset-0 bg-[#25D366] blur-2xl opacity-40 group-hover:opacity-60 transition-opacity"></div>
                        <div className="relative w-12 h-12 bg-[#25D366] rounded-full flex items-center justify-center shadow-[0_0_25px_rgba(37,211,102,0.4)] transform transition-transform duration-500 hover:scale-110">
                            <Icons.WhatsApp className="w-8 h-8 text-white drop-shadow-md" />
                        </div>
                    </div>
                </div>

                <h3 className="font-black text-xl tracking-tight mb-0.5 flex items-center justify-center gap-1.5">
                    <span className="text-white">WhatsApp</span>
                    <span className="text-[#25D366]">Business</span>
                </h3>

                <p className={`text-xs font-medium px-3 py-0.5 rounded-full inline-block ${statusClass}`}>
                    {statusLabel}
                </p>

                <p className="mt-1 font-mono text-xl tracking-wider text-slate-200">
                    {phone ? formattedPhone : 'No Number Linked'}
                </p>

                {phone && (
                    <div className="mt-1 flex items-center justify-center gap-2 bg-white/5 rounded-2xl p-2 border border-white/20 w-full max-w-[280px] shadow-[0_4px_12px_rgba(0,0,0,0.2),inset_0_1px_1px_rgba(255,255,255,0.1)]">
                        <div className="flex items-center gap-2 justify-center px-2">
                            <div className="relative shrink-0">
                                <div className="absolute inset-0 bg-[#84cc16]/20 blur-md rounded-full"></div>
                                <div className="relative w-8 h-8 rounded-full bg-[#84cc16] flex items-center justify-center border border-[#84cc16]/50">
                                    <Icons.Shield className="w-4 h-4 text-white" />
                                </div>
                            </div>
                            <div className="flex flex-col items-center min-w-0">
                                <span className="inline-block w-fit px-1.5 py-0.5 rounded-full bg-white text-[6.5px] text-[#05342E] uppercase font-black tracking-[0.1em] leading-none">Quality</span>
                                <span className="text-[11px] font-black text-[#84cc16] truncate mt-0.5 leading-none">
                                    {metaPending && !quality ? '...' : (quality || 'GREEN')}
                                </span>
                            </div>
                        </div>

                        <div className="w-px h-6 bg-white/10 shrink-0 mx-2"></div>

                        <div className="flex items-center gap-2 justify-center px-2">
                            <div className="relative shrink-0">
                                <div className="absolute inset-0 bg-[#84cc16]/10 blur-md rounded-full"></div>
                                <div className="relative w-8 h-8 rounded-full bg-[#84cc16] flex items-center justify-center border border-[#84cc16]/50">
                                    <Icons.Clock className="w-4 h-4 text-white" />
                                </div>
                            </div>
                            <div className="flex flex-col items-center min-w-0">
                                <span className="inline-block w-fit px-1.5 py-0.5 rounded-full bg-white text-[6.5px] text-[#05342E] uppercase font-black tracking-[0.1em] leading-none">Limit</span>
                                <span className="text-[11px] font-black text-[#84cc16] truncate mt-0.5 leading-none">
                                    {metaPending && !limit ? '...' : formatLimit(limit || '')}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex-1 flex flex-col justify-center w-full items-center relative py-1">
                <div onClick={onConnect} className="group/qr relative z-10 bg-white p-2 rounded-2xl shadow-[0_15px_30px_rgba(0,0,0,0.3)] transform transition-all hover:scale-105 duration-500 cursor-pointer border border-emerald-500/30">
                    <div className="absolute inset-0 bg-emerald-500/10 rounded-2xl blur-xl opacity-0 group-hover/qr:opacity-100 transition-opacity duration-500"></div>
                    <div className="relative bg-white p-1 rounded-xl overflow-hidden">
                        {phone ? (
                            <QRCodeCanvas
                                value={qrLink}
                                size={128}
                                level={"H"}
                                className="w-32 h-32 object-contain"
                                fgColor="#064e3b"
                                bgColor="#FFFFFF"
                            />
                        ) : isLoading ? (
                            <div className="w-32 h-32 flex flex-col items-center justify-center bg-slate-50 gap-3 rounded-xl">
                                <div className="w-7 h-7 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Syncing...</p>
                            </div>
                        ) : (
                            <div className="w-32 h-32 flex flex-col items-center justify-center bg-slate-50 text-slate-400 text-[10px] font-bold p-3 text-center rounded-xl">
                                <Icons.Link className="w-5 h-5 mb-2 opacity-20" />
                                NO ACCOUNT
                            </div>
                        )}
                    </div>

                    {phone && (
                        <div className="mt-2 px-4 py-1.5 bg-[#052e24] rounded-xl flex items-center justify-center gap-2 shadow-lg border border-white/5 group-hover/qr:bg-[#074e3c] transition-colors">
                            <Icons.WhatsApp className="w-3.5 h-3.5 text-white" />
                            <span className="text-[9px] font-black text-white uppercase tracking-[0.2em]">Scan to Chat</span>
                        </div>
                    )}
                </div>

                <div className="w-full mt-1 py-1 px-0.5 bg-white/10 rounded-2xl border border-white/10 grid grid-cols-3 divide-x divide-white/10 shadow-inner">
                    <div className="flex items-center justify-center gap-1.5 px-1">
                        <Icons.Shield className="w-3.5 h-3.5 text-[#bef264] drop-shadow-[0_0_8px_rgba(190,242,100,0.4)] shrink-0" />
                        <div className="flex flex-col leading-none">
                            <span className="text-[10px] font-black text-white tracking-tight truncate">SECURE</span>
                            <span className="text-[8px] text-white font-bold whitespace-nowrap">Trusted</span>
                        </div>
                    </div>
                    <div className="flex items-center justify-center gap-1.5 px-1">
                        <Icons.Zap className="w-3.5 h-3.5 text-[#bef264] drop-shadow-[0_0_8px_rgba(190,242,100,0.4)] shrink-0" />
                        <div className="flex flex-col leading-none">
                            <span className="text-[10px] font-black text-white tracking-tight truncate">FAST</span>
                            <span className="text-[8px] text-white font-bold whitespace-nowrap">Response</span>
                        </div>
                    </div>
                    <div className="flex items-center justify-center gap-1.5 px-1">
                        <Icons.BadgeCheck className="w-3.5 h-3.5 text-[#bef264] drop-shadow-[0_0_8px_rgba(190,242,100,0.4)] shrink-0" />
                        <div className="flex flex-col leading-none">
                            <span className="text-[10px] font-black text-white tracking-tight truncate">VERIFIED</span>
                            <span className="text-[8px] text-white font-bold whitespace-nowrap">Official</span>
                        </div>
                    </div>
                </div>

                {!phone && !isLoading && (
                    <button onClick={onConnect} className="z-10 mt-3 text-[10px] font-bold bg-white/10 hover:bg-white/20 text-white px-4 py-1.5 rounded-lg backdrop-blur-sm transition-all">
                        Connect Account
                    </button>
                )}
            </div>
        </div>
    );
};

const Dashboard: React.FC<DashboardProps> = ({ onNavigate, onNavigateToPipeline, onToggleSidebar }) => {
    // ── Helpers ─────────────────────────────────────────────────────────────────
    const CACHE_KEY = 'dashboard_stats_cache_v3';
    // DISPLAY TTL: how long before we silently background-refresh (not show skeleton)
    // Skeleton only shows when there is ZERO cached data (true first visit)
    const CACHE_REFRESH_TTL = 5 * 60 * 1000;  // 5 min — background-refresh trigger
    const CACHE_MAX_AGE = 60 * 60 * 1000; // 60 min — max age before we discard data

    const readCache = (): { data: DashboardStats | null; userId?: string; fresh: boolean } => {
        try {
            const raw = localStorage.getItem(CACHE_KEY);
            if (!raw) return { data: null, fresh: false };
            const parsed = JSON.parse(raw);
            const age = Date.now() - (parsed.timestamp || 0);
            // Discard data older than 60 minutes (definitely stale)
            if (age > CACHE_MAX_AGE) {
                localStorage.removeItem(CACHE_KEY);
                return { data: null, fresh: false };
            }
            // Fresh = within 5-min refresh window
            const fresh = !!(parsed.data && age < CACHE_REFRESH_TTL);
            return { data: parsed.data || null, userId: parsed.userId, fresh };
        } catch { }
        return { data: null, fresh: false };
    };

    const writeCache = (data: DashboardStats, userId?: string) => {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({ data, userId, timestamp: Date.now() }));
        } catch { }
    };

    const updateCacheField = (update: Partial<DashboardStats>) => {
        try {
            const raw = localStorage.getItem(CACHE_KEY);
            const existing = raw ? JSON.parse(raw) : {};
            const merged = { ...existing, data: { ...(existing.data || {}), ...update }, timestamp: Date.now() };
            localStorage.setItem(CACHE_KEY, JSON.stringify(merged));
        } catch { }
    };

    // ── Synchronous cache read on init ─────────────────────────────────────────
    // KEY RULE: loading=true ONLY when there is NO data at all (first-ever visit)
    // Stale data? → show it immediately, refresh silently in background (no skeleton!)
    const initialCache = readCache();

    const [stats, setStats] = useState<DashboardStats | null>(initialCache.data);
    const [loading, setLoading] = useState<boolean>(!initialCache.data); // ← ONLY true when zero data
    const [timeRange, setTimeRange] = useState('7d');
    const [chartPeriod, setChartPeriod] = useState('7days');
    const [leadTimeRange, setLeadTimeRange] = useState<7 | 30>(30);
    const [revenueStats, setRevenueStats] = useState(
        initialCache.data?.revenueStats || { totalValue: 0, wonValue: 0, conversionRate: '0%' }
    );

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            // ── PHASE 1: Check cache ─────────────────────────────────────────────────
            const { data: cachedData, userId: cachedUserId, fresh: cacheIsFresh } = readCache();

            // Always show cached data immediately — NEVER block on loading if we have any data
            if (cachedData) {
                setStats(cachedData);
                if (cachedData.revenueStats) setRevenueStats(cachedData.revenueStats);
                setLoading(false); // ← never show skeleton if we have ANY cached data
            }

            // ── PHASE 2: Get auth token ──────────────────────────────────────────────
            let token = tokenService.getAccessToken();
            let userId: string | undefined;
            if (!token) {
                const { data: { session } } = await supabase.auth.getSession();
                token = session?.access_token || '';
                userId = session?.user?.id;
            } else {
                try {
                    const payload = JSON.parse(atob(token.split('.')[1]));
                    userId = payload.sub;
                } catch {
                    const { data: { session } } = await supabase.auth.getSession();
                    token = session?.access_token || '';
                    userId = session?.user?.id;
                }
            }

            // Invalidate cache on user switch
            if (cachedUserId && userId && cachedUserId !== userId) {
                localStorage.removeItem(CACHE_KEY);
                setStats(null);
                setLoading(true); // legitimate fresh user — show skeleton
            }

            const authHeader = { 'Authorization': `Bearer ${token}` };

            // Always fetch fresh data — but if we already had cache data, this is a silent background refresh
            // If no cache data at all — this is the only time the skeleton shows
            const res = await fetch('/api/dashboard/stats', { headers: authHeader });
            if (res.ok) {
                const data = await res.json();
                if (data) {
                    // Preserve good Meta API data from cache — avoid flicker of Quality and Limits
                    if (data.connection?.status === 'LOADING' && cachedData?.connection) {
                        data.connection.quality_rating = cachedData.connection.quality_rating || 'LOADING';
                        data.connection.messaging_limit = cachedData.connection.messaging_limit || 'CHECKING';
                        // Note: We DO NOT overwrite phone number from cache. 
                        // The fresh stats response provides the true phone number!
                    }
                    // Preserve cached chart data while background chart fetch runs
                    if (!data.chartData?.length && cachedData?.chartData?.length) {
                        data.chartData = cachedData.chartData;
                        data.leadsChartData = cachedData.leadsChartData;
                    }
                    setStats(data);
                    if (data.revenueStats) setRevenueStats(data.revenueStats);
                    setLoading(false);

                    // ⚠️ Never cache connection.status='LOADING' — would cause 'Verifying...' on next visit
                    // Strip loading state before writing, but keep phone number (phone = ground truth)
                    const dataToCache = { ...data };
                    if (dataToCache.connection?.status === 'LOADING') {
                        dataToCache.connection = {
                            ...dataToCache.connection,
                            status: dataToCache.connection.phone ? 'CONNECTED' : 'UNKNOWN',
                            quality_rating: dataToCache.connection.quality_rating === 'LOADING' ? null : dataToCache.connection.quality_rating,
                            messaging_limit: dataToCache.connection.messaging_limit === 'CHECKING' ? null : dataToCache.connection.messaging_limit,
                        };
                    }
                    writeCache(dataToCache, userId);
                }
            } else {
                setLoading(false); // network failed — show whatever we have (even stale)
            }

            // ── PHASE 3: Background fetches — run after UI is already rendered ───────
            // 3a: Chart data (server caches 10 min — usually instant after warmup)
            fetch('/api/dashboard/charts', { headers: authHeader })
                .then(r => r.ok ? r.json() : null)
                .then(chartData => {
                    if (chartData) {
                        setStats(prev => {
                            if (!prev) return prev;
                            const updated = { ...prev, chartData: chartData.chartData || [], leadsChartData: chartData.leadsChartData || [] };
                            updateCacheField({ chartData: updated.chartData, leadsChartData: updated.leadsChartData });
                            return updated;
                        });
                    }
                }).catch(() => null);

            // 3b: WhatsApp connection health (calls external Meta API — may be slow)
            fetch('/api/dashboard/connections', { headers: authHeader })
                .then(r => r.ok ? r.json() : null)
                .then(connData => {
                    if (connData?.connection) {
                        setStats(prev => {
                            if (!prev) return prev;
                            const updated = {
                                ...prev,
                                connection: { ...prev.connection, ...connData.connection },
                                integrationStats: { ...prev.integrationStats, ...connData.integrationStats }
                            };
                            updateCacheField({ connection: updated.connection, integrationStats: updated.integrationStats });
                            return updated;
                        });
                    }
                })
                .catch(() => {
                    setStats(prev => prev
                        ? { ...prev, connection: { ...prev.connection, status: 'UNKNOWN', quality_rating: 'UNKNOWN' } }
                        : prev
                    );
                });

        } catch (error) {
            console.error('Failed to load dashboard stats', error);
        }
    };


    const handleNav = (item: MenuItem) => {
        if (onNavigate) {
            onNavigate(item);
        }
    };

    // Skeleton Loading Component
    const SkeletonDashboard = () => (
        <div className="flex flex-col h-full bg-slate-50 relative overflow-hidden">
            {/* Header Skeleton */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0 h-16">
                <div className="w-48 h-6 bg-slate-200 rounded animate-pulse"></div>
                <div className="w-8 h-8 bg-slate-200 rounded-full animate-pulse"></div>
            </div>

            <div className="flex-1 overflow-hidden p-4 md:p-6">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-6">
                    {/* Engagement Card Skeleton */}
                    <div className="md:col-span-4 lg:col-span-3 h-[400px]">
                        <div className="h-full bg-white border border-[#c4b5fd] rounded-[24px] p-6 animate-pulse">
                            <div className="h-4 bg-slate-200 rounded w-1/3 mb-8 mx-auto"></div>
                            <div className="h-32 bg-slate-200 rounded-full w-32 mx-auto mb-8"></div>
                            <div className="space-y-4 mt-8">
                                <div className="h-12 bg-slate-100 rounded-xl"></div>
                                <div className="h-12 bg-slate-100 rounded-xl"></div>
                            </div>
                        </div>
                    </div>

                    {/* CRM Hub Skeleton */}
                    <div className="md:col-span-8 lg:col-span-9 h-[400px]">
                        <div className="h-full bg-white border border-[#c4b5fd] rounded-[24px] p-4 grid grid-cols-1 lg:grid-cols-[1fr_1.4fr_2.2fr] gap-4 animate-pulse">
                            <div className="col-span-1 bg-slate-100/50 rounded-xl flex flex-col gap-4 p-2">
                                <div className="flex-1 bg-slate-200 rounded-lg"></div>
                                <div className="flex-1 bg-slate-200 rounded-lg"></div>
                            </div>
                            <div className="col-span-1 bg-slate-100/50 rounded-xl relative">
                                <div className="absolute inset-x-4 top-8 h-32 bg-slate-200 rounded-lg"></div>
                                <div className="absolute inset-x-8 bottom-8 h-32 bg-slate-200/50 rounded-b-full"></div>
                            </div>
                            <div className="col-span-1 bg-slate-100/50 rounded-xl p-2 flex flex-col gap-2">
                                <div className="h-[180px] flex gap-2">
                                    <div className="w-[45%] bg-slate-200 rounded-lg"></div>
                                    <div className="w-[55%] bg-slate-200 rounded-lg"></div>
                                </div>
                                <div className="flex-1 flex gap-2">
                                    <div className="w-[45%] grid grid-cols-2 gap-2">
                                        <div className="bg-slate-200 rounded-lg"></div>
                                        <div className="bg-slate-200 rounded-lg"></div>
                                        <div className="bg-slate-200 rounded-lg"></div>
                                        <div className="bg-slate-200 rounded-lg"></div>
                                    </div>
                                    <div className="w-[55%] bg-slate-200 rounded-lg"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Charts Skeleton */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="h-64 bg-white border border-[#c4b5fd] rounded-[24px] p-6 animate-pulse">
                        <div className="h-4 w-1/3 bg-slate-200 rounded mb-4"></div>
                        <div className="h-full bg-slate-50/50 rounded-xl"></div>
                    </div>
                    <div className="h-64 bg-white border border-[#c4b5fd] rounded-[24px] p-6 animate-pulse">
                        <div className="h-4 w-1/3 bg-slate-200 rounded mb-4"></div>
                        <div className="h-full bg-slate-50/50 rounded-xl"></div>
                    </div>
                    <div className="h-64 bg-white border border-[#c4b5fd] rounded-[24px] p-6 animate-pulse">
                        <div className="h-4 w-1/3 bg-slate-200 rounded mb-4"></div>
                        <div className="h-full bg-slate-50/50 rounded-xl"></div>
                    </div>
                </div>
            </div>
        </div>
    );

    // Show loading skeleton while fetching data
    if (loading) {
        return <SkeletonDashboard />;
    }

    // Show error only when done loading with no data
    if (!stats && !loading) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
                <div className="flex flex-col items-center gap-4 max-w-md text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-slate-900">Failed to Load Dashboard</h2>
                    <p className="text-slate-600">Unable to fetch dashboard data. Please check your connection and try again.</p>
                    <button
                        onClick={() => { setLoading(true); loadStats(); }}
                        className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    const tStats = stats?.templateStats || { approved: 0, pending: 0, rejected: 0 };
    const tTotal = tStats.approved + tStats.pending + tStats.rejected || 0;

    return (
        <div className="flex flex-col h-full bg-slate-50 w-full relative overflow-hidden selection:bg-indigo-500/30 selection:text-indigo-800 font-sans">
            {/* Ambient Background Effects (Subtle for Light Mode) */}
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-200/40 rounded-full blur-[120px] pointer-events-none animate-pulse"></div>
            <div className="absolute top-[10%] right-[-10%] w-[50%] h-[50%] bg-blue-200/40 rounded-full blur-[120px] pointer-events-none animate-pulse" style={{ animationDelay: '2s' }}></div>
            <div className="absolute bottom-[-10%] left-[20%] w-[50%] h-[50%] bg-emerald-200/40 rounded-full blur-[120px] pointer-events-none animate-pulse" style={{ animationDelay: '4s' }}></div>

            {/* Inject Custom Animation Styles */}
            <style>{`
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in-up {
                    animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                    opacity: 0;
                }
                /* Floating Animation */
                @keyframes float {
                    0% { transform: translateY(0px); }
                    50% { transform: translateY(-3px); }
                    100% { transform: translateY(0px); }
                }
                .animate-float {
                    animation: float 6s ease-in-out infinite;
                }
                
                /* Shimmer Effect */
                @keyframes shine {
                    100% { left: 125%; }
                }
                .group:hover .shine-effect {
                    animation: shine 0.75s;
                }
                @keyframes blinkHard {
                    0%, 45% { opacity: 1; }
                    50%, 95% { opacity: 0; }
                }
                .animate-blink-hard {
                    animation: blinkHard 1.2s infinite;
                }
            `}</style>

            {/* Top Navigation Bar */}
            <div className="shrink-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200 px-4 py-3 sm:px-8 flex items-center justify-between sticky top-0">
                <div className="flex items-center gap-3">
                    {onToggleSidebar && (
                        <button
                            onClick={onToggleSidebar}
                            className="lg:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            <Icons.Menu className="w-6 h-6" />
                        </button>
                    )}
                    <div>
                        <h1 className="text-xl md:text-2xl font-black tracking-tight leading-none text-slate-900 drop-shadow-sm">Dashboard</h1>
                    </div>
                </div>
                {/* Right side actions removed as per request (moved to sidebar) */}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-8">
                <div className="max-w-[1800px] mx-auto space-y-6 md:space-y-8 pb-20">

                    {/* 1. Hero Grid: Scanner + Key Stats + Quick Actions */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-8">

                        {/* A. WhatsApp Connection (Scanner) */}
                        <div className="md:col-span-1 lg:col-span-1 animate-fade-in-up h-full flex flex-col py-4" style={{ animationDelay: '0ms' }}>
                            {/* Spacer to align with CRMPipelineHub Header (text-lg + pb-2) approx 36px */}
                            <div className="h-9 shrink-0 hidden md:block"></div>
                            <WhatsAppScannerCard
                                phone={stats?.connection?.phone || null}
                                id={stats?.connection?.id || null}
                                quality={stats?.connection?.quality_rating}
                                limit={stats?.connection?.messaging_limit}
                                metaStatus={stats?.connection?.status}
                                displayPhone={stats?.connection?.display_phone_number}
                                onConnect={() => handleNav('WhatsApp Management')}
                            />
                        </div>

                        {/* B. Unified CRM Performance Hub (Combines 4 Badges + Charts) */}
                        <div className="md:col-span-2 lg:col-span-3 animate-fade-in-up h-full" style={{ animationDelay: '100ms' }}>
                            <CRMPerformanceHub stats={stats} onNavigate={handleNav} />
                        </div>
                    </div>

                    {/* 2. Visual Analytics Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8 my-10 animate-fade-in-up" style={{ animationDelay: '100ms' }}>

                        {/* 1. Message Volume (Top Left) */}
                        <div className="bg-white border border-[#c4b5fd] rounded-3xl p-6 relative overflow-hidden flex flex-col h-[400px] group shadow-sm hover:shadow-indigo-500/5 transition-shadow duration-300">
                            <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-slate-50 opacity-40 shine-effect" />
                            <div className="relative z-10 flex-1 flex flex-col justify-between">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                                            <Icons.WhatsApp className="w-5 h-5 text-emerald-500" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-[15px] text-violet-950">Message Volume</h3>
                                            <p className="text-[12px] font-semibold text-violet-500/80">7 Days Traffic</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-50 border border-slate-200">
                                            <div className="w-1.5 h-1.5 rounded-full bg-[#6366f1] shadow-[0_0_5px_#6366f1]" />
                                            <span className="text-[10px] text-slate-500 font-bold uppercase">Sent</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-50 border border-slate-200">
                                            <div className="w-1.5 h-1.5 rounded-full bg-[#10b981] shadow-[0_0_5px_#10b981]" />
                                            <span className="text-[10px] text-slate-500 font-bold uppercase">Read</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex-1 w-full min-h-0">
                                    <MultiLineChart
                                        data={stats?.chartData || []}
                                        categories={['sent', 'read']}
                                        colors={['#6366f1', '#10b981']}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 2. Leads Growth (Top Right) */}
                        <div className="bg-white border border-[#67e8f9] rounded-3xl p-8 relative overflow-hidden flex flex-col h-[400px] group shadow-sm hover:shadow-cyan-500/5 transition-shadow duration-300">
                            <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-slate-50 opacity-40 shine-effect" />
                            <div className="flex justify-between items-start mb-6 relative z-10 shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-cyan-50 border border-cyan-100 flex items-center justify-center shrink-0">
                                        <Icons.Users className="w-5 h-5 text-cyan-500" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-[15px] text-cyan-950">Leads Growth</h3>
                                        <p className="text-[12px] font-semibold text-cyan-600/80">New contacts joining over time</p>
                                    </div>
                                </div>
                                <div className="flex bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                                    <button
                                        onClick={() => setChartPeriod('7days')}
                                        className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${chartPeriod === '7days' ? 'bg-white text-slate-800 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}
                                    >
                                        7 Days
                                    </button>
                                    <button
                                        onClick={() => setChartPeriod('30days')}
                                        className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${chartPeriod === '30days' ? 'bg-white text-slate-800 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}
                                    >
                                        30 Days
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 w-full relative z-10 min-h-0">
                                <LeadsBarChart
                                    data={stats?.leadsChartData || []}
                                    days={chartPeriod === '7days' ? 7 : 30}
                                />
                            </div>
                        </div>

                        {/* 3. Pipeline Activity (Bottom Left) */}
                        <div className="bg-white border border-[#f9a8d4] rounded-3xl p-6 relative overflow-hidden flex flex-col h-[400px] group shadow-sm hover:shadow-indigo-500/5 transition-shadow duration-300">
                            <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-slate-50 opacity-40 shine-effect" />
                            <div className="flex justify-between items-center mb-6 shrink-0 relative z-10">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-pink-50 border border-pink-100 flex items-center justify-center shrink-0">
                                        <Icons.Flow className="w-5 h-5 text-pink-500" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-[15px] text-pink-950">Pipeline Name</h3>
                                        <p className="text-[12px] font-semibold text-pink-500/80">Total Leads Breakdown</p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex-1 w-full relative min-h-0 overflow-y-auto custom-scrollbar">
                                <PipelineListChart data={stats?.pipelineStats || []} onNavigateToPipeline={onNavigateToPipeline} />
                            </div>
                        </div>

                        {/* 4. Priority Follow-ups (Bottom Right) */}
                        <div className="bg-white border border-[#fdba74] rounded-3xl p-6 relative overflow-hidden flex flex-col h-[400px] group shadow-sm transition-shadow duration-300">
                            <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-slate-50 opacity-40 shine-effect" />

                            <div className="flex justify-between items-center mb-6 shrink-0 relative z-10">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center shrink-0">
                                        <Icons.Check className="w-5 h-5 text-orange-500" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-[15px] text-orange-950">Priority Follow-ups</h3>
                                        <p className="text-[12px] font-semibold text-orange-500/80">Tasks requiring attention</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold">{stats?.taskStats?.today || 0} Today</div>
                                    <div className="px-2 py-1 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold">{stats?.taskStats?.due || 0} Pend.</div>
                                </div>
                            </div>

                            <div className="flex-1 min-h-0 relative z-10 w-full">
                                <TaskListBreakdown
                                    breakdown={stats?.taskStats?.breakdown || {}}
                                    totalDue={stats?.taskStats?.due || 0}
                                    completed={stats?.taskStats?.completed || 0}
                                />
                            </div>
                        </div>

                        {/* 5. [NEW] Advanced Analytics Row (Replaces Integrations Card) */}
                        <div className="lg:col-span-2 xl:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
                            {/* A. Conversion Funnel */}
                            <div className="bg-white border border-[#93c5fd] rounded-3xl p-6 relative overflow-hidden flex flex-col h-[400px] shadow-sm">
                                <div className="flex justify-between items-center mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                                            <Icons.Campaign className="w-5 h-5 text-blue-500" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-[15px] text-blue-950">Engagement Overview</h3>
                                            <p className="text-[12px] font-semibold text-blue-500/80">Recent Campaigns & Drips</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex-1 flex flex-col gap-4 overflow-y-auto custom-scrollbar px-1">
                                    <EngagementCard stats={stats} />
                                </div>
                            </div>

                            <div className="bg-white border border-[#6ee7b7] rounded-3xl p-6 relative overflow-hidden flex flex-col h-[400px] shadow-sm hover:shadow-emerald-500/5 transition-shadow">
                                <div className="flex items-center gap-3 shrink-0">
                                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                                        <Icons.Chart className="w-5 h-5 text-emerald-500" />
                                    </div>
                                    <h3 className="font-bold text-[15px] text-emerald-950">Revenue Forecast</h3>
                                </div>
                                <div className="flex-1 flex flex-col items-center justify-center mt-2">
                                    <div className="relative mb-8 mt-4">
                                        <svg className="w-32 h-32 transform -rotate-90 overflow-visible" viewBox="0 0 128 128">
                                            <circle cx="64" cy="64" r="56" fill="transparent" stroke="#f1f5f9" strokeWidth="12" />
                                            <circle
                                                cx="64" cy="64" r="56"
                                                fill="transparent"
                                                stroke="#10b981"
                                                strokeWidth="12"
                                                strokeDasharray={`${(Number(revenueStats.conversionRate.replace('%', '')) / 100) * 351} 351`}
                                                strokeLinecap="round"
                                            />
                                        </svg>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                            <span className="text-2xl font-extrabold text-slate-800">{revenueStats.conversionRate}</span>
                                            <span className="text-[10px] uppercase font-bold text-slate-400">Conversion</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="w-full grid grid-cols-1 gap-4 shrink-0">
                                    <div className="bg-slate-50 p-3 rounded-2xl text-center">
                                        <p className="text-xs text-slate-500 mb-1">Total Pipeline</p>
                                        <p className="text-sm font-bold text-slate-900">{revenueStats.totalValue.toLocaleString()}</p>
                                    </div>
                                    <div className="bg-emerald-50 p-3 rounded-2xl text-center">
                                        <p className="text-xs text-emerald-600 mb-1">Won Revenue</p>
                                        <p className="text-sm font-bold text-emerald-700">{revenueStats.wonValue.toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>

                            {/* C. Integrations */}
                            <div className="bg-white border border-[#f0abfc] rounded-3xl p-6 relative overflow-hidden flex flex-col h-[400px] shadow-sm group hover:shadow-emerald-500/5 transition-shadow">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-2xl bg-fuchsia-50 border border-fuchsia-100 flex items-center justify-center shrink-0">
                                            <Icons.Link className="w-5 h-5 text-fuchsia-500" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-[15px] text-fuchsia-950">Integrations</h3>
                                            <p className="text-[12px] font-semibold text-fuchsia-500/80">Active Connections</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex-1 w-full min-h-0">
                                    <IntegrationsBarChart
                                        breakdown={stats?.integrationStats?.breakdown || {}}
                                        total={stats?.integrationStats?.total || 0}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 3. Beta Features Section */}
                    <div className="lg:col-span-full grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
                        {[
                            { title: 'Facebook Add Lead', icon: Icons.Users, gradient: 'bg-blue-600', shadow: 'hover:shadow-blue-600/30', nav: 'Contact Groups' },
                            { title: 'Gallery', icon: Icons.Template, gradient: 'bg-[#4f46e5]', shadow: 'hover:shadow-indigo-600/30', nav: 'Gallery' }, // Indigo variant
                            { title: 'AI Voice Agent', icon: Icons.Bot, gradient: 'bg-[#7c3aed]', shadow: 'hover:shadow-violet-600/30', nav: 'Ai Voice agent' }, // Violet variant
                            { title: 'Integration', icon: Icons.Filter, gradient: 'bg-[#059669]', shadow: 'hover:shadow-emerald-600/30', nav: 'Integrations' } // Emerald variant
                        ].map((item, idx) => (
                            <div
                                key={idx}
                                onClick={() => handleNav(item.nav as any)}
                                className={`relative overflow-hidden group p-5 rounded-3xl border border-white/10 transition-all duration-300 cursor-pointer hover:-translate-y-1 hover:scale-[1.02] ${item.gradient} ${item.shadow} hover:shadow-xl`}
                            >
                                {/* Shimmer Effect */}
                                <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-20 shine-effect" />

                                {/* Beta Badge */}
                                <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-md border border-white/10">
                                    <span className="text-[9px] font-bold text-white/90 tracking-wider uppercase">Beta</span>
                                </div>

                                {/* Content */}
                                <div className="flex flex-col items-center text-center relative z-10 pt-2">
                                    <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center mb-3 backdrop-blur-sm group-hover:scale-110 transition-transform duration-300 shadow-inner border border-white/10">
                                        <item.icon className="w-6 h-6 text-white" />
                                    </div>
                                    <h3 className="font-bold text-white text-sm tracking-tight">{item.title}</h3>
                                    <p className="text-[10px] text-white/60 mt-1 font-medium">Experimental Feature</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Template Health (Smaller Card) */}
                    <div className="bg-gradient-to-br from-[#50C878] to-[#020617] border border-white/10 rounded-3xl p-8 flex flex-col justify-between lg:col-span-2 relative overflow-hidden group shadow-2xl hover:shadow-emerald-500/10 transition-shadow duration-300">
                        <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-[0.03] shine-effect" />
                        <div className="flex justify-between items-center mb-6 relative z-10">
                            <h3 className="font-bold text-lg text-emerald-100">System Health & Templates</h3>
                            <span className="text-xs font-bold text-emerald-100 uppercase tracking-wider">{stats?.summary.totalTemplates} Total Templates</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div className="flex items-center justify-center">
                                {/* Donut Chart */}
                                {tTotal > 0 ? (
                                    <div className="relative w-40 h-40">
                                        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                                            <path className="text-emerald-900/20 drop-shadow-sm" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                                            {tStats.approved > 0 && <path className="text-[#bef264]" strokeDasharray={`${(tStats.approved / tTotal) * 100}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />}
                                        </svg>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                            <span className="text-3xl font-black text-white">{tStats.approved}</span>
                                            <span className="text-[9px] font-bold text-[#bef264] uppercase tracking-widest mt-0.5">Active</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="w-full h-32 flex items-center justify-center border-2 border-dashed border-slate-700/50 rounded-xl text-slate-500 text-xs font-bold">No Data</div>
                                )}
                            </div>

                            {/* Detailed Stats */}
                            <div className="col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <div className="bg-emerald-500/10 backdrop-blur-sm p-4 rounded-2xl border border-emerald-500/20 text-center hover:bg-emerald-500/20 transition-colors">
                                    <span className="block text-2xl font-black text-white">{tStats.approved}</span>
                                    <span className="text-[10px] font-bold text-[#bef264] uppercase">Approved</span>
                                </div>
                                <div className="bg-emerald-500/10 backdrop-blur-sm p-4 rounded-2xl border border-emerald-500/20 text-center hover:bg-emerald-500/20 transition-colors">
                                    <span className="block text-2xl font-black text-white">{tStats.pending}</span>
                                    <span className="text-[10px] font-bold text-amber-300 uppercase">Pending</span>
                                </div>
                                <div className="bg-emerald-500/10 backdrop-blur-sm p-4 rounded-2xl border border-emerald-500/20 text-center hover:bg-emerald-500/20 transition-colors">
                                    <span className="block text-2xl font-black text-white">{tStats.rejected}</span>
                                    <span className="text-[10px] font-bold text-red-300 uppercase">Rejected</span>
                                </div>
                                <div className="bg-emerald-500/10 backdrop-blur-sm p-4 rounded-2xl border border-emerald-500/20 text-center hover:bg-emerald-500/20 transition-colors">
                                    <span className="block text-2xl font-black text-white">{stats?.summary.totalFlows || 0}</span>
                                    <span className="text-[10px] font-bold text-sky-300 uppercase">Active Flows</span>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

            </div>
        </div>
    );
};

const PipelineListChart: React.FC<{ data: { id: string; name: string; totalLeads: number; stages: { name: string; count: number }[] }[]; onNavigateToPipeline?: (id: string) => void }> = ({ data, onNavigateToPipeline }) => {
    const hasData = data && data.length > 0 && data.some(d => d.totalLeads > 0);
    if (!hasData) return <EmptyStateChart text="No pipeline data available" />;

    return (
        <div className="flex flex-col gap-6 w-full h-full overflow-y-auto custom-scrollbar p-1 font-sans">
            {data.map((d, i) => {
                if (d.totalLeads === 0) return null;
                // bg colors for avatars
                const bgColors = ['bg-blue-100', 'bg-violet-100', 'bg-fuchsia-100', 'bg-rose-100', 'bg-amber-100', 'bg-emerald-100'];
                const textColors = ['text-blue-600', 'text-violet-600', 'text-fuchsia-600', 'text-rose-600', 'text-amber-600', 'text-emerald-600'];
                const avatarBg = bgColors[i % bgColors.length];
                const avatarText = textColors[i % textColors.length];

                return (
                    // Light mode: Clean container without heavy borders
                    <div key={i} className="flex flex-col gap-3 min-w-0 transition-colors">
                        {/* Header: Name + Total */}
                        <div className="flex items-center justify-between text-base">
                            <div className="flex items-center gap-3 overflow-hidden">
                                {/* Avatar */}
                                <div className={`w-10 h-10 rounded-full ${avatarBg} flex items-center justify-center shrink-0`}>
                                    <span className={`font-black text-sm ${avatarText}`}>{d.name.charAt(0).toUpperCase()}</span>
                                </div>
                                {/* Name */}
                                <span
                                    onClick={() => onNavigateToPipeline?.(d.id)}
                                    className="font-black text-slate-900 truncate tracking-tight cursor-pointer hover:underline text-lg"
                                    title={d.name}
                                >
                                    {d.name}
                                </span>
                            </div>
                            <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-600 font-mono font-black text-xs border border-indigo-100 whitespace-nowrap ml-2">{d.totalLeads} Leads</span>
                        </div>

                        {/* Stacked Bar Track (Light bg) */}
                        <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden relative flex border border-slate-100">
                            {d.stages.map((s, idx) => {
                                if (s.count === 0) return null;
                                const widthPct = (s.count / d.totalLeads) * 100;
                                const colorClass = ['bg-blue-500', 'bg-violet-500', 'bg-fuchsia-500', 'bg-rose-500', 'bg-amber-500', 'bg-emerald-500'][idx % 6];
                                return (
                                    <div
                                        key={idx}
                                        className={`h-full ${colorClass} first:rounded-l-full last:rounded-r-full hover:brightness-110 transition-all relative group/segment`}
                                        style={{ width: `${widthPct}%` }}
                                        title={`${s.name}: ${s.count}`}
                                    >
                                    </div>
                                );
                            })}
                        </div>

                        {/* Text Breakdown Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-0.5">
                            {d.stages.map((s, idx) => {
                                if (s.count === 0) return null;
                                const colorClass = ['bg-blue-500', 'bg-violet-500', 'bg-fuchsia-500', 'bg-rose-500', 'bg-amber-500', 'bg-emerald-500'][idx % 6];
                                return (
                                    <div key={idx} className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full shrink-0 ${colorClass} shadow-sm`}></div>
                                        <div className="flex flex-col leading-none">
                                            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide truncate max-w-[80px]">{s.name}</span>
                                            <span className="text-sm font-black text-slate-900">{s.count}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const TaskListBreakdown: React.FC<{ breakdown: Record<string, any>; totalDue: number; completed: number }> = ({ breakdown, totalDue, completed }) => {
    // Summing up from breakdown to get totals
    const pipelines = Object.values(breakdown || {});
    // Even if no data, we render 0s
    const todayCount = pipelines.reduce((sum: number, p: any) => sum + (p.today || 0), 0);
    const overdueCount = pipelines.reduce((sum: number, p: any) => sum + (p.overdue || 0), 0);
    const upcomingCount = Math.max(0, totalDue - overdueCount - todayCount);
    const completedCount = completed;

    // Chart Data
    const chartData = [
        { label: 'Due Today', value: todayCount, color: '#3b82f6' }, // Blue-500
        { label: 'Upcoming', value: upcomingCount, color: '#f59e0b' }, // Amber-500
        { label: 'Overdue', value: overdueCount, color: '#ef4444' }, // Red-500
        { label: 'Completed', value: completedCount, color: '#10b981' } // Emerald-500
    ];

    const total = Math.max(totalDue, 1); // Prevent div by zero for drawing empty ring

    // Donut Calc
    let currentAngle = 0;
    const radius = 35;
    const circumference = 2 * Math.PI * radius;

    return (
        <div className="flex items-center h-full w-full gap-4 px-2">

            {/* Left: Donut Chart */}
            <div className="relative w-40 h-40 shrink-0 flex items-center justify-center">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90 transform">
                    {/* Background Ring - Light */}
                    <circle cx="50" cy="50" r={radius} stroke="#e2e8f0" strokeWidth="12" fill="none" />

                    {/* Data Segments */}
                    {chartData.map((slice, i) => {
                        if (slice.value === 0) return null;
                        const sliceTotal = Math.max(chartData.reduce((acc, c) => acc + c.value, 0), 1);
                        const strokeDasharray = `${(slice.value / sliceTotal) * circumference} ${circumference}`;
                        const strokeDashoffset = -currentAngle * circumference;
                        currentAngle += slice.value / sliceTotal;

                        return (
                            <circle
                                key={i}
                                cx="50"
                                cy="50"
                                r={radius}
                                stroke={slice.color}
                                strokeWidth="12"
                                fill="none"
                                strokeDasharray={strokeDasharray}
                                strokeDashoffset={strokeDashoffset}
                                strokeLinecap="round"
                                className="transition-all duration-1000 ease-out"
                            />
                        );
                    })}
                </svg>
                {/* Center Text - Dark */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-4xl font-black text-slate-900">{totalDue}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Pending</span>
                </div>
            </div>

            {/* Right: Legend */}
            <div className="flex flex-col gap-3 flex-1 min-w-0 justify-center pl-2">
                {chartData.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between group p-1.5 rounded-lg hover:bg-slate-50 transition-colors cursor-default">
                        <div className="flex items-center gap-3">
                            <span className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: item.color }}></span>
                            <span className="text-xs font-bold text-slate-500 group-hover:text-slate-800 transition-colors uppercase tracking-wide">{item.label}</span>
                        </div>
                        <span className="text-sm font-black text-slate-900 font-mono">{item.value}</span>
                    </div>
                ))}
            </div>

        </div>
    );
};

export default Dashboard;
