import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { usePermissions, ACCESS_TYPES } from '../../modules/teamStaff/hooks/usePermissions';
import SheetAutomationReport from './SheetAutomationReport';
import VideoGuideButton from '../VideoGuideButton';

interface SheetAutomation {
    id: string;
    name: string;
    sheet_name: string;
    automation_type: 'schedule' | 'new_row';
    status: 'active' | 'paused';
    last_run_at: string | null;
    schedule_config?: {
        frequency: 'daily' | 'weekly' | 'monthly';
        time?: string;
        days?: string[];
        day_of_month?: number;
    };
}

interface SheetAutomationListProps {
    onCreate: () => void;
    onEdit: (id: string) => void;
    onToggleSidebar?: () => void;
}

const SheetAutomationList: React.FC<SheetAutomationListProps> = ({ onCreate, onEdit, onToggleSidebar }) => {
    const { hasAccess, canWrite: getCanWrite } = usePermissions();
    const canRead = hasAccess('G+Automation', ACCESS_TYPES.READ);
    const canWrite = getCanWrite('G+Automation');
    const canDelete = hasAccess('G+Automation', ACCESS_TYPES.ALL_ACCESS);

    const [automations, setAutomations] = useState<SheetAutomation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [viewReport, setViewReport] = useState<{ id: string, name: string } | null>(null);

    useEffect(() => {
        if (canRead) {
            fetchAutomations();
        } else {
            setIsLoading(false);
        }
    }, [canRead]);

    const fetchAutomations = async () => {
        try {
            const { data: session } = await supabase.auth.getSession();
            const token = session.session?.access_token;
            if (!token) return;

            const res = await fetch('/api/sheet-automations', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setAutomations(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this automation?')) return;
        try {
            const { data: session } = await supabase.auth.getSession();
            const token = session.session?.access_token;

            await fetch(`/api/sheet-automations/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            fetchAutomations();
        } catch (e) {
            console.error(e);
        }
    };

    const handleToggleStatus = async (auto: SheetAutomation) => {
        try {
            const { data: session } = await supabase.auth.getSession();
            const token = session.session?.access_token;
            if (!token) return;

            const newStatus = auto.status === 'active' ? 'paused' : 'active';
            const res = await fetch(`/api/sheet-automations/${auto.id}/status`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (res.ok) {
                fetchAutomations();
            } else {
                console.error('Failed to toggle status');
                alert('Failed to update status');
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleTrigger = async (id: string) => {
        try {
            const { data: session } = await supabase.auth.getSession();
            const token = session.session?.access_token;
            if (!token) return;

            const res = await fetch(`/api/sheet-automations/${id}/trigger`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                alert('Trigger executed successfully!');
                fetchAutomations(); // Refresh status/last run
            } else {
                const err = await res.json();
                alert('Trigger failed: ' + (err.error || 'Unknown error'));
            }
        } catch (e: any) {
            console.error(e);
            alert('Error triggering automation: ' + e.message);
        }
    };

    const handleDownloadReport = async (autoId: string) => {
        try {
            const { data: session } = await supabase.auth.getSession();
            const token = session.session?.access_token;
            
            const res = await fetch(`/api/sheet-automations/${autoId}/report`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!res.ok) throw new Error('Failed to download report');
            
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `automation_report_${autoId}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Error downloading report:', error);
            alert('Failed to download report');
        }
    };

    const getNextTrigger = (auto: SheetAutomation) => {
        if (auto.automation_type === 'new_row') return 'Checking every 5m';
        if (!auto.schedule_config || !auto.schedule_config.time) return 'Not Scheduled';

        const { frequency, time } = auto.schedule_config;
        const [hour, minute] = time.split(':').map(Number);

        // We calculate "Next" relative to NOW (in Browser Local Time, assumed to be user's IST or close enough for display)
        // Ideally we should use specific IST logic if we want to be 100% precise with the server, 
        // but showing it in Local Time is usually better for the user.
        const now = new Date();
        const next = new Date();
        next.setHours(hour, minute, 0, 0);

        if (frequency === 'daily') {
            if (next <= now) {
                next.setDate(next.getDate() + 1);
            }
        } else if (frequency === 'weekly' && auto.schedule_config.days) {
            // Find next matching day
            // const daysMap = { 'Sun': 0, 'Mon': 1, ... } // Simplified logic needed
            // For now, simpler to just show the Schedule Description for complex recurrence
            return `Weekly (${auto.schedule_config.days.join(', ')}) at ${time}`;
        } else if (frequency === 'monthly' && auto.schedule_config.day_of_month) {
            // Set day
            next.setDate(auto.schedule_config.day_of_month);
            if (next <= now) {
                next.setMonth(next.getMonth() + 1);
            }
        }

        if (frequency === 'weekly') return `Weekly (${auto.schedule_config.days?.join(', ')}) @ ${time}`;

        // Format
        return next.toLocaleString('en-US', {
            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
        });
    };

    if (isLoading) return <div className="p-8">Loading...</div>;

    if (!canRead) {
        return (
            <div className="flex flex-col w-full h-full bg-slate-50 font-sans text-slate-900 justify-center items-center p-8 min-h-[400px]">
                <div className="text-center max-w-sm">
                    <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100 shadow-sm">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    </div>
                    <h3 className="text-lg font-black text-slate-800 mb-1">Access Denied</h3>
                    <p className="text-sm text-slate-500 mb-4">You do not have the required permissions to view Google Sheet Automations. Please contact your administrator.</p>
                </div>
            </div>
        );
    }

    if (viewReport) {
        return (
            <SheetAutomationReport 
                automationId={viewReport.id} 
                automationName={viewReport.name}
                onBack={() => setViewReport(null)} 
            />
        );
    }

    return (
        <div className="flex flex-col w-full h-full bg-slate-50 font-sans text-slate-900 animate-fade-in relative overflow-hidden container-mobile-fix">
            {/* Header - Fixed to Top */}
            <div className="bg-white/80 backdrop-blur-md border-b border-slate-200 shrink-0 z-30 sticky top-0">
                <div className="px-4 sm:px-8 py-3 max-w-[1800px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3">
                            {onToggleSidebar && (
                                <button
                                    onClick={onToggleSidebar}
                                    className="lg:hidden p-2 -ml-1 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                                </button>
                            )}
                            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Google Sheet Schedule</h1>
                            <span className="hidden sm:inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-brand-50 text-brand-600 border border-brand-100">
                                {automations.length}
                            </span>
                        </div>
                        <p className="text-slate-500 text-sm mt-1 font-medium hidden sm:block">Automate your data syncs with Google Sheets.</p>
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <VideoGuideButton moduleName="G Automation" label="VIEW" className="!bg-red-600 hover:!bg-red-700 !text-white !rounded-full !text-[10px] animate-pulse shadow-md hover:shadow-lg" />
                        <button onClick={fetchAutomations} className="p-2.5 bg-white border border-slate-200 text-slate-500 hover:text-brand-600 hover:border-brand-200 rounded-xl transition-all shadow-sm" title="Refresh">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        </button>
                        {canWrite && (
                            <button onClick={onCreate} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-brand-200 hover:bg-brand-700 transition-all transform hover:-translate-y-0.5">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                <span>New Schedule</span>
                            </button>
                        )}
                        {!canWrite && (
                            <div className="px-4 py-2.5 bg-slate-100 text-slate-500 text-xs font-bold rounded-xl border border-slate-200 shadow-sm flex items-center gap-2">
                                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                Read Only Mode
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-8 pb-24">
                <div className="max-w-[1800px] mx-auto">
                    {/* Table Card */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm border-separate border-spacing-0">
                                <thead>
                                    <tr className="bg-brand-600 text-white shadow-md">
                                        <th className="px-6 py-5 text-left font-black uppercase tracking-wider text-xs text-white drop-shadow-sm !bg-brand-600 whitespace-nowrap">#</th>
                                        <th className="px-6 py-5 text-left font-black uppercase tracking-wider text-xs text-white drop-shadow-sm !bg-brand-600 whitespace-nowrap">Schedule Name</th>
                                        <th className="px-6 py-5 text-left font-black uppercase tracking-wider text-xs text-white drop-shadow-sm !bg-brand-600 whitespace-nowrap">Status</th>
                                        <th className="px-6 py-5 text-left font-black uppercase tracking-wider text-xs text-white drop-shadow-sm !bg-brand-600 whitespace-nowrap">Next Trigger</th>
                                        <th className="px-6 py-5 text-left font-black uppercase tracking-wider text-xs text-white drop-shadow-sm !bg-brand-600 whitespace-nowrap">Last Run</th>
                                        <th className="px-6 py-5 text-right font-black uppercase tracking-wider text-xs text-white drop-shadow-sm !bg-brand-600 whitespace-nowrap">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {automations.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-16 text-center">
                                                <div className="flex flex-col items-center justify-center text-slate-400 opacity-60">
                                                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                                        <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                                                    </div>
                                                     <h3 className="text-slate-800 font-bold mb-1">No Schedules Yet</h3>
                                                     <p className="text-sm mb-6 max-w-xs">Create an automated schedule to sync your Google Sheets with your contacts.</p>
                                                     {canWrite && (
                                                         <button onClick={onCreate} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-bold hover:border-brand-300 hover:text-brand-600 transition-all shadow-sm">
                                                             Create First Schedule
                                                         </button>
                                                     )}
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        automations.map((auto, idx) => {
                                            const isActive = auto.status === 'active';
                                            return (
                                                <tr
                                                    key={auto.id}
                                                    className={`transition-all duration-200 group ${isActive
                                                        ? 'bg-emerald-50/60 shadow-[inset_4px_0_0_0_#10b981]'
                                                        : 'bg-white hover:bg-slate-50 shadow-[inset_4px_0_0_0_transparent] hover:shadow-[inset_4px_0_0_0_#cbd5e1]'
                                                        }`}
                                                >
                                                    <td className="px-6 py-4 text-left text-slate-500 text-xs font-bold whitespace-nowrap">{idx + 1}</td>
                                                    <td className="px-6 py-4 text-left font-bold text-slate-800 group-hover:text-brand-600 transition-colors whitespace-nowrap">{auto.name}</td>
                                                    <td className="px-6 py-4 text-left whitespace-nowrap">
                                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide border ${isActive ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                                                            {isActive ? 'Active' : 'Paused'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-left text-slate-600 text-xs font-bold whitespace-nowrap">
                                                        {getNextTrigger(auto)}
                                                    </td>
                                                    <td className="px-6 py-4 text-left text-slate-500 text-xs font-medium whitespace-nowrap">
                                                        {auto.last_run_at ? new Date(auto.last_run_at).toLocaleString() : '-'}
                                                    </td>
                                                     <td className="px-6 py-4 text-right whitespace-nowrap">
                                                         <div className="flex items-center justify-end gap-2 text-right">
                                                             {canWrite && (
                                                                 <>
                                                                     <button
                                                                         onClick={() => handleToggleStatus(auto)}
                                                                         className={`p-2 rounded-lg transition-colors ${isActive
                                                                             ? 'text-emerald-600 hover:bg-emerald-100'
                                                                             : 'text-slate-400 hover:bg-slate-100 hover:text-brand-600'}`}
                                                                         title={isActive ? 'Pause' : 'Resume'}
                                                                     >
                                                                         {isActive ? (
                                                                             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                                         ) : (
                                                                             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                                         )}
                                                                     </button>
                                                                     <button onClick={() => handleTrigger(auto.id)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-brand-600 transition-colors" title="Test Run">
                                                                         <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                                                     </button>
                                                                     <button onClick={() => handleDownloadReport(auto.id)} className="p-2 rounded-lg hover:bg-green-50 text-slate-400 hover:text-green-600 transition-colors" title="Download CSV">
                                                                         <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                                     </button>
                                                                     <button onClick={() => setViewReport({ id: auto.id, name: auto.name })} className="p-2 rounded-lg hover:bg-purple-50 text-slate-400 hover:text-purple-600 transition-colors" title="View Report">
                                                                         <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                                     </button>
                                                                     <button onClick={() => onEdit(auto.id)} className="p-2 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors" title="Edit">
                                                                         <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                                     </button>
                                                                 </>
                                                             )}
                                                             {canDelete && (
                                                                 <button onClick={() => handleDelete(auto.id)} className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors" title="Delete">
                                                                     <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                                 </button>
                                                             )}
                                                         </div>
                                                     </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div >
    );
};

export default SheetAutomationList;
