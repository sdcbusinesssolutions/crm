import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface SheetAutomation {
    id: string;
    name: string;
    sheet_name: string;
    automation_type: 'schedule' | 'new_row';
    status: 'active' | 'paused';
    last_run_at: string | null;
}

interface SheetAutomationListProps {
    onCreate: () => void;
    onEdit: (id: string) => void;
}

const SheetAutomationList: React.FC<SheetAutomationListProps> = ({ onCreate, onEdit }) => {
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

    if (isLoading) return <div className="p-8">Loading...</div>;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-slate-700">Google Sheet Schedule ({automations.length})</h3>
                <div className="flex gap-2">
                    {/* Icons would go here */}
                    <button onClick={onCreate} className="px-3 py-1.5 bg-brand-600 text-white rounded text-sm font-medium hover:bg-brand-700 transition-colors">
                        + New
                    </button>
                    <button className="p-1.5 text-slate-500 hover:text-slate-700">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    </button>
                </div>
            </div>

            <table className="w-full text-sm">
                <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-left text-slate-500 font-medium">
                        <th className="px-4 py-3 w-10">#</th>
                        <th className="px-4 py-3">Schedule</th>
                        <th className="px-4 py-3">Next trigger ?</th>
                        <th className="px-4 py-3">Last Updated</th>
                        <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                </thead>
                <tbody>
                    {automations.map((auto, idx) => (
                        <tr key={auto.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                            <td className="px-4 py-3 text-slate-400">{idx + 1}</td>
                            <td className="px-4 py-3 font-medium text-brand-600">{auto.name}</td>
                            <td className="px-4 py-3 text-slate-600">
                                {auto.automation_type === 'schedule' ? 'Scheduled Check' : 'Polling (New Rows)'}
                            </td>
                            <td className="px-4 py-3 text-slate-500">
                                {auto.last_run_at ? new Date(auto.last_run_at).toLocaleString() : 'Never'}
                            </td>
                            <td className="px-4 py-3 text-right">
                                <button onClick={() => handleTrigger(auto.id)} className="text-orange-500 hover:text-orange-600 mr-3 font-medium text-xs">Trigger now</button>
                                <button onClick={() => onEdit(auto.id)} className="text-slate-400 hover:text-brand-600 mr-3 font-medium text-xs">Edit</button>
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
