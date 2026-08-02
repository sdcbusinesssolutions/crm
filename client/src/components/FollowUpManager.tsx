import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getTasks, updateTask, deleteTask, getLeads, createTask, getPipelines, createLead } from '../services/lead-management-api';
import { themeService } from '../services/themeService';
import { contactService } from '../services/contactService';
import { format, isToday, isPast, isFuture, parseISO } from 'date-fns';
import Papa from 'papaparse';
import { PermissionGate } from '../modules/teamStaff/components/PermissionGate';
import SendWhatsAppMessageModal from './SendWhatsAppMessageModal';
import { ACCESS_TYPES } from '../modules/teamStaff/hooks/usePermissions';

const FollowUpManager: React.FC = () => {
    const [tasks, setTasks] = useState<any[]>([]);
    const [leads, setLeads] = useState<any[]>([]);
    const [pipelines, setPipelines] = useState<any[]>([]); // Added pipelines state
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'today' | 'upcoming' | 'overdue' | 'completed'>('all');
    const [search, setSearch] = useState('');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<any>(null); // If null, we are in create mode
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        due_date: '',
        lead_id: ''
    });
    const [isSaving, setIsSaving] = useState(false);

    // Searchable Dropdown State
    const [contactSearch, setContactSearch] = useState('');
    const [contactOptions, setContactOptions] = useState<any[]>([]);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // WhatsApp Modal State
    const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
    const [selectedChatPhone, setSelectedChatPhone] = useState('');
    const [selectedChatName, setSelectedChatName] = useState('');

    // Debounce Search
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (isModalOpen) {
                try {
                    const searchTerm = contactSearch.replace(/,/g, '');

                    // 1. Search existing Leads (CRM)
                    const leadsPromise = getLeads(undefined, undefined, 1, 10, { search: searchTerm });

                    // 2. Search raw Contacts (Address Book)
                    // We only search contacts if we have a search term, to avoid fetching all contacts unnecessarily
                    const contactsPromise = searchTerm
                        ? contactService.getContactsPaginated(1, 10, searchTerm).then(res => res.data)
                        : Promise.resolve([]);

                    const [leadResults, contactResults] = await Promise.all([leadsPromise, contactsPromise]);

                    // 3. Merge: Prioritize Leads. If a contact exists as a lead, use the lead.
                    // Map existing leads by phone for easy lookup
                    const leadPhoneMap = new Map();
                    leadResults.forEach(l => {
                        if (l.phone) leadPhoneMap.set(l.phone, l);
                    });

                    // Filter out contacts that are already in the lead results
                    const newContacts = contactResults.filter((c: any) => {
                        // Check if this contact's phone is already in the lead results
                        return !leadPhoneMap.has(c.phone);
                    }).map((c: any) => ({
                        // Transform Contact to a Lead-like temporary structure for display
                        id: `temp_contact_${c.id}`, // Temporary ID to distinguish
                        is_raw_contact: true, // Flag to identify raw contact
                        original_contact_id: c.id,
                        name: c.name,
                        phone: c.phone,
                        status: 'Contact', // Visual indicator
                        source: 'Address Book'
                    }));

                    // Combine: Leads first, then new contacts
                    setContactOptions([...leadResults, ...newContacts]);

                } catch (e) {
                    console.error("Failed to search leads/contacts", e);
                }
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [contactSearch, isModalOpen]);

    useEffect(() => {
        loadTasks();
        loadLeads();
        loadPipelines(); // Fetch pipelines

        // Click outside to close dropdown
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const loadTasks = async () => {
        setLoading(true);
        try {
            const data = await getTasks();
            const fixedData = data.map(t => {
                if (t.due_date && !t.due_date.endsWith('Z')) {
                    t.due_date += 'Z';
                }
                return t;
            });
            setTasks(fixedData);
        } catch (error) {
            console.error('Failed to load tasks', error);
        } finally {
            setLoading(false);
        }
    };

    const loadLeads = async () => {
        try {
            const data = await getLeads();
            setLeads(data);
        } catch (error) {
            console.error('Failed to load leads', error);
        }
    };

    const loadPipelines = async () => {
        try {
            const data = await getPipelines();
            setPipelines(data);
        } catch (error) {
            console.error('Failed to load pipelines', error);
        }
    };

    // Open Modal for Creation
    const openCreateModal = () => {
        setEditingTask(null);
        setFormData({ title: '', description: '', due_date: '', lead_id: '' });
        setContactSearch(''); // Reset search
        setContactOptions([]); // Reset options
        setIsModalOpen(true);
    };

    // Open Modal for Editing/Viewing
    const openEditModal = (task: any) => {
        setEditingTask(task);
        const taskLead = leads.find(l => l.id === task.lead_id) || (task.leads ? task.leads : null);
        setFormData({
            title: task.title || '',
            description: task.description || '',
            due_date: task.due_date ? format(parseISO(task.due_date), "yyyy-MM-dd'T'HH:mm") : '', // Format for datetime-local input
            lead_id: task.lead_id || ''
        });
        setContactSearch(taskLead ? taskLead.name || taskLead.phone : '');
        setIsModalOpen(true);
    };

    const handleCreateNewContact = async () => {
        if (!contactSearch) return;
        setIsSaving(true);
        try {
            const isPhone = /^[+\d\s-]+$/.test(contactSearch) && contactSearch.replace(/\D/g, '').length >= 10;
            const newLead = await createLead({
                name: contactSearch, // Name is the search term
                phone: isPhone ? contactSearch : undefined,
                source: 'manual'
            });

            setLeads(prev => [newLead, ...prev]); // Add to local cache
            setFormData({ ...formData, lead_id: newLead.id });
            setContactSearch(newLead.name || newLead.phone);
            setIsDropdownOpen(false);
            // Optionally auto-select
        } catch (error) {
            console.error("Failed to create new contact", error);
            alert("Failed to create new contact from search term.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        let finalLeadId = formData.lead_id;

        // If no lead selected but we have search text, try to find or create
        if (!finalLeadId && contactSearch) {
            const exactMatch = contactOptions.find(l =>
                l.name?.toLowerCase() === contactSearch.toLowerCase() ||
                l.phone === contactSearch
            );

            if (exactMatch) {
                finalLeadId = exactMatch.id;
            } else {
                // Suggest creating? Or block?
                // The user requested manual number entry. So we create if not found.
                if (window.confirm(`Contact '${contactSearch}' not found. Create new contact?`)) {
                    // Logic similar to handleCreateNewContact but inline
                    // ... actually handleCreateNewContact serves this purpose.
                    // For now, block and ask user to select or create explicitly to avoid accidents.
                    alert(`Please select a contact or click 'Create New'`);
                    return;
                }
                return;
            }
        }

        if (!finalLeadId) {
            alert('Please select a contact');
            return;
        }

        setIsSaving(true);
        try {
            const payload = { ...formData, lead_id: finalLeadId };
            let savedTask;

            if (editingTask) {
                // Update existing
                const updated = await updateTask(editingTask.id, payload);
                savedTask = { ...updated, leads: leads.find(l => l.id === finalLeadId) || contactOptions.find(l => l.id === finalLeadId) };
                setTasks(tasks.map(t => t.id === editingTask.id ? { ...t, ...savedTask } : t));
            } else {
                // Create new
                const created = await createTask(payload);
                // Ensure we have lead info in the task object for display
                savedTask = { ...created, leads: leads.find(l => l.id === finalLeadId) || contactOptions.find(l => l.id === finalLeadId) };
                setTasks([...tasks, savedTask]);
            }
            setIsModalOpen(false);
        } catch (error) {
            console.error('Failed to save task', error);
            alert('Failed to save task');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCompleteAndNext = async () => {
        if (!editingTask) return;
        setIsSaving(true);
        try {
            // 1. Mark current as completed
            await updateTask(editingTask.id, { is_completed: true });

            // Update local state for the completed task
            const updatedTaskList = tasks.map(t => t.id === editingTask.id ? { ...t, is_completed: true } : t);
            setTasks(updatedTaskList);

            // 2. Prepare form for NEW task with same lead
            const currentLead = leads.find(l => l.id === editingTask.lead_id);
            setEditingTask(null); // Switch to create mode
            setFormData({
                title: '',
                description: '',
                due_date: '',
                lead_id: editingTask.lead_id // Keep the same lead
            });
            setContactSearch(currentLead ? currentLead.name || currentLead.phone : '');

            // Modal stays open, but now in "Create" mode
            setIsSaving(false);
        } catch (error) {
            console.error('Error in complete & next flow', error);
            setIsSaving(false);
        }
    };



    const filteredTasks = useMemo(() => {
        let filtered = tasks;

        // Search
        if (search) {
            const searchLower = search.toLowerCase();
            filtered = filtered.filter(t =>
                t.title?.toLowerCase().includes(searchLower) ||
                t.description?.toLowerCase().includes(searchLower) ||
                t.leads?.name?.toLowerCase().includes(searchLower)
            );
        }

        // Status Filter
        if (filter === 'completed') {
            return filtered.filter(t => t.is_completed);
        }

        // Active tasks only for time filters
        filtered = filtered.filter(t => !t.is_completed);

        if (filter === 'today') {
            return filtered.filter(t => t.due_date && isToday(parseISO(t.due_date)) && !isPast(parseISO(t.due_date)));
        }
        if (filter === 'overdue') {
            return filtered.filter(t => t.due_date && isPast(parseISO(t.due_date)));
        }
        if (filter === 'upcoming') {
            return filtered.filter(t => t.due_date && isFuture(parseISO(t.due_date)) && !isToday(parseISO(t.due_date)));
        }

        return filtered;
    }, [tasks, filter, search]);

    const handleExport = () => {
        if (filteredTasks.length === 0) return;

        const csvData = filteredTasks.map(t => ({
            Status: t.is_completed ? 'Completed' : 'Pending',
            Title: t.title,
            Description: t.description || '',
            'Contact Name': t.leads?.name || 'No Contact',
            'Contact Phone': t.leads?.phone || '',
            'Pipeline': (() => {
                const fullLead = leads.find(l => l.id === t.lead_id);
                const pipeline = pipelines.find(p => p.id === fullLead?.pipeline_id);
                return pipeline?.name || '-';
            })(),
            'Due Date': t.due_date ? format(parseISO(t.due_date), 'yyyy-MM-dd HH:mm') : ''
        }));

        const csv = Papa.unparse(csvData);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `follow_up_tasks_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Pagination Logic
    const paginatedTasks = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredTasks.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredTasks, currentPage]);

    const totalPages = Math.ceil(filteredTasks.length / itemsPerPage);

    const stats = useMemo(() => {
        const total = tasks.filter(t => !t.is_completed).length;
        const today = tasks.filter(t => !t.is_completed && t.due_date && isToday(parseISO(t.due_date)) && !isPast(parseISO(t.due_date))).length;
        const upcoming = tasks.filter(t => !t.is_completed && t.due_date && isFuture(parseISO(t.due_date)) && !isToday(parseISO(t.due_date))).length;
        const overdue = tasks.filter(t => !t.is_completed && t.due_date && isPast(parseISO(t.due_date))).length;
        const completed = tasks.filter(t => t.is_completed).length;

        return { total, today, upcoming, overdue, completed };
    }, [tasks]);

    const handleToggleComplete = async (e: React.MouseEvent, task: any) => {
        e.stopPropagation(); // Prevent opening modal
        try {
            const updated = { ...task, is_completed: !task.is_completed };
            setTasks(tasks.map(t => t.id === task.id ? updated : t));
            await updateTask(task.id, { is_completed: updated.is_completed });
        } catch (error) {
            console.error('Failed to update task', error);
            loadTasks();
        }
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation(); // Prevent opening modal
        if (!window.confirm('Are you sure you want to delete this task?')) return;
        try {
            setTasks(tasks.filter(t => t.id !== id));
            await deleteTask(id);
        } catch (error) {
            console.error('Failed to delete task', error);
            loadTasks();
        }
    };

    // Helper to find lead info for display in modal
    const currentLead = leads.find(l => l.id === formData.lead_id);

    return (
        <div className="h-full flex flex-col bg-[var(--color-bg)] overflow-hidden relative">
            <div className="p-6 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-[var(--color-text)]">Follow-up</h1>
                        <p className="text-[var(--color-text)] opacity-60">You have total {stats.total} Active Tasks</p>
                    </div>
                    <div className="flex gap-3">
                        <PermissionGate moduleName="Follow-up" requiredAccess={ACCESS_TYPES.READ}>
                            <button
                                onClick={handleExport}
                                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors flex items-center gap-2 font-bold text-sm shadow-md shadow-brand-200"
                                title="Export to CSV"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                Export
                            </button>
                        </PermissionGate>
                        <PermissionGate moduleName="Follow-up" requiredAccess={ACCESS_TYPES.READ_WRITE}>
                            <button
                                onClick={openCreateModal}
                                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors flex items-center gap-2 font-bold text-sm shadow-md shadow-brand-200"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                Create Follow-up
                            </button>
                        </PermissionGate>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <StatCard
                        label="All Active"
                        count={stats.total}
                        active={filter === 'all'}
                        onClick={() => { setFilter('all'); setCurrentPage(1); }}
                        color="brand"
                        icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>}
                    />
                    <StatCard
                        label="Due Today"
                        count={stats.today}
                        active={filter === 'today'}
                        onClick={() => { setFilter('today'); setCurrentPage(1); }}
                        color="blue"
                        icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                    />
                    <StatCard
                        label="Upcoming"
                        count={stats.upcoming}
                        active={filter === 'upcoming'}
                        onClick={() => { setFilter('upcoming'); setCurrentPage(1); }}
                        color="indigo"
                        icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                    />
                    <StatCard
                        label="Overdue"
                        count={stats.overdue}
                        active={filter === 'overdue'}
                        onClick={() => { setFilter('overdue'); setCurrentPage(1); }}
                        color="orange"
                        icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
                    />
                    <StatCard
                        label="Completed"
                        count={stats.completed}
                        active={filter === 'completed'}
                        onClick={() => { setFilter('completed'); setCurrentPage(1); }}
                        color="green"
                        icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-[var(--color-text)] capitalize">{filter === 'all' ? 'All Tasks' : filter}</h2>
                    <div className="flex gap-2 w-full md:w-auto">
                        <div className="relative w-full md:w-64">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-brand-600">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            </div>
                            <input
                                type="text"
                                placeholder="Search tasks..."
                                value={search}
                                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                                className="w-full bg-[var(--color-bg)] border border-brand-600 rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none placeholder:text-slate-400"
                            />
                        </div>
                    </div>
                </div>

                <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden shadow-sm flex flex-col">
                    {loading ? (
                        <div className="p-8 text-center text-[var(--color-text)] opacity-60">Loading tasks...</div>
                    ) : filteredTasks.length === 0 ? (
                        <div className="p-8 text-center text-[var(--color-text)] opacity-60">No Tasks Found...</div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-brand-600 text-white shadow-md">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Status</th>
                                            <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Title & Description</th>
                                            <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Contact</th>
                                            <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Pipeline</th>
                                            <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Due Date</th>
                                            <th className="px-6 py-4 text-right text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Option</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--color-border)]">
                                        {paginatedTasks.map(task => (
                                            <tr
                                                key={task.id}
                                                onClick={() => openEditModal(task)}
                                                className="hover:bg-[var(--color-bg)]/50 transition-colors group cursor-pointer"
                                            >
                                                <td className="px-6 py-4 text-center w-16">
                                                    <button
                                                        onClick={(e) => handleToggleComplete(e, task)}
                                                        title={task.is_completed ? "Mark as Incomplete" : "Mark as Completed"}
                                                        className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all duration-200 ${task.is_completed
                                                            ? 'bg-green-500 border-green-500 text-white shadow-sm scale-110'
                                                            : 'border-gray-300 hover:border-[var(--color-brand)] bg-white'
                                                            }`}
                                                    >
                                                        {task.is_completed && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                                    </button>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className={`font-bold text-[var(--color-text)] ${task.is_completed ? 'line-through opacity-60' : ''}`}>{task.title}</div>
                                                    <div className="text-xs text-[var(--color-text)] opacity-60">{task.description}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {task.leads ? (
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white bg-[var(--color-brand)]`}>
                                                                {task.leads.name?.[0]?.toUpperCase() || '#'}
                                                            </div>
                                                            <span className="font-medium text-[var(--color-text)]">{task.leads.name || 'Unknown'}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-[var(--color-text)] opacity-40 italic">No Contact</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {(() => {
                                                        const fullLead = leads.find(l => l.id === task.lead_id);
                                                        const pipeline = pipelines.find(p => p.id === fullLead?.pipeline_id);
                                                        return (
                                                            <span className="text-[var(--color-text)] text-sm">
                                                                {pipeline ? (
                                                                    <span className="px-2 py-1 rounded bg-blue-50 text-blue-600 font-medium text-xs">
                                                                        {pipeline.name}
                                                                    </span>
                                                                ) : '-'}
                                                            </span>
                                                        );
                                                    })()}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {task.due_date ? (
                                                        <span className={`px-2 py-1 rounded text-xs font-bold ${isPast(parseISO(task.due_date)) && !task.is_completed ? 'bg-red-100 text-red-600' :
                                                            isToday(parseISO(task.due_date)) && !task.is_completed ? 'bg-blue-100 text-blue-600' :
                                                                'bg-[var(--color-bg)] text-[var(--color-text)] opacity-70'
                                                            }`}>
                                                            {format(parseISO(task.due_date), 'MMM d, yyyy h:mm a')}
                                                        </span>
                                                    ) : '-'}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <PermissionGate moduleName="Follow-up" requiredAccess={ACCESS_TYPES.READ_WRITE}>
                                                            <button
                                                                onClick={(e) => handleToggleComplete(e, task)}
                                                                className={`text-xs font-medium px-2 py-1 rounded transition-colors ${task.is_completed
                                                                    ? 'text-orange-600 hover:text-orange-700 hover:bg-orange-50'
                                                                    : 'text-green-600 hover:text-green-700 hover:bg-green-50'
                                                                    }`}
                                                            >
                                                                {task.is_completed ? 'Mark Undone' : 'Mark Done'}
                                                            </button>
                                                        </PermissionGate>
                                                        <PermissionGate moduleName="Follow-up" requiredAccess={ACCESS_TYPES.READ_WRITE}>
                                                            <button 
                                                                onClick={(e) => { 
                                                                    e.stopPropagation(); 
                                                                    if (!task.leads?.phone && !task.leads?.contact_phone) return;
                                                                    setSelectedChatPhone(task.leads.phone || task.leads.contact_phone); 
                                                                    setSelectedChatName(task.leads.name); 
                                                                    setIsWhatsAppModalOpen(true); 
                                                                }} 
                                                                className={`p-1.5 rounded transition-colors ${(task.leads?.phone || task.leads?.contact_phone) ? 'text-emerald-600 hover:bg-emerald-50' : 'text-gray-300 cursor-not-allowed'}`}
                                                                title={(task.leads?.phone || task.leads?.contact_phone) ? "Send WhatsApp Message" : "No phone number"}
                                                                disabled={!(task.leads?.phone || task.leads?.contact_phone)}
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                                                            </button>
                                                        </PermissionGate>
                                                        <PermissionGate moduleName="Follow-up" requiredAccess={ACCESS_TYPES.READ_WRITE}>
                                                            <button
                                                                onClick={(e) => handleDelete(e, task.id)}
                                                                className="p-1.5 text-[var(--color-text)] opacity-40 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                                title="Delete Task"
                                                            >
                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                            </button>
                                                        </PermissionGate>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {/* Pagination Controls */}
                            <div className="px-6 py-4 border-t border-[var(--color-border)] flex flex-col md:flex-row items-center justify-between bg-[var(--color-bg)]/50 gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="text-sm text-[var(--color-text)] opacity-60">
                                        Showing {filteredTasks.length > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0} to {Math.min(currentPage * itemsPerPage, filteredTasks.length)} of {filteredTasks.length} entries
                                    </div>
                                    <select
                                        value={itemsPerPage}
                                        onChange={(e) => {
                                            setItemsPerPage(Number(e.target.value));
                                            setCurrentPage(1);
                                        }}
                                        className="text-sm border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] rounded px-2 py-1 outline-none focus:ring-1 focus:ring-[var(--color-brand)]"
                                    >
                                        <option value={5}>5 per page</option>
                                        <option value={10}>10 per page</option>
                                        <option value={20}>20 per page</option>
                                        <option value={50}>50 per page</option>
                                    </select>
                                </div>

                                {totalPages > 1 && (
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                            className="px-3 py-1 text-sm border border-[var(--color-border)] rounded hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed text-[var(--color-text)] transition-colors"
                                        >
                                            Prev
                                        </button>

                                        {(() => {
                                            const pages = [];
                                            const maxVisible = 5;

                                            // Always show 1
                                            // Always show last
                                            // Show current +/- 1

                                            if (totalPages <= maxVisible) {
                                                for (let i = 1; i <= totalPages; i++) pages.push(i);
                                            } else {
                                                if (currentPage <= 3) {
                                                    for (let i = 1; i <= 3; i++) pages.push(i);
                                                    pages.push('...');
                                                    pages.push(totalPages);
                                                } else if (currentPage >= totalPages - 2) {
                                                    pages.push(1);
                                                    pages.push('...');
                                                    for (let i = totalPages - 2; i <= totalPages; i++) pages.push(i);
                                                } else {
                                                    pages.push(1);
                                                    pages.push('...');
                                                    pages.push(currentPage - 1);
                                                    pages.push(currentPage);
                                                    pages.push(currentPage + 1);
                                                    pages.push('...');
                                                    pages.push(totalPages);
                                                }
                                            }

                                            return pages.map((p, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => typeof p === 'number' && setCurrentPage(p)}
                                                    disabled={p === '...'}
                                                    className={`min-w-[32px] px-3 py-1 text-sm border rounded transition-colors ${p === currentPage
                                                        ? 'bg-[var(--color-brand)] text-white border-[var(--color-brand)]'
                                                        : p === '...'
                                                            ? 'border-transparent text-[var(--color-text)] cursor-default'
                                                            : 'border-[var(--color-border)] hover:bg-white text-[var(--color-text)]'
                                                        }`}
                                                >
                                                    {p}
                                                </button>
                                            ));
                                        })()}

                                        <button
                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages}
                                            className="px-3 py-1 text-sm border border-[var(--color-border)] rounded hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed text-[var(--color-text)] transition-colors"
                                        >
                                            Next
                                        </button>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Task Details / Create Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-[var(--color-surface)] rounded-xl shadow-xl w-full max-w-lg get-fade-in relative text-[var(--color-text)] flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-[var(--color-border)] flex justify-between items-center">
                            <h3 className="text-xl font-bold">{editingTask ? 'Task Details' : 'Create New Follow-up'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-[var(--color-text)] opacity-50 hover:opacity-100">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto">
                            <form id="task-form" onSubmit={handleSave} className="space-y-4">
                                {currentLead && (
                                    <div className="bg-[var(--color-bg)] p-3 rounded-lg flex items-center gap-3 mb-4">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white bg-[var(--color-brand)]`}>
                                            {currentLead.name?.[0]?.toUpperCase() || '#'}
                                        </div>
                                        <div>
                                            <div className="font-bold">{currentLead.name}</div>
                                            <div className="text-sm opacity-60">{currentLead.phone}</div>
                                        </div>
                                    </div>
                                )}

                                {editingTask && editingTask.is_completed && (
                                    <div className="bg-green-50 text-green-700 p-3 rounded-lg border border-green-200 flex items-center gap-2 mb-4">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                        <span className="font-medium">This task is completed.</span>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium mb-1 opacity-80">Contact *</label>
                                    <div className="relative" ref={dropdownRef}>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                            </div>
                                            <input
                                                type="text"
                                                required={!formData.lead_id}
                                                value={contactSearch}
                                                onChange={(e) => {
                                                    setContactSearch(e.target.value);
                                                    setFormData({ ...formData, lead_id: '' }); // Clear selection on type
                                                    setIsDropdownOpen(true);
                                                }}
                                                onFocus={() => setIsDropdownOpen(true)}
                                                placeholder="Search name or enter phone..."
                                                className="w-full pl-10 pr-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                                disabled={!!editingTask} // Lock contact when editing
                                            />
                                            {formData.lead_id && (
                                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                                                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                </div>
                                            )}
                                        </div>

                                        {/* Dropdown Results */}
                                        {isDropdownOpen && !editingTask && (
                                            <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                                                {contactOptions.length > 0 ? (
                                                    contactOptions.map(lead => (
                                                        <div
                                                            key={lead.id}
                                                            onClick={async () => {
                                                                // If this is a raw contact, create a lead from it first
                                                                if (lead.is_raw_contact) {
                                                                    try {
                                                                        const newLead = await createLead({
                                                                            name: lead.name,
                                                                            phone: lead.phone,
                                                                            source: 'manual',
                                                                            custom_data: { original_contact_id: lead.original_contact_id }
                                                                        });
                                                                        setFormData({ ...formData, lead_id: newLead.id });
                                                                        setContactSearch(newLead.name || newLead.phone);
                                                                    } catch (err) {
                                                                        console.error("Failed to create lead from contact", err);
                                                                        alert("Failed to link contact.");
                                                                    }
                                                                } else {
                                                                    // Existing lead
                                                                    setFormData({ ...formData, lead_id: lead.id });
                                                                    setContactSearch(lead.name || lead.phone);
                                                                }
                                                                setIsDropdownOpen(false);
                                                            }}
                                                            className="px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 flex flex-col"
                                                        >
                                                            <span className="font-bold text-slate-800">{lead.name}</span>
                                                            <div className="flex justify-between items-center text-xs text-slate-500">
                                                                <span>{lead.phone}</span>
                                                                {lead.is_raw_contact && <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">From Contacts</span>}
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="px-4 py-3 text-sm text-slate-500 text-center">
                                                        {contactSearch ? 'No contacts found' : 'Start typing to search...'}
                                                    </div>
                                                )}

                                                {/* Create Option */}
                                                {contactSearch && !contactOptions.find(c => c.name === contactSearch || c.phone === contactSearch) && (
                                                    <div
                                                        onClick={handleCreateNewContact}
                                                        className="px-4 py-3 bg-brand-50 hover:bg-brand-100 cursor-pointer border-t border-brand-100 flex items-center gap-2 text-brand-700 font-bold"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                                        Create "{contactSearch}"
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-slate-500 mt-1 pl-1">Search by name or enter a phone number to create a new contact.</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 opacity-80">Title *</label>
                                    <input
                                        required
                                        type="text"
                                        value={formData.title}
                                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                                        placeholder="e.g. Call to discuss pricing"
                                        className="w-full px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 opacity-80">Description</label>
                                    <textarea
                                        rows={3}
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        placeholder="Add details..."
                                        className="w-full px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 opacity-80">Due Date *</label>
                                    <input
                                        required
                                        type="datetime-local"
                                        value={formData.due_date}
                                        onChange={e => setFormData({ ...formData, due_date: e.target.value })}
                                        className="w-full px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                    />
                                </div>
                            </form>
                        </div>

                        <div className="p-6 border-t border-[var(--color-border)] flex items-center justify-between gap-3 bg-[var(--color-bg)]/30 rounded-b-xl">
                            {editingTask && !editingTask.is_completed && (
                                <button
                                    type="button"
                                    onClick={handleCompleteAndNext}
                                    disabled={isSaving}
                                    className="mr-auto px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-sm font-medium text-sm"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                    Complete & Create Next
                                </button>
                            )}

                            <div className={`flex gap-3 justify-end ${(!editingTask || editingTask.is_completed) ? 'w-full' : ''}`}>
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-5 py-2.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-bg)] text-[var(--color-text)] font-medium text-sm transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    form="task-form"
                                    type="submit"
                                    disabled={isSaving}
                                    className="px-6 py-2.5 rounded-lg bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand)]/90 font-medium text-sm shadow-sm transition-colors"
                                >
                                    {isSaving ? 'Saving...' : (editingTask ? 'Update Task' : 'Create Task')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const StatCard: React.FC<{ label: string; count: number; active: boolean; onClick: () => void; color: string; icon: React.ReactNode }> = ({ label, count, active, onClick, color }) => {
    // Color mapping for backgrounds and text
    const colorMap: Record<string, { bg: string; border: string; text: string; textDark: string }> = {
        brand: { bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-500', textDark: 'text-slate-900' },
        blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', textDark: 'text-blue-700' },
        indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-600', textDark: 'text-indigo-700' },
        orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-600', textDark: 'text-orange-700' },
        green: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-600', textDark: 'text-green-700' }
    };

    const colors = colorMap[color] || colorMap.brand;

    return (
        <div
            onClick={onClick}
            className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md ${active
                ? `${colors.bg} ${colors.border} ring-2 ring-${color}-500`
                : `${colors.bg} ${colors.border}`
                }`}
        >
            <div className={`text-xs font-bold uppercase tracking-wider mb-1 ${colors.text}`}>{label}</div>
            <div className={`text-2xl font-black ${colors.textDark}`}>{count}</div>
        </div>

            <SendWhatsAppMessageModal
                isOpen={isWhatsAppModalOpen}
                onClose={() => setIsWhatsAppModalOpen(false)}
                contactPhone={selectedChatPhone}
                contactName={selectedChatName}
            />
    );
};

export default FollowUpManager;
