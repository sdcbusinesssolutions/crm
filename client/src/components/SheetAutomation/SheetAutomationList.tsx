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
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div className="flex items-center gap-3">
                    {onToggleSidebar && (
                        <button
                            onClick={onToggleSidebar}
                            className="lg:hidden p-1.5 -ml-1 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                        </button>
                    )}
                    <h3 className="font-bold text-slate-700">Google Sheet Schedule ({automations.length})</h3>
                </div>
                <div className="flex gap-2">
                    <button onClick={onCreate} className="px-3 py-1.5 bg-brand-600 text-white rounded text-sm font-medium hover:bg-brand-700 transition-colors">
                        + New
                    </button>
                    <button onClick={fetchAutomations} className="p-1.5 text-slate-500 hover:text-slate-700" title="Refresh">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    </button>
                </div>
            </div>

            <table className="w-full text-sm">
                <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-left text-slate-500 font-medium">
                        <th className="px-4 py-3 w-10">#</th>
                        <th className="px-4 py-3">Schedule Name</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Next Trigger</th>
                        <th className="px-4 py-3">Last Run</th>
                        <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                </thead>
                <tbody>
                    {automations.map((auto, idx) => (
                        <tr key={auto.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                            <td className="px-4 py-3 text-slate-400">{idx + 1}</td>
                            <td className="px-4 py-3 font-medium text-brand-600">{auto.name}</td>
                            <td className="px-4 py-3">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${auto.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
                                    }`}>
                                    {auto.status === 'active' ? 'Active' : 'Paused'}
                                </span>
                            </td>
                            <td className="px-4 py-3 text-slate-600 font-mono text-xs">
                                {getNextTrigger(auto)}
                            </td>
                            <td className="px-4 py-3 text-slate-500 text-xs">
                                {auto.last_run_at ? new Date(auto.last_run_at).toLocaleString() : 'Never'}
                            </td>
                            <td className="px-4 py-3 text-right flex items-center justify-end gap-2">
                                <button
                                    onClick={() => handleToggleStatus(auto)}
                                    className={`text-xs font-medium px-2 py-1 rounded border ${auto.status === 'active'
                                        ? 'border-yellow-200 text-yellow-600 hover:bg-yellow-50'
                                        : 'border-green-200 text-green-600 hover:bg-green-50'
                                        }`}
                                >
                                    {auto.status === 'active' ? 'Pause' : 'Resume'}
                                </button>
                                <button onClick={() => handleTrigger(auto.id)} className="text-orange-500 hover:text-orange-600 font-medium text-xs">Test</button>
                                <button onClick={() => onEdit(auto.id)} className="text-slate-400 hover:text-brand-600 font-medium text-xs">Edit</button>
                                <button onClick={() => handleDelete(auto.id)} className="text-slate-400 hover:text-red-600 font-medium text-xs">Delete</button>
                            </td>
                        </tr>
                    ))}
                    {automations.length === 0 && (
                        <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-slate-400 italic">
                                No automations found. Click "+ New" to create one.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};

export default SheetAutomationList;
