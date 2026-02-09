import React, { useState, useEffect } from 'react';
import { followUpService, FollowUp } from '../../services/followUpService';
import { getTasks, updateTask, deleteTask } from '../../services/lead-management-api';
import FollowUpForm from './FollowUpForm';
import { format, isToday, isPast, isFuture, parseISO, isSameDay } from 'date-fns';

// Extended interface to support both FollowUps and CRM Tasks
interface UnifiedTask extends FollowUp {
    source: 'follow_up' | 'crm_task';
    original_data?: any;
    pipeline_name?: string;
}

const FollowUpManager: React.FC = () => {
    const [followUps, setFollowUps] = useState<UnifiedTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'today' | 'upcoming' | 'overdue' | 'completed'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingFollowUp, setEditingFollowUp] = useState<UnifiedTask | null>(null);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        loadFollowUps();
    }, []);

    const loadFollowUps = async () => {
        setLoading(true);
        try {
            const [followUpData, pipelineTasks] = await Promise.all([
                followUpService.getFollowUps(),
                getTasks()
            ]);

            const normalizedFollowUps: UnifiedTask[] = followUpData.map(f => ({
                ...f,
                source: 'follow_up'
            }));

            const normalizedTasks: UnifiedTask[] = pipelineTasks.map((t: any) => {
                const pipelineData = t.leads?.pipelines;
                const pipelineName = Array.isArray(pipelineData) ? pipelineData[0]?.name : pipelineData?.name;

                return {
                    id: t.id,
                    contact_id: t.lead_id, // Use lead_id as contact_id for keying purposes
                    title: t.title,
                    description: t.description,
                    scheduled_at: t.due_date,
                    status: t.is_completed ? 'COMPLETED' : 'PENDING',
                    priority: 'MEDIUM',
                    type: 'TASK',
                    created_at: t.created_at || new Date().toISOString(),
                    source: 'crm_task',
                    original_data: t,
                    pipeline_name: pipelineName,
                    contacts: t.leads ? {
                        name: t.leads.name,
                        phone: t.leads.phone
                    } : undefined
                };
            });

            // Merge and Sort by Date (scheduled_at)
            const merged = [...normalizedFollowUps, ...normalizedTasks].sort((a, b) => {
                const dateA = new Date(a.scheduled_at || 0).getTime();
                const dateB = new Date(b.scheduled_at || 0).getTime();
                return dateA - dateB;
            });

            setFollowUps(merged);
        } catch (error) {
            console.error('Failed to load tasks', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (data: Partial<FollowUp>) => {
        try {
            if (editingFollowUp) {
                if (editingFollowUp.source === 'crm_task') {
                    // Update Pipeline Task
                    await updateTask(editingFollowUp.id, {
                        title: data.title,
                        description: data.description,
                        due_date: data.scheduled_at,
                        is_completed: data.status === 'COMPLETED'
                    });
                } else {
                    // Update FollowUp
                    await followUpService.updateFollowUp(editingFollowUp.id, data);
                }
            } else {
                // Create New (Always create as standard FollowUp for now via this UI)
                await followUpService.createFollowUp(data);
            }
            setIsModalOpen(false);
            loadFollowUps();
        } catch (error) {
            console.error('Failed to save task', error);
            alert('Failed to save task.');
        }
    };

    const handleDelete = async (id: string, source: 'follow_up' | 'crm_task') => {
        if (!window.confirm('Are you sure?')) return;
        try {
            if (source === 'crm_task') {
                await deleteTask(id);
            } else {
                await followUpService.deleteFollowUp(id);
            }
            loadFollowUps();
        } catch (error) {
            console.error('Failed to delete task', error);
        }
    };

    const handleToggleStatus = async (item: UnifiedTask) => {
        const originalStatus = item.status;
        const newStatus = item.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';

        // Optimistic Update
        setFollowUps(prev => prev.map(p => p.id === item.id ? { ...p, status: newStatus } : p));

        try {
            if (item.source === 'crm_task') {
                await updateTask(item.id, { is_completed: newStatus === 'COMPLETED' });
            } else {
                await followUpService.updateFollowUp(item.id, { status: newStatus });
            }
        } catch (error: any) {
            console.error('Failed to update status', error);
            setFollowUps(prev => prev.map(p => p.id === item.id ? { ...p, status: originalStatus } : p));
            alert('Failed to update task status.');
        }
    };

    const handleExport = () => {
        if (followUps.length === 0) return;

        const headers = ['Status', 'Title', 'Description', 'Contact Name', 'Contact Phone', 'Due Date', 'Source', 'Pipeline'];
        const csvRows = [headers.join(',')];

        followUps.forEach(item => {
            const row = [
                item.status,
                `"${(item.title || '').replace(/"/g, '""')}"`,
                `"${(item.description || '').replace(/"/g, '""')}"`,
                `"${(item.contacts?.name || '').replace(/"/g, '""')}"`,
                `"${(item.contacts?.phone || '').replace(/"/g, '""')}"`,
                `"${new Date(item.scheduled_at).toLocaleString()}"`,
                item.source === 'crm_task' ? 'Pipeline Task' : 'Follow-Up',
                `"${(item.pipeline_name || '-').replace(/"/g, '""')}"`
            ];
            csvRows.push(row.join(','));
        });

        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tasks-export-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    // --- Statistics Calculations ---
    const stats = {
        all: followUps.filter(i => i.status !== 'COMPLETED').length,
        today: followUps.filter(i => i.status !== 'COMPLETED' && isToday(parseISO(i.scheduled_at)) && !isPast(parseISO(i.scheduled_at))).length,
        upcoming: followUps.filter(i => i.status !== 'COMPLETED' && isFuture(parseISO(i.scheduled_at)) && !isToday(parseISO(i.scheduled_at))).length,
        overdue: followUps.filter(i => i.status !== 'COMPLETED' && isPast(parseISO(i.scheduled_at))).length,
        completed: followUps.filter(i => i.status === 'COMPLETED').length
    };

    // --- Filtering & Searching ---
    const filteredItems = followUps.filter(item => {
        // 1. Filter Tab
        if (filter === 'all' && item.status === 'COMPLETED') return false;
        if (filter === 'completed' && item.status !== 'COMPLETED') return false;
        if (filter === 'today' && (item.status === 'COMPLETED' || !isToday(parseISO(item.scheduled_at)) || isPast(parseISO(item.scheduled_at)))) return false;
        if (filter === 'overdue' && (item.status === 'COMPLETED' || !isPast(parseISO(item.scheduled_at)))) return false;
        if (filter === 'upcoming' && (item.status === 'COMPLETED' || !isFuture(parseISO(item.scheduled_at)) || isToday(parseISO(item.scheduled_at)))) return false;

        // 2. Search
        if (searchTerm) {
            const query = searchTerm.toLowerCase();
            return (
                item.title?.toLowerCase().includes(query) ||
                item.description?.toLowerCase().includes(query) ||
                item.contacts?.name?.toLowerCase().includes(query) ||
                item.contacts?.phone?.includes(query) ||
                (item.source === 'crm_task' && 'pipeline task'.includes(query)) ||
                item.pipeline_name?.toLowerCase().includes(query)
            );
        }
        return true;
    });

    // Pagination Logic
    const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
    const paginatedItems = filteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // Helper for Initials
    const getInitials = (name: string) => {
        return name ? name.substring(0, 2).toUpperCase() : '??';
    };

    return (
        <div className="h-full flex flex-col bg-slate-50 p-6 overflow-hidden font-sans">
            {/* Header */}
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Follow-up</h1>
                    <p className="text-slate-500 text-sm mt-1">You have total <span className="font-bold text-slate-800">{stats.all} Active Tasks</span></p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleExport}
                        className="px-4 py-2 bg-white border border-green-500 text-green-600 rounded-lg hover:bg-green-50 font-bold flex items-center gap-2 shadow-sm transition"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        Export
                    </button>
                    <button
                        onClick={() => { setEditingFollowUp(null); setIsModalOpen(true); }}
                        className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 shadow-md transition font-bold flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        Create Follow-up
                    </button>
                </div>
            </div>

            {/* Status Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                {/* ALL ACTIVE */}
                <div
                    onClick={() => setFilter('all')}
                    className={`bg-white p-4 rounded-xl border-2 cursor-pointer transition-all ${filter === 'all' ? 'border-green-500 shadow-md ring-1 ring-green-100' : 'border-slate-200 hover:border-green-300'}`}
                >
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">ALL ACTIVE</div>
                    <div className="text-3xl font-extrabold text-slate-800">{stats.all}</div>
                </div>

                {/* DUE TODAY */}
                <div
                    onClick={() => setFilter('today')}
                    className={`bg-blue-50 p-4 rounded-xl border-2 cursor-pointer transition-all ${filter === 'today' ? 'border-blue-500 shadow-md' : 'border-blue-100 hover:border-blue-300'}`}
                >
                    <div className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-2">DUE TODAY</div>
                    <div className="text-3xl font-extrabold text-blue-700">{stats.today}</div>
                </div>

                {/* UPCOMING */}
                <div
                    onClick={() => setFilter('upcoming')}
                    className={`bg-purple-50 p-4 rounded-xl border-2 cursor-pointer transition-all ${filter === 'upcoming' ? 'border-purple-500 shadow-md' : 'border-purple-100 hover:border-purple-300'}`}
                >
                    <div className="text-xs font-bold text-purple-500 uppercase tracking-wider mb-2">UPCOMING</div>
                    <div className="text-3xl font-extrabold text-purple-700">{stats.upcoming}</div>
                </div>

                {/* OVERDUE */}
                <div
                    onClick={() => setFilter('overdue')}
                    className={`bg-amber-50 p-4 rounded-xl border-2 cursor-pointer transition-all ${filter === 'overdue' ? 'border-amber-500 shadow-md' : 'border-amber-100 hover:border-amber-300'}`}
                >
                    <div className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-2">OVERDUE</div>
                    <div className="text-3xl font-extrabold text-amber-700">{stats.overdue}</div>
                </div>

                {/* COMPLETED */}
                <div
                    onClick={() => setFilter('completed')}
                    className={`bg-green-50 p-4 rounded-xl border-2 cursor-pointer transition-all ${filter === 'completed' ? 'border-green-500 shadow-md' : 'border-green-100 hover:border-green-300'}`}
                >
                    <div className="text-xs font-bold text-green-600 uppercase tracking-wider mb-2">COMPLETED</div>
                    <div className="text-3xl font-extrabold text-green-700">{stats.completed}</div>
                </div>
            </div>

            {/* Table Section */}
            <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Table Top Bar */}
                <div className="p-4 flex justify-between items-center border-b border-slate-100">
                    <h3 className="font-bold text-lg text-slate-800">All Tasks</h3>
                    <div className="relative w-64">
                        <input
                            type="text"
                            placeholder="Search tasks..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-green-500 focus:border-green-500 transition"
                        />
                        <svg className="w-5 h-5 text-slate-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                </div>

                {/* Main Table */}
                <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-left">
                        <thead className="bg-[#00A884] text-white uppercase text-xs font-bold tracking-wider sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-4 w-16">Status</th>
                                <th className="px-6 py-4">Title & Description</th>
                                <th className="px-6 py-4">Contact</th>
                                <th className="px-6 py-4">Pipeline</th>
                                <th className="px-6 py-4">Due Date</th>
                                <th className="px-6 py-4 text-right">Option</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {paginatedItems.map(item => {
                                const isOverdue = item.status !== 'COMPLETED' && isPast(parseISO(item.scheduled_at)) && !isToday(parseISO(item.scheduled_at));
                                const activeDrip = item.contacts?.drip_enrollments?.find(d => d.status === 'ACTIVE');

                                return (
                                    <tr key={item.id} className="hover:bg-slate-50 transition group">
                                        <td className="px-6 py-4">
                                            <input
                                                type="checkbox"
                                                checked={item.status === 'COMPLETED'}
                                                onChange={() => handleToggleStatus(item)}
                                                className="w-5 h-5 rounded border-slate-300 text-green-600 focus:ring-green-500 cursor-pointer"
                                            />
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="font-bold text-slate-800">{item.title}</div>
                                                {item.source === 'crm_task' && (
                                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-bold border border-blue-100">CRM</span>
                                                )}
                                            </div>
                                            <div className="text-xs text-slate-500 line-clamp-1">{item.description || 'No description'}</div>
                                            {item.recurrence_rule && (
                                                <div className="text-[10px] text-green-600 font-bold flex items-center gap-1 mt-1 uppercase">
                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                                    Recurring ({item.recurrence_rule.frequency})
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {item.contacts ? (
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold border border-green-200">
                                                        {getInitials(item.contacts.name)}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-bold text-slate-800">{item.contacts.name}</div>
                                                        <div className="text-xs text-slate-500">{item.contacts.phone}</div>
                                                        {activeDrip && (
                                                            <div className="mt-1 flex flex-col gap-0.5">
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 w-fit">
                                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                                                    </svg>
                                                                    {activeDrip.drip_campaigns?.name || 'Sequence Active'}
                                                                </span>
                                                                <span className="text-[10px] text-slate-400 pl-1">
                                                                    Ends: {new Date(activeDrip.stop_at).toLocaleDateString()}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : <span className="text-slate-400 italic text-xs">-</span>}
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 text-sm">
                                            {item.pipeline_name || '-'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1 rounded text-xs font-bold
                                                ${isOverdue ? 'bg-red-100 text-red-600' :
                                                    item.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                                                        isToday(parseISO(item.scheduled_at)) ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}
                                            `}>
                                                {format(parseISO(item.scheduled_at), 'MMM d, yyyy h:mm a')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-4">
                                                {item.status !== 'COMPLETED' && (
                                                    <button onClick={() => handleToggleStatus(item)} className="text-xs font-bold text-green-600 hover:text-green-700 hover:underline">
                                                        Mark Done
                                                    </button>
                                                )}
                                                <button onClick={() => { setEditingFollowUp(item); setIsModalOpen(true); }} className="text-slate-400 hover:text-blue-600">
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                </button>
                                                <button onClick={() => handleDelete(item.id, item.source)} className="text-slate-400 hover:text-red-500">
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                            {paginatedItems.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="text-center py-12 text-slate-400">
                                        No tasks found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Footer */}
                <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
                    <p className="text-sm text-slate-500">
                        Showing <span className="font-bold">{paginatedItems.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}</span> to <span className="font-bold">{Math.min(currentPage * itemsPerPage, filteredItems.length)}</span> of <span className="font-bold">{filteredItems.length}</span> entries
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1 border border-slate-300 rounded bg-white text-sm text-slate-600 disabled:opacity-50"
                        >
                            Previous
                        </button>
                        <button
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages || totalPages === 0}
                            className="px-3 py-1 border border-slate-300 rounded bg-white text-sm text-slate-600 disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-fade-in-up">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-green-50">
                            <h3 className="font-bold text-lg text-green-900">
                                {editingFollowUp ? 'Edit Follow-Up' : 'Create New Follow-Up'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="p-6 max-h-[80vh] overflow-y-auto">
                            <FollowUpForm
                                initialData={editingFollowUp || {}}
                                onSave={handleSave}
                                onCancel={() => setIsModalOpen(false)}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FollowUpManager;
