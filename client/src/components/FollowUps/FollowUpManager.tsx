import React, { useState, useEffect } from 'react';
import { followUpService, FollowUp } from '../../services/followUpService';
import { getTasks, updateTask, deleteTask } from '../../services/lead-management-api';
import FollowUpForm from './FollowUpForm';
import { format, isToday, isPast, isFuture, parseISO, isSameDay } from 'date-fns';
import SendWhatsAppMessageModal from '../SendWhatsAppMessageModal';
import EmailModal from '../EmailModal';
import LeadEditModal from '../LeadEditModal';
import { TriggerIcon } from '../icons';
import { usePermissions, ACCESS_TYPES } from '../../modules/teamStaff/hooks/usePermissions';

interface FollowUpManagerProps {
    onNavigate?: (item: any) => void;
    initialView?: 'list' | 'form';
}

// Extended interface to support both FollowUps and CRM Tasks
interface UnifiedTask extends FollowUp {
    source: 'follow_up' | 'crm_task';
    original_data?: any;
    pipeline_name?: string;
}

const FollowUpManager: React.FC<FollowUpManagerProps> = ({ onNavigate, initialView = 'list' }) => {
    const { hasAccess } = usePermissions();
    const canRead = hasAccess('Follow-up', ACCESS_TYPES.READ);
    const canWrite = hasAccess('Follow-up', ACCESS_TYPES.READ_WRITE);
    const canDelete = hasAccess('Follow-up', ACCESS_TYPES.ALL_ACCESS);

    const [view, setView] = useState<'list' | 'form'>(initialView);
    const [followUps, setFollowUps] = useState<UnifiedTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'today' | 'upcoming' | 'overdue' | 'completed'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [editingFollowUp, setEditingFollowUp] = useState<UnifiedTask | null>(null);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // WhatsApp Modal State
    const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
    const [selectedChatPhone, setSelectedChatPhone] = useState('');
    const [selectedChatName, setSelectedChatName] = useState('');
    
    // Email Modal State
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [selectedEmail, setSelectedEmail] = useState('');
    const [selectedEmailName, setSelectedEmailName] = useState('');

    // Lead Edit Modal State
    const [isLeadEditModalOpen, setIsLeadEditModalOpen] = useState(false);
    const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

    useEffect(() => {
        if (canRead) {
            loadFollowUps();
        }
    }, [canRead]);

    if (!canRead) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 h-full p-8 text-center bg-slate-50 font-sans">
                <div className="w-20 h-20 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-6 border border-red-100 text-red-500">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </div>
                <h2 className="text-2xl font-bold mb-2 text-slate-900">Access Denied</h2>
                <p className="max-w-md mx-auto text-slate-500 font-medium">You do not have permission to view or manage Follow-ups. Please contact your administrator if you believe this is an error.</p>
            </div>
        );
    }

    const loadFollowUps = async () => {
        setLoading(true);
        try {
            const [followUpData, pipelineTasks] = await Promise.all([
                followUpService.getFollowUps(),
                getTasks()
            ]);

            const filteredFollowUpData = followUpData.filter(f => !(f.title || '').startsWith('[QUICK_ALARM]'));

            const normalizedFollowUps: UnifiedTask[] = filteredFollowUpData.map(f => ({
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

    const handleSave = async (data: any) => {
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
                    const primaryContactId = data.contact_ids?.[0] || editingFollowUp.contact_id;
                    await followUpService.updateFollowUp(editingFollowUp.id, {
                        ...data,
                        contact_id: primaryContactId
                    });

                    // If more contacts were added during edit, create NEW tasks for them
                    if (data.contact_ids && data.contact_ids.length > 1) {
                        const extraIds = data.contact_ids.filter((id: string) => id && id !== primaryContactId);
                        const promises = extraIds.map((cid: string) =>
                            followUpService.createFollowUp({
                                ...data,
                                contact_id: cid
                            })
                        );
                        await Promise.all(promises);
                    }
                }
            } else if (data.contact_ids && data.contact_ids.length > 0) {
                // Create New for Multiple Contacts (one follow-up per contact)
                const validContactIds = data.contact_ids.filter(Boolean);
                const promises = validContactIds.map((cid: string) =>
                    followUpService.createFollowUp({
                        ...data,
                        contact_id: cid
                    })
                );
                await Promise.all(promises);
            } else {
                // Create New (Always create as standard FollowUp for now via this UI)
                await followUpService.createFollowUp(data);
            }
            setView('list');
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
        today: followUps.filter(i => i.status !== 'COMPLETED' && i.scheduled_at && isToday(parseISO(i.scheduled_at)) && !isPast(parseISO(i.scheduled_at))).length,
        upcoming: followUps.filter(i => i.status !== 'COMPLETED' && i.scheduled_at && isFuture(parseISO(i.scheduled_at)) && !isToday(parseISO(i.scheduled_at))).length,
        overdue: followUps.filter(i => i.status !== 'COMPLETED' && i.scheduled_at && isPast(parseISO(i.scheduled_at))).length,
        completed: followUps.filter(i => i.status === 'COMPLETED').length
    };

    // --- Filtering & Searching ---
    const filteredItems = followUps.filter(item => {
        // 1. Filter Tab
        if (filter === 'all' && item.status === 'COMPLETED') return false;
        if (filter === 'completed' && item.status !== 'COMPLETED') return false;
        if (filter === 'today' && (item.status === 'COMPLETED' || !item.scheduled_at || !isToday(parseISO(item.scheduled_at)) || isPast(parseISO(item.scheduled_at)))) return false;
        if (filter === 'overdue' && (item.status === 'COMPLETED' || !item.scheduled_at || !isPast(parseISO(item.scheduled_at)))) return false;
        if (filter === 'upcoming' && (item.status === 'COMPLETED' || !item.scheduled_at || !isFuture(parseISO(item.scheduled_at)) || isToday(parseISO(item.scheduled_at)))) return false;

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

    // --- RENDER FORM VIEW ---
    if (view === 'form') {
        return (
            <div className="h-full flex flex-col bg-slate-50 p-4 sm:p-6 overflow-hidden font-sans">
                {/* Header */}
                <div className="flex items-center gap-4 mb-4">
                    <button
                        onClick={() => setView('list')}
                        className="bg-white p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-300 transition-all shadow-sm group"
                    >
                        <svg className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight">
                            {editingFollowUp ? 'Edit Follow-Up' : 'Create New Follow-Up'}
                        </h1>
                        <p className="text-slate-500 text-sm font-medium">Fill in the details below to schedule your task.</p>
                    </div>
                </div>

                {/* Form Container */}
                <div className="flex-1 overflow-y-auto w-full pb-6 custom-scrollbar">
                    <div className="max-w-[1400px] w-full mx-auto xs:px-2 sm:px-4 md:px-6">
                        <FollowUpForm
                            initialData={editingFollowUp || {}}
                            onSave={handleSave}
                            onCancel={() => setView('list')}
                            onNavigate={onNavigate}
                        />
                    </div>
                </div>
            </div>
        );
    }

    // --- RENDER LIST VIEW ---
    return (
        <div className="h-full flex flex-col bg-slate-50 p-6 overflow-hidden font-sans">
            {/* Header */}
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Follow-up</h1>
                    <p className="text-slate-500 text-sm mt-1">You have total <span className="font-bold text-slate-800">{stats.all} Active Tasks</span></p>
                </div>
                <div className="flex items-center gap-3">
                    {!canWrite && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 shadow-sm animate-fade-in select-none">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                            Read Only Mode
                        </span>
                    )}
                    <button
                        onClick={handleExport}
                        className="px-4 py-2 bg-white border border-green-500 text-green-600 rounded-lg hover:bg-green-50 font-bold flex items-center gap-2 shadow-sm transition"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        Export
                    </button>
                    <button
                        onClick={() => onNavigate && onNavigate('Drip Campaigns')}
                        className="px-4 py-2 bg-white border border-purple-500 text-purple-600 rounded-lg hover:bg-purple-50 font-bold flex items-center gap-2 shadow-sm transition"
                    >
                        <TriggerIcon className="w-4 h-4" />
                        Drip Campaigns
                    </button>
                    {canWrite && (
                        <button
                            onClick={() => { setEditingFollowUp(null); setView('form'); }}
                            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 shadow-md transition font-bold flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            Create Follow-up
                        </button>
                    )}
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
                                                disabled={!canWrite}
                                                className="w-5 h-5 rounded border-slate-300 text-green-600 focus:ring-green-500 cursor-pointer disabled:opacity-50"
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
                                            <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                                Created by: <span className="font-semibold text-slate-500">{item.created_by_name || 'System'}</span> at {format(parseISO(item.created_at), 'MMM d, yyyy h:mm a')}
                                            </div>
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
                                                        <div className="flex items-center gap-2">
                                                            <div 
                                                                className="text-sm font-bold text-slate-800 cursor-pointer hover:text-green-600 hover:underline transition-colors"
                                                                onClick={() => {
                                                                    if (item.contact_id) {
                                                                        setSelectedLeadId(item.contact_id);
                                                                        setIsLeadEditModalOpen(true);
                                                                    }
                                                                }}
                                                            >
                                                                {item.contacts.name}
                                                            </div>
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (item.contact_id) {
                                                                        setSelectedLeadId(item.contact_id);
                                                                        setIsLeadEditModalOpen(true);
                                                                    }
                                                                }}
                                                                className="flex items-center justify-center w-6 h-6 rounded-md bg-blue-100 text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                                                title="Edit Contact Info"
                                                            >
                                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                            </button>
                                                        </div>
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
                                                {item.status !== 'COMPLETED' && canWrite && (
                                                    <button onClick={() => handleToggleStatus(item)} className="text-xs font-bold text-green-600 hover:text-green-700 hover:underline">
                                                        Mark Done
                                                    </button>
                                                )}
                                                {canWrite && (
                                                    <button onClick={() => { setEditingFollowUp(item); setView('form'); }} className="p-1.5 rounded-md text-slate-500 bg-slate-100 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Edit Task">
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                    </button>
                                                )}
                                                {canWrite && (
                                                    <button 
                                                        onClick={(e) => { 
                                                            e.stopPropagation(); 
                                                            if (!item.contacts?.phone) return;
                                                            setSelectedChatPhone(item.contacts.phone); 
                                                            setSelectedChatName(item.contacts.name || ''); 
                                                            setIsWhatsAppModalOpen(true); 
                                                        }} 
                                                        className={`p-1.5 rounded-md transition-colors ${item.contacts?.phone ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-700' : 'text-slate-300 bg-slate-50 cursor-not-allowed'}`}
                                                        title={item.contacts?.phone ? "Send WhatsApp Message" : "No phone number"}
                                                        disabled={!item.contacts?.phone}
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                                                    </button>
                                                )}
                                                {canWrite && (
                                                    <button 
                                                        onClick={(e) => { 
                                                            e.stopPropagation(); 
                                                            if (!item.contacts?.email) return;
                                                            setSelectedEmail(item.contacts.email); 
                                                            setSelectedEmailName(item.contacts.name || ''); 
                                                            setIsEmailModalOpen(true); 
                                                        }} 
                                                        className={`p-1.5 rounded-md transition-colors ${item.contacts?.email ? 'text-blue-600 bg-blue-50 hover:bg-blue-100 hover:text-blue-700' : 'text-slate-300 bg-slate-50 cursor-not-allowed'}`}
                                                        title={item.contacts?.email ? "Send Email" : "No email address"}
                                                        disabled={!item.contacts?.email}
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                                    </button>
                                                )}
                                                {canDelete && (
                                                    <button onClick={() => handleDelete(item.id, item.source)} className="p-1.5 rounded-md text-slate-500 bg-slate-100 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete Task">
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    </button>
                                                )}
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
            <SendWhatsAppMessageModal
                isOpen={isWhatsAppModalOpen}
                onClose={() => setIsWhatsAppModalOpen(false)}
                contactPhone={selectedChatPhone}
                contactName={selectedChatName}
            />
            <EmailModal
                isOpen={isEmailModalOpen}
                onClose={() => setIsEmailModalOpen(false)}
                recipientEmail={selectedEmail}
                recipientName={selectedEmailName}
            />
            <LeadEditModal
                isOpen={isLeadEditModalOpen}
                onClose={() => {
                    setIsLeadEditModalOpen(false);
                    setSelectedLeadId(null);
                }}
                leadId={selectedLeadId}
                onUpdate={loadFollowUps}
            />
        </div>
    );
};

export default FollowUpManager;
