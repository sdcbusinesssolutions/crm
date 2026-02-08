import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

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
    const [automations, setAutomations] = useState<SheetAutomation[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchAutomations();
    }, []);

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

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white">
                <div className="flex items-center gap-3">
                    {onToggleSidebar && (
                        <button
                            onClick={onToggleSidebar}
                            className="lg:hidden p-1.5 -ml-1 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                        </button>
                    )}
                    <h3 className="text-lg font-bold text-slate-800">Google Sheet Schedule ({automations.length})</h3>
                </div>
                <div className="flex gap-2">
                    <button onClick={onCreate} className="flex items-center gap-1 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-bold hover:bg-brand-700 transition-all shadow-sm shadow-brand-200">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        New Schedule
                    </button>
                    <button onClick={fetchAutomations} className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors" title="Refresh">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto flex-1 p-4">
                <table className="w-full text-sm border-separate border-spacing-0">
                    <thead>
                        <tr className="shadow-sm">
                            <th className="px-6 py-4 w-16 text-center font-bold uppercase tracking-wider text-[11px] bg-brand-600 text-white rounded-tl-lg rounded-bl-lg border-r border-brand-700/30">#</th>
                            <th className="px-6 py-4 font-bold uppercase tracking-wider text-[11px] bg-brand-600 text-white border-r border-brand-700/30">Schedule Name</th>
                            <th className="px-6 py-4 text-center font-bold uppercase tracking-wider text-[11px] bg-brand-600 text-white border-r border-brand-700/30">Status</th>
                            <th className="px-6 py-4 font-bold uppercase tracking-wider text-[11px] bg-brand-600 text-white border-r border-brand-700/30">Next Trigger</th>
                            <th className="px-6 py-4 font-bold uppercase tracking-wider text-[11px] bg-brand-600 text-white border-r border-brand-700/30">Last Run</th>
                            <th className="px-6 py-4 text-right font-bold uppercase tracking-wider text-[11px] bg-brand-600 text-white rounded-tr-lg rounded-br-lg">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {automations.map((auto, idx) => (
                            <tr key={auto.id} className="hover:bg-slate-50 transition-colors group">
                                <td className="px-6 py-4 text-center text-slate-400 text-xs border-b border-slate-100">{idx + 1}</td>
                                <td className="px-6 py-4 font-bold text-slate-700 group-hover:text-brand-600 transition-colors border-b border-slate-100">{auto.name}</td>
                                <td className="px-6 py-4 text-center border-b border-slate-100">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${auto.status === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-100 text-slate-500 border-slate-200'
                                        }`}>
                                        {auto.status === 'active' ? '● Active' : '○ Paused'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-slate-600 text-xs font-medium border-b border-slate-100">
                                    {getNextTrigger(auto)}
                                </td>
                                <td className="px-6 py-4 text-slate-500 text-xs border-b border-slate-100">
                                    {auto.last_run_at ? new Date(auto.last_run_at).toLocaleString() : '-'}
                                </td>
                                <td className="px-6 py-4 text-right border-b border-slate-100">
                                    <div className="flex items-center justify-end gap-2 text-right">
                                        <button
                                            onClick={() => handleToggleStatus(auto)}
                                            className="p-1 text-slate-400 hover:text-brand-600 transition-colors"
                                            title={auto.status === 'active' ? 'Pause' : 'Resume'}
                                        >
                                            {auto.status === 'active' ? (
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            ) : (
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            )}
                                        </button>
                                        <button onClick={() => handleTrigger(auto.id)} className="p-1 text-slate-400 hover:text-brand-600 transition-colors" title="Test Run">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                        </button>
                                        <button onClick={() => onEdit(auto.id)} className="p-1 text-slate-400 hover:text-blue-500 transition-colors" title="Edit">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                        </button>
                                        <button onClick={() => handleDelete(auto.id)} className="p-1 text-slate-400 hover:text-red-500 transition-colors" title="Delete">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {automations.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                    </div>
                    <h3 className="text-slate-800 font-bold mb-1">No Schedules Yet</h3>
                    <p className="text-slate-400 text-sm mb-6 max-w-xs">Create an automated schedule to sync your Google Sheets with your contacts.</p>
                    <button onClick={onCreate} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-bold hover:border-brand-300 hover:text-brand-600 transition-all shadow-sm">
                        Create First Schedule
                    </button>
                </div>
            )}
        </div>
    );
};

export default SheetAutomationList;
