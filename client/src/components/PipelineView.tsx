import React, { useState, useEffect, useMemo, useRef } from 'react';

import { Pipeline, PipelineStage, Lead, KanbanBoard } from '../types/lead-management';
import { themeService } from '../services/themeService';
import Modal from './Modal';
import DatabaseSetup from './DatabaseSetup';
import Toast from './Toast';
import PhoneInputWithCountry from './PhoneInputWithCountry';
import EmailModal from './EmailModal';
import LeadAssignment from '../modules/teamStaff/components/LeadAssignment';
import PipelineAssignment from '../modules/teamStaff/components/PipelineAssignment';
import {
    getPipelines,
    getKanbanBoard,
    moveLeadToStage,
    createPipeline,
    deletePipeline,
    setPipelineAsDefault,
    createStage,
    updateStage,
    deleteStage,
    reorderStages,
    updateLead,
    deleteLead,
    getNotes, createNote, deleteNote,
    getTasks, createTask, updateTask, deleteTask,
    getAppointments, createAppointment, deleteAppointment,
    getCallLogs, createCallLog, deleteCallLog,
    getLeads
} from '../services/lead-management-api';

interface PipelineViewProps {
    initialPipelineId?: string | null;
}

const PipelineView: React.FC<PipelineViewProps> = ({ initialPipelineId }) => {
    const [pipelines, setPipelines] = useState<Pipeline[]>([]);
    const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(initialPipelineId || null);
    const [boardData, setBoardData] = useState<KanbanBoard | null>(null);
    const [loading, setLoading] = useState(false);
    const [isCreatingPipeline, setIsCreatingPipeline] = useState(false);
    const [newPipelineName, setNewPipelineName] = useState('');
    const [showDbSetup, setShowDbSetup] = useState(false);
    const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
    const [isCreatingStage, setIsCreatingStage] = useState(false);
    const [newStageName, setNewStageName] = useState('');
    const [isDeletePipelineModalOpen, setIsDeletePipelineModalOpen] = useState(false);
    const [isDeleteStageModalOpen, setIsDeleteStageModalOpen] = useState(false);
    const [stageToDelete, setStageToDelete] = useState<string | null>(null);
    const [showFilters, setShowFilters] = useState(false);
    const [page, setPage] = useState(1); // Kept for initial load context if needed, but primary is per-stage
    const [limit, setLimit] = useState(20); // Initial per-stage limit
    const [stagePages, setStagePages] = useState<Record<string, number>>({});
    const [loadingStage, setLoadingStage] = useState<Record<string, boolean>>({});
    const [filters, setFilters] = useState({
        search: '',
        stageIds: [] as string[],
        sortBy: 'created_at_desc',
        quickFilter: 'all', // 'all', 'hot', 'cold', 'high_value'
        viewType: 'Pipeline'
    });

    // Stage Edit State
    const [editingStage, setEditingStage] = useState<Partial<PipelineStage>>({});
    const [isEditStageModalOpen, setIsEditStageModalOpen] = useState(false);
    const [stageLoading, setStageLoading] = useState(false);

    // Lead Edit State
    const [editingLead, setEditingLead] = useState<Partial<Lead>>({});
    const [isEditLeadModalOpen, setIsEditLeadModalOpen] = useState(false);
    const [leadLoading, setLeadLoading] = useState(false);
    const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info' | 'warning', title: string, message: string } | null>(null);

    // Enhanced Lead Modal State
    const [activeTab, setActiveTab] = useState('opportunity');
    const [notes, setNotes] = useState<any[]>([]);
    const [tasks, setTasks] = useState<any[]>([]);
    const [appointments, setAppointments] = useState<any[]>([]);
    const [callLogs, setCallLogs] = useState<any[]>([]);
    const [newNote, setNewNote] = useState({ title: '', content: '', tags: '' });
    const [newTask, setNewTask] = useState({ title: '', description: '', due_date: '' });
    const [newAppointment, setNewAppointment] = useState({ title: '', start_time: '', end_time: '', description: '' });
    const [newCallLog, setNewCallLog] = useState({ call_type: 'outbound', duration: 0, notes: '', called_at: '' });

    // Email Modal State
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [emailRecipient, setEmailRecipient] = useState({ email: '', name: '' });

    const selectedPipeline = pipelines.find(p => p.id === selectedPipelineId);

    const filteredBoardData = useMemo(() => {
        if (!boardData) return null;

        // 1. Filter Columns (Stages) - Client Side Only
        let filteredColumns = boardData.columns;
        if (filters.stageIds.length > 0) {
            filteredColumns = filteredColumns.filter(col => filters.stageIds.includes(col.stage.id));
        }

        // Note: Leads filtering and sorting is now handled server-side!

        return {
            ...boardData,
            columns: filteredColumns
        };
    }, [boardData, filters.stageIds]);

    const totalLeads = boardData?.pagination?.total || 0;

    const handleCreateStage = async () => {
        if (!newStageName.trim() || !selectedPipelineId) return;
        try {
            await createStage(selectedPipelineId, {
                name: newStageName,
                display_order: boardData?.columns.length || 0
            });
            setNewStageName('');
            setIsCreatingStage(false);
            loadBoard(selectedPipelineId);
        } catch (error: any) {
            console.error('Failed to create stage', error);
            alert('Failed to create stage. Please try again.');
        }
    };

    // Load pipelines on mount
    useEffect(() => {
        loadPipelines();
    }, []);

    // Load board when pipeline changes, sorting changes, or filters change. Page handled separately for load-more.
    useEffect(() => {
        if (!selectedPipelineId) return;

        // Reset page to 1 when filters change
        setPage(1);

        const timer = setTimeout(() => {
            loadBoard(selectedPipelineId);
        }, 300);

        return () => clearTimeout(timer);
    }, [selectedPipelineId, limit, filters.search, filters.sortBy, filters.quickFilter, filters.stageIds]);

    const loadPipelines = async () => {
        try {
            const data = await getPipelines();
            setPipelines(data);
            if (data.length > 0 && !selectedPipelineId) {
                // Find default pipeline or use the first one (backend already sorts by is_default DESC)
                const defaultPipeline = data.find(p => p.is_default) || data[0];
                setSelectedPipelineId(defaultPipeline.id);
            }
        } catch (error: any) {
            console.error('Failed to load pipelines', error);
            if (error.code === 500 || error.status === 500 || error.message?.includes('recursion')) {
                setShowDbSetup(true);
            }
        }
    };

    const loadBoard = async (pipelineId: string) => {
        setLoading(true);
        try {
            // getKanbanBoard now returns top 20 leads per stage
            const data = await getKanbanBoard(pipelineId, 1, 20, filters);
            setBoardData(data);

            // Initialize stage pages
            const initialPages: Record<string, number> = {};
            if (data.columns) {
                data.columns.forEach(col => {
                    initialPages[col.stage.id] = 1;
                });
            }
            setStagePages(initialPages);
        } catch (error) {
            console.error('Failed to load board', error);
        } finally {
            setLoading(false);
        }
    };

    const loadMoreLeadsForStage = async (stageId: string) => {
        if (loadingStage[stageId] || !selectedPipelineId || !boardData) return;

        const currentColumn = boardData.columns.find(c => c.stage.id === stageId);
        if (!currentColumn) return;

        // Check if we have loaded all leads
        if (currentColumn.leads.length >= currentColumn.total_count) return;

        setLoadingStage(prev => ({ ...prev, [stageId]: true }));
        try {
            const nextPage = (stagePages[stageId] || 1) + 1;
            const newLeads = await getLeads(selectedPipelineId, stageId, nextPage, 20, filters);

            if (newLeads && newLeads.length > 0) {
                // Update board data
                setBoardData(prev => {
                    if (!prev) return null;
                    return {
                        ...prev,
                        columns: prev.columns.map(col => {
                            if (col.stage.id === stageId) {
                                // Filter out duplicates just in case
                                const existingIds = new Set(col.leads.map(l => l.id));
                                const uniqueNewLeads = newLeads.filter(l => !existingIds.has(l.id));
                                return {
                                    ...col,
                                    leads: [...col.leads, ...uniqueNewLeads]
                                };
                            }
                            return col;
                        })
                    };
                });
                setStagePages(prev => ({ ...prev, [stageId]: nextPage }));
            }
        } catch (error) {
            console.error(`Failed to load more leads for stage ${stageId}`, error);
        } finally {
            setLoadingStage(prev => ({ ...prev, [stageId]: false }));
        }
    };

    const fetchBoardData = (id: string) => loadBoard(id);

    const handleDragStart = (e: React.DragEvent, type: 'lead' | 'stage', id: string) => {
        e.stopPropagation();
        e.dataTransfer.setData('type', type);
        e.dataTransfer.setData('id', id);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = async (e: React.DragEvent, targetStageId: string) => {
        e.preventDefault();
        const type = e.dataTransfer.getData('type');
        const id = e.dataTransfer.getData('id');

        if (type === 'lead') {
            // Move Lead
            if (!boardData) return;

            // Find source and target columns
            const sourceCol = boardData.columns.find(c => c.leads.some(l => l.id === id));
            const targetCol = boardData.columns.find(c => c.stage.id === targetStageId);

            if (!sourceCol || !targetCol || sourceCol.stage.id === targetStageId) return;

            // Find the lead being moved
            const leadToMove = sourceCol.leads.find(l => l.id === id);
            if (!leadToMove) return;

            // OPTIMISTIC UPDATE: Immediately update the UI
            const updatedColumns = boardData.columns.map(col => {
                if (col.stage.id === sourceCol.stage.id) {
                    // Remove lead from source column
                    return {
                        ...col,
                        leads: col.leads.filter(l => l.id !== id),
                        total_count: col.total_count - 1
                    };
                } else if (col.stage.id === targetStageId) {
                    // Add lead to target column
                    return {
                        ...col,
                        leads: [...col.leads, { ...leadToMove, stage_id: targetStageId }],
                        total_count: col.total_count + 1
                    };
                }
                return col;
            });

            // Update UI immediately
            setBoardData({ ...boardData, columns: updatedColumns });

            // Make API call in background
            try {
                await moveLeadToStage(id, targetStageId);
                // Optionally refresh to ensure sync
                // fetchBoardData(selectedPipelineId || '');
            } catch (error) {
                console.error('Failed to move lead', error);
                // Revert on error
                fetchBoardData(selectedPipelineId || '');
                setToast({
                    type: 'error',
                    title: 'Error',
                    message: 'Failed to move lead. Changes reverted.'
                });
            }
        } else if (type === 'stage') {
            // Reorder Stage
            if (!boardData) return;
            const draggedStageId = id;

            // Find indices
            const columns = [...boardData.columns];
            const draggedIndex = columns.findIndex(c => c.stage.id === draggedStageId);
            const targetIndex = columns.findIndex(c => c.stage.id === targetStageId);

            if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) return;

            // Reorder array
            const [draggedCol] = columns.splice(draggedIndex, 1);
            columns.splice(targetIndex, 0, draggedCol);

            // Optimistic update
            setBoardData({ ...boardData, columns });

            // Prepare API payload
            const updates = columns.map((col, index) => ({
                id: col.stage.id,
                display_order: index
            }));

            try {
                await reorderStages(updates);
            } catch (error) {
                console.error('Failed to reorder stages', error);
                fetchBoardData(selectedPipelineId || '');
            }
        }
    };

    const handleEditStageClick = (stage: PipelineStage) => {
        setEditingStage(stage);
        setIsEditStageModalOpen(true);
    };

    const handleDeleteStageClick = (stageId: string) => {
        setStageToDelete(stageId);
        setIsDeleteStageModalOpen(true);
    };

    const confirmDeleteStage = async () => {
        if (!stageToDelete) return;
        try {
            await deleteStage(stageToDelete);
            fetchBoardData(selectedPipelineId || '');
            setToast({
                type: 'success',
                title: 'Stage Deleted',
                message: 'Stage deleted successfully'
            });
            setIsDeleteStageModalOpen(false);
            setStageToDelete(null);
        } catch (error) {
            console.error('Failed to delete stage', error);
            setToast({
                type: 'error',
                title: 'Error',
                message: 'Failed to delete stage'
            });
        }
    };

    const handleSaveStage = async () => {
        if (!selectedPipelineId || !editingStage.name) return;
        setStageLoading(true);
        try {
            if (editingStage.id) {
                await updateStage(editingStage.id, editingStage);
            } else {
                await createStage(selectedPipelineId, { ...editingStage, pipeline_id: selectedPipelineId } as any);
            }
            setIsEditStageModalOpen(false);
            setIsCreatingStage(false);
            setEditingStage({});
            fetchBoardData(selectedPipelineId);
        } catch (error) {
            console.error('Failed to save stage', error);
            alert('Failed to save stage');
        } finally {
            setStageLoading(false);
        }
    };

    const handleCreatePipeline = async () => {
        if (!newPipelineName.trim()) return;
        try {
            const newPipeline = await createPipeline({
                name: newPipelineName,
                stages: [
                    { name: 'New', display_order: 0, color: '#3b82f6' },
                    { name: 'Contacted', display_order: 1, color: '#f59e0b' },
                    { name: 'Qualified', display_order: 2, color: '#10b981' },
                    { name: 'Lost', display_order: 3, color: '#ef4444' }
                ]
            });
            setNewPipelineName('');
            setIsCreatingPipeline(false);
            loadPipelines();
            setSelectedPipelineId(newPipeline.id);
        } catch (error: any) {
            console.error('Failed to create pipeline', error);
            if (error.code === 500 || error.status === 500 || error.message?.includes('recursion') || error.message?.includes('policy')) {
                setShowDbSetup(true);
            } else {
                alert('Failed to create pipeline. Please try again.');
            }
        }
    };

    const handleDeletePipeline = () => {
        if (!selectedPipelineId || !selectedPipeline) return;
        setIsDeletePipelineModalOpen(true);
    };

    const confirmDeletePipeline = async () => {
        if (!selectedPipelineId || !selectedPipeline) return;

        try {
            await deletePipeline(selectedPipelineId);
            const remainingPipelines = pipelines.filter(p => p.id !== selectedPipelineId);
            setPipelines(remainingPipelines);
            if (remainingPipelines.length > 0) {
                setSelectedPipelineId(remainingPipelines[0].id);
            } else {
                setSelectedPipelineId(null);
                setBoardData(null);
            }
            setToast({
                type: 'success',
                title: 'Pipeline Deleted',
                message: 'Pipeline deleted successfully'
            });
            setIsDeletePipelineModalOpen(false);
        } catch (error) {
            console.error('Failed to delete pipeline', error);
            setToast({
                type: 'error',
                title: 'Error',
                message: 'Failed to delete pipeline'
            });
        }
    };

    const handleSetDefaultPipeline = async () => {
        if (!selectedPipelineId) return;
        try {
            await setPipelineAsDefault(selectedPipelineId);
            setToast({
                type: 'success',
                title: 'Default Pipeline Set',
                message: 'This pipeline is now your default.'
            });
            // Update local state to reflect change (optimistic or re-fetch)
            const updatedPipelines = pipelines.map(p => ({
                ...p,
                is_default: p.id === selectedPipelineId
            }));
            // Sort so default is first (optional, but good for consistency)
            updatedPipelines.sort((a: any, b: any) => (b.is_default === true ? 1 : 0) - (a.is_default === true ? 1 : 0));
            setPipelines(updatedPipelines);
        } catch (error) {
            console.error('Failed to set default pipeline', error);
            setToast({
                type: 'error',
                title: 'Error',
                message: 'Failed to set default pipeline'
            });
        }
    };

    const handleEditLeadClick = async (lead: Lead) => {
        setEditingLead(lead);
        setIsEditLeadModalOpen(true);
        setActiveTab('opportunity');

        // Fetch related data
        try {
            const [fetchedNotes, fetchedTasks, fetchedAppointments, fetchedCallLogs] = await Promise.all([
                getNotes(lead.id),
                getTasks(lead.id),
                getAppointments(lead.id),
                getCallLogs(lead.id)
            ]);
            setNotes(fetchedNotes);
            setTasks(fetchedTasks);
            setAppointments(fetchedAppointments);
            setCallLogs(fetchedCallLogs);
        } catch (e) {
            console.error("Error fetching lead details", e);
        }
    };

    const handleDeleteLeadClick = async (leadId: string) => {
        if (window.confirm('Are you sure you want to delete this lead?')) {
            try {
                await deleteLead(leadId);
                fetchBoardData(selectedPipelineId || '');
                setToast({
                    type: 'success',
                    title: 'Lead Deleted',
                    message: 'Lead has been deleted successfully.'
                });
            } catch (error) {
                console.error('Failed to delete lead', error);
                setToast({
                    type: 'error',
                    title: 'Error',
                    message: 'Failed to delete lead.'
                });
            }
        }
    };

    const handleAddNote = async () => {
        if (!editingLead.id || !newNote.title || !newNote.content) return;
        try {
            await createNote({
                lead_id: editingLead.id,
                title: newNote.title,
                content: newNote.content,
                tags: newNote.tags.split(',').map(t => t.trim()).filter(Boolean)
            });
            const updatedNotes = await getNotes(editingLead.id);
            setNotes(updatedNotes);
            setNewNote({ title: '', content: '', tags: '' });
            setToast({ type: 'success', title: 'Note Added', message: 'Note added successfully.' });
        } catch (e) {
            console.error(e);
            setToast({ type: 'error', title: 'Error', message: 'Failed to add note.' });
        }
    };

    const handleAddFollowUp = async () => {
        if (!editingLead.id || !newTask.title) return;
        try {
            await createTask({
                lead_id: editingLead.id,
                title: newTask.title,
                description: newTask.description,
                due_date: newTask.due_date
            });
            const updatedTasks = await getTasks(editingLead.id);
            setTasks(updatedTasks);
            setNewTask({ title: '', description: '', due_date: '' });
            setToast({ type: 'success', title: 'Task Added', message: 'Follow-up task added successfully.' });
        } catch (e) {
            console.error(e);
            setToast({ type: 'error', title: 'Error', message: 'Failed to add task.' });
        }
    };

    const handleAddAppointment = async () => {
        if (!editingLead.id || !newAppointment.title || !newAppointment.start_time) return;
        try {
            await createAppointment({
                lead_id: editingLead.id,
                title: newAppointment.title,
                start_time: newAppointment.start_time,
                end_time: newAppointment.end_time,
                description: newAppointment.description
            });
            const updatedAppointments = await getAppointments(editingLead.id);
            setAppointments(updatedAppointments);
            setNewAppointment({ title: '', start_time: '', end_time: '', description: '' });
            setToast({ type: 'success', title: 'Appointment Added', message: 'Appointment scheduled successfully.' });
        } catch (e) {
            console.error(e);
            setToast({ type: 'error', title: 'Error', message: 'Failed to add appointment.' });
        }
    };

    const handleAddCallLog = async () => {
        if (!editingLead.id) return;
        try {
            await createCallLog({
                lead_id: editingLead.id,
                call_type: newCallLog.call_type,
                duration: newCallLog.duration,
                notes: newCallLog.notes,
                called_at: newCallLog.called_at || new Date().toISOString()
            });
            const updatedCallLogs = await getCallLogs(editingLead.id);
            setCallLogs(updatedCallLogs);
            setNewCallLog({ call_type: 'outbound', duration: 0, notes: '', called_at: '' });
            setToast({ type: 'success', title: 'Call Log Added', message: 'Call log added successfully.' });
        } catch (e) {
            console.error(e);
            setToast({ type: 'error', title: 'Error', message: 'Failed to add call log.' });
        }
    };

    const handleSaveLead = async () => {
        if (!editingLead.id) return;
        setLeadLoading(true);
        try {
            await updateLead(editingLead.id, editingLead);
            setIsEditLeadModalOpen(false);
            setEditingLead({});
            fetchBoardData(selectedPipelineId || '');
            setToast({
                type: 'success',
                title: 'Lead Updated',
                message: 'Lead details updated successfully.'
            });
        } catch (error) {
            console.error('Failed to save lead', error);
            setToast({
                type: 'error',
                title: 'Error',
                message: 'Failed to save lead details.'
            });
        } finally {
            setLeadLoading(false);
        }
    };

    // Export Leads to CSV
    const handleExportLeads = () => {
        if (!filteredBoardData) return;

        // Collect all leads from filtered columns
        const allLeads: Lead[] = [];
        filteredBoardData.columns.forEach(col => {
            col.leads.forEach(lead => {
                allLeads.push({
                    ...lead,
                    stage_name: col.stage.name
                } as any);
            });
        });

        if (allLeads.length === 0) {
            setToast({
                type: 'warning',
                title: 'No Leads',
                message: 'No leads to export with current filters.'
            });
            return;
        }

        // Create CSV content
        const headers = [
            'Name',
            'Email',
            'Phone',
            'Company',
            'Stage',
            'Value',
            'Status',
            'Source',
            'Created At',
            'Last Contact'
        ];

        const csvRows = [headers.join(',')];

        allLeads.forEach(lead => {
            const row = [
                `"${(lead.name || '').replace(/"/g, '""')}"`,
                `"${(lead.email || '').replace(/"/g, '""')}"`,
                `"${(lead.phone || '').replace(/"/g, '""')}"`,
                `"${(lead.company || '').replace(/"/g, '""')}"`,
                `"${((lead as any).stage_name || '').replace(/"/g, '""')}"`,
                lead.estimated_value || 0,
                `"${(lead.status || '').replace(/"/g, '""')}"`,
                `"${(lead.source || '').replace(/"/g, '""')}"`,
                `"${lead.created_at ? new Date(lead.created_at).toLocaleString() : ''}"`,
                `"${lead.last_contacted_at ? new Date(lead.last_contacted_at).toLocaleString() : ''}"`
            ];
            csvRows.push(row.join(','));
        });

        const csvContent = csvRows.join('\n');

        // Create download link
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        // Generate filename with filters info
        let filename = 'leads';
        if (filters.stageIds.length > 0) {
            filename += '_filtered_stages';
        }
        if (filters.search) {
            filename += '_search';
        }
        if (filters.quickFilter !== 'all') {
            filename += `_${filters.quickFilter}`;
        }
        filename += `_${new Date().toISOString().split('T')[0]}.csv`;

        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setToast({
            type: 'success',
            title: 'Export Successful',
            message: `Exported ${allLeads.length} lead(s) to CSV.`
        });
    };

    // Scroll Sync Logic
    const mainScrollRef = useRef<HTMLDivElement>(null);
    const topScrollRef = useRef<HTMLDivElement>(null);
    const [contentScrollWidth, setContentScrollWidth] = useState(0);

    const handleSyncScroll = (source: 'top' | 'main') => {
        const top = topScrollRef.current;
        const main = mainScrollRef.current;
        if (!top || !main) return;

        if (source === 'top') {
            if (main.scrollLeft !== top.scrollLeft) {
                main.scrollLeft = top.scrollLeft;
            }
        } else {
            if (top.scrollLeft !== main.scrollLeft) {
                top.scrollLeft = main.scrollLeft;
            }
        }
    };

    useEffect(() => {
        const updateWidth = () => {
            if (mainScrollRef.current) {
                setContentScrollWidth(mainScrollRef.current.scrollWidth);
            }
        };

        // Delay to allow layout to settle
        const timer = setTimeout(updateWidth, 100);
        window.addEventListener('resize', updateWidth);

        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', updateWidth);
        };
    }, [filteredBoardData, viewMode]);

    return (
        <div className="w-full h-[calc(100vh-190px)] flex flex-col bg-[var(--color-bg)]">
            {/* Toolbar */}
            {/* Toolbar */}
            <div className="sticky top-0 z-10 bg-[var(--color-bg)] pt-4 px-4 md:px-6 pb-2">
                <div className="p-1.5 rounded-2xl border border-[var(--color-border)] bg-gradient-to-r from-slate-50 to-white shadow-sm flex flex-col gap-2">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                        <div className="flex items-center gap-2 w-full md:w-auto">
                            {/* Pipeline Selector */}
                            <div className="relative group flex-1 md:flex-none w-full md:w-auto">
                                {/* Avatar Overlay */}
                                {selectedPipeline && (
                                    <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center pointer-events-none z-10">
                                        <span className="text-emerald-700 font-black text-[10px]">{selectedPipeline.name.charAt(0).toUpperCase()}</span>
                                    </div>
                                )}

                                <select
                                    value={selectedPipelineId || ''}
                                    onChange={(e) => setSelectedPipelineId(e.target.value)}
                                    className="w-full md:w-auto appearance-none pl-9 pr-8 py-1.5 bg-[var(--color-input-bg)] border border-[var(--color-brand)] rounded-xl text-sm font-black text-slate-900 focus:ring-2 focus:ring-[var(--color-brand)] focus:border-transparent outline-none shadow-sm min-w-[180px] cursor-pointer hover:border-[var(--color-brand)]/80 transition-colors uppercase tracking-tight"
                                >
                                    {pipelines.length === 0 && <option value="">No Pipelines</option>}
                                    {pipelines.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-brand)] transition-colors">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                </div>
                            </div>

                            {/* Pipeline Actions */}
                            <div className="flex items-center gap-1 shrink-0">
                                <button
                                    onClick={() => setIsCreatingPipeline(true)}
                                    className="p-1.5 text-[var(--color-text)] opacity-40 hover:text-[var(--color-brand)] hover:bg-[var(--color-brand)]/10 rounded-lg transition-colors border border-[var(--color-border)] md:border-transparent"
                                    title="New Pipeline"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                </button>
                                {selectedPipelineId && (
                                    <button
                                        onClick={handleSetDefaultPipeline}
                                        className={`p-1.5 rounded-lg transition-all border md:border-transparent ${selectedPipeline?.is_default
                                            ? 'text-[var(--color-brand)] bg-[var(--color-brand)]/10 border-[var(--color-brand)]/20'
                                            : 'text-[var(--color-text)] opacity-40 hover:text-[var(--color-text)] hover:opacity-100 hover:bg-[var(--color-surface)] border-[var(--color-border)]'
                                            }`}
                                        title={selectedPipeline?.is_default ? "Default Pipeline" : "Set as Default Pipeline"}
                                    >
                                        <svg className="w-4 h-4" fill={selectedPipeline?.is_default ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                                    </button>
                                )}
                                {selectedPipelineId && (
                                    <button
                                        onClick={handleDeletePipeline}
                                        className="p-1.5 text-[var(--color-text)] opacity-40 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-[var(--color-border)] md:border-transparent"
                                        title="Delete Pipeline"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                )}
                            </div>

                            {/* Search Bar - Inline after delete button */}
                            <div className="flex-1 max-w-lg min-w-[200px] ml-1">
                                <div className="relative group">
                                    <input
                                        type="text"
                                        placeholder="Search..."
                                        value={filters.search}
                                        onChange={e => setFilters({ ...filters, search: e.target.value })}
                                        className="w-full bg-white border border-slate-300 focus:border-[var(--color-brand)] rounded-xl pl-8 pr-8 py-1.5 text-sm text-slate-800 font-medium focus:ring-2 focus:ring-[var(--color-brand)]/20 outline-none transition-all placeholder:text-slate-400 shadow-sm hover:border-[var(--color-brand)]/60"
                                    />
                                    <svg className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 group-hover:text-[var(--color-brand)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                    {filters.search && (
                                        <button
                                            onClick={() => setFilters({ ...filters, search: '' })}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-slate-100 rounded-full transition-colors"
                                        >
                                            <svg className="w-3.5 h-3.5 text-slate-400 hover:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between w-full md:w-auto gap-2">
                            {/* Total Count - Just Count */}
                            <div className="bg-[var(--color-brand)]/10 text-[var(--color-brand)] px-3 py-1.5 rounded-full text-xs font-bold border border-[var(--color-brand)]/20 flex items-center gap-2 whitespace-nowrap shadow-sm min-w-[3rem] justify-center" title="Total Leads">
                                {totalLeads}
                            </div>

                            <div className="flex items-center gap-1.5">
                                {/* Sort Dropdown */}
                                <div className="relative">
                                    <select
                                        value={filters.sortBy}
                                        onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
                                        className="bg-white border border-[var(--color-brand)]/20 focus:border-[var(--color-brand)] rounded-xl pl-2.5 pr-7 py-1.5 text-sm text-[var(--color-brand)] font-medium focus:ring-1 focus:ring-[var(--color-brand)] outline-none transition-all appearance-none cursor-pointer hover:bg-[var(--color-brand)]/5 shadow-sm"
                                    >
                                        <option value="created_at_desc">Newest First</option>
                                        <option value="created_at_asc">Oldest First</option>
                                        <option value="value_desc">Value: High to Low</option>
                                        <option value="value_asc">Value: Low to High</option>
                                    </select>
                                    <svg className="w-3.5 h-3.5 text-[var(--color-brand)]/70 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                </div>

                                {/* Quick Filter Dropdown */}
                                <div className="relative">
                                    <select
                                        value={filters.quickFilter}
                                        onChange={(e) => setFilters({ ...filters, quickFilter: e.target.value })}
                                        className={`border rounded-xl pl-2.5 pr-7 py-1.5 text-sm focus:ring-1 outline-none transition-all appearance-none cursor-pointer shadow-sm font-medium ${filters.quickFilter !== 'all'
                                            ? 'bg-[var(--color-brand)] text-white border-[var(--color-brand)]'
                                            : 'bg-white text-[var(--color-brand)] border-[var(--color-brand)]/20 focus:border-[var(--color-brand)] focus:ring-[var(--color-brand)] hover:bg-[var(--color-brand)]/5'
                                            }`}
                                    >
                                        <option value="all">All Leads</option>
                                        <option value="hot">🔥 Hot Leads</option>
                                        <option value="cold">❄️ Cold Leads</option>
                                        <option value="high_value">💰 High Value</option>
                                    </select>
                                    <svg className={`w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${filters.quickFilter !== 'all' ? 'text-white' : 'text-[var(--color-brand)]/70'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                </div>

                                {/* Filters Toggle Button - Icon Only */}
                                <button
                                    onClick={() => setShowFilters(!showFilters)}
                                    className={`p-2 rounded-xl text-sm font-medium transition-all flex items-center justify-center shadow-sm ${showFilters
                                        ? 'bg-[var(--color-brand)] text-white'
                                        : 'bg-white border border-[var(--color-brand)]/20 text-[var(--color-brand)] hover:bg-[var(--color-brand)]/5'
                                        }`}
                                    title="Filter by Stage"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                                    {filters.stageIds.length > 0 && (
                                        <span className="ml-1 bg-[var(--color-brand)] text-white px-1 h-3.5 flex items-center justify-center rounded-full text-[9px] font-bold">
                                            {filters.stageIds.length}
                                        </span>
                                    )}
                                </button>

                                {/* Export Button - Icon Only */}
                                <button
                                    onClick={handleExportLeads}
                                    className="p-2 rounded-xl text-sm font-medium transition-all flex items-center justify-center bg-white border border-[var(--color-brand)]/20 text-[var(--color-brand)] hover:bg-[var(--color-brand)]/5 shadow-sm"
                                    title="Export Leads to CSV"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </button>

                                {/* View Toggles */}
                                <div className="flex bg-[var(--color-bg)] p-0.5 rounded-xl border border-[var(--color-brand)]/20 shadow-sm">
                                    <button
                                        onClick={() => setViewMode('kanban')}
                                        className={`p-1.5 rounded-lg transition-all ${viewMode === 'kanban' ? 'bg-[var(--color-brand)]/10 text-[var(--color-brand)] shadow-sm' : 'text-[var(--color-brand)]/40 hover:text-[var(--color-brand)] hover:bg-[var(--color-brand)]/5'}`}
                                        title="Kanban View"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                                    </button>
                                    <button
                                        onClick={() => setViewMode('list')}
                                        className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-[var(--color-brand)]/10 text-[var(--color-brand)] shadow-sm' : 'text-[var(--color-brand)]/40 hover:text-[var(--color-brand)] hover:bg-[var(--color-brand)]/5'}`}
                                        title="List View"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Stage Filters - Collapsible */}
                    {showFilters && (
                        <div className="p-4 md:p-5 bg-[var(--color-surface)] border-b md:border md:border-t-0 border-[var(--color-border)] md:rounded-b-2xl shadow-sm animate-in fade-in slide-in-from-top-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-bold text-[var(--color-text)] opacity-50 uppercase tracking-wider mr-2">Stage:</span>
                                <button
                                    onClick={() => setFilters({ ...filters, stageIds: [] })}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${filters.stageIds.length === 0
                                        ? 'bg-[var(--color-brand)] text-white'
                                        : 'bg-white border border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-brand)]'
                                        }`}
                                >
                                    All Stages
                                </button>
                                {boardData?.columns.map(col => (
                                    <button
                                        key={col.stage.id}
                                        onClick={() => {
                                            const newStageIds = filters.stageIds.includes(col.stage.id)
                                                ? filters.stageIds.filter(id => id !== col.stage.id)
                                                : [...filters.stageIds, col.stage.id];
                                            setFilters({ ...filters, stageIds: newStageIds });
                                        }}
                                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${filters.stageIds.includes(col.stage.id)
                                            ? 'bg-[var(--color-brand)] text-white'
                                            : 'bg-white border border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-brand)]'
                                            }`}
                                    >
                                        <span className={`w-2 h-2 rounded-full ${filters.stageIds.includes(col.stage.id) ? 'bg-white' : ''}`} style={{ backgroundColor: filters.stageIds.includes(col.stage.id) ? undefined : col.stage.color }}></span>
                                        {col.stage.name}
                                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${filters.stageIds.includes(col.stage.id) ? 'bg-white/20' : 'bg-slate-100'}`}>
                                            {col.total_count}
                                        </span>
                                    </button>
                                ))}
                                {(filters.search || filters.stageIds.length > 0 || filters.quickFilter !== 'all') && (
                                    <button
                                        onClick={() => setFilters({ search: '', stageIds: [], sortBy: 'created_at_desc', quickFilter: 'all', viewType: 'Pipeline' })}
                                        className="ml-auto text-xs text-[var(--color-brand)] hover:underline font-medium flex items-center gap-1"
                                    >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        Clear all
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
            <Modal
                isOpen={isDeletePipelineModalOpen}
                onClose={() => setIsDeletePipelineModalOpen(false)}
                title="Delete Pipeline"
                footer={
                    <div className="flex gap-2">
                        <button
                            onClick={() => setIsDeletePipelineModalOpen(false)}
                            className="px-4 py-2 text-[var(--color-text)] opacity-70 hover:opacity-100 hover:bg-[var(--color-bg)] rounded-lg transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={confirmDeletePipeline}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors shadow-sm"
                        >
                            Delete Pipeline
                        </button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <p className="text-[var(--color-text)] opacity-80">
                        Are you sure you want to delete the pipeline <span className="font-bold text-[var(--color-text)]">"{selectedPipeline?.name}"</span>?
                    </p>
                    <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
                        <svg className="w-5 h-5 text-red-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        <div className="text-sm">
                            <p className="font-bold text-red-900">This action cannot be undone.</p>
                            <p className="text-red-800 mt-1">All stages and leads within this pipeline will be permanently deleted.</p>
                        </div>
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={isDeleteStageModalOpen}
                onClose={() => setIsDeleteStageModalOpen(false)}
                title="Delete Stage"
                footer={
                    <div className="flex gap-2">
                        <button
                            onClick={() => setIsDeleteStageModalOpen(false)}
                            className="px-4 py-2 text-[var(--color-text)] opacity-70 hover:opacity-100 hover:bg-[var(--color-bg)] rounded-lg transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={confirmDeleteStage}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors shadow-sm"
                        >
                            Delete Stage
                        </button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <p className="text-[var(--color-text)] opacity-80">
                        Are you sure you want to delete this stage?
                    </p>
                    <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
                        <svg className="w-5 h-5 text-red-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        <div className="text-sm">
                            <p className="font-bold text-red-900">This action cannot be undone.</p>
                            <p className="text-red-800 mt-1">All leads in this stage will be lost or need to be moved.</p>
                        </div>
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={isCreatingPipeline}
                onClose={() => setIsCreatingPipeline(false)}
                title="Create Pipeline"
                footer={
                    <div className="flex gap-2">
                        <button
                            onClick={() => setIsCreatingPipeline(false)}
                            className="px-4 py-2 text-[var(--color-text)] opacity-70 hover:opacity-100 hover:bg-[var(--color-bg)] rounded-lg transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleCreatePipeline}
                            className="px-4 py-2 bg-[var(--color-brand)] text-white rounded-lg font-bold hover:opacity-90 transition-opacity"
                        >
                            Create
                        </button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold mb-1 text-[var(--color-text)]">Pipeline Name</label>
                        <input
                            type="text"
                            value={newPipelineName}
                            onChange={(e) => setNewPipelineName(e.target.value)}
                            placeholder="e.g. Sales Pipeline"
                            className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                            autoFocus
                        />
                    </div>
                </div>
            </Modal>

            <DatabaseSetup isOpen={showDbSetup} onClose={() => setShowDbSetup(false)} />

            <Modal
                isOpen={isCreatingStage}
                onClose={() => setIsCreatingStage(false)}
                title="Add New Stage"
                footer={
                    <div className="flex gap-2">
                        <button
                            onClick={() => setIsCreatingStage(false)}
                            className="px-4 py-2 text-[var(--color-text)] opacity-70 hover:opacity-100 hover:bg-[var(--color-bg)] rounded-lg transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleCreateStage}
                            className="px-4 py-2 bg-[var(--color-brand)] text-white rounded-lg font-bold hover:opacity-90 transition-opacity"
                        >
                            Create Stage
                        </button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold mb-1 text-[var(--color-text)]">Stage Name</label>
                        <input
                            type="text"
                            value={newStageName}
                            onChange={(e) => setNewStageName(e.target.value)}
                            placeholder="e.g. Negotiation"
                            className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                            autoFocus
                        />
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={isEditStageModalOpen}
                onClose={() => setIsEditStageModalOpen(false)}
                title="Edit Stage"
                footer={
                    <div className="flex gap-2">
                        <button
                            onClick={() => setIsEditStageModalOpen(false)}
                            className="px-4 py-2 text-[var(--color-text)] opacity-70 hover:opacity-100 hover:bg-[var(--color-bg)] rounded-lg transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSaveStage}
                            disabled={stageLoading}
                            className="px-4 py-2 bg-[var(--color-brand)] text-white rounded-lg font-bold hover:opacity-90 transition-opacity"
                        >
                            {stageLoading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold mb-1 text-[var(--color-text)]">Stage Name</label>
                        <input
                            type="text"
                            value={editingStage.name || ''}
                            onChange={(e) => setEditingStage({ ...editingStage, name: e.target.value })}
                            className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold mb-1 text-[var(--color-text)]">Color</label>
                        <div className="flex gap-2 items-center">
                            <input
                                type="color"
                                value={editingStage.color || '#3b82f6'}
                                onChange={(e) => setEditingStage({ ...editingStage, color: e.target.value })}
                                className="h-8 w-8 rounded cursor-pointer border-0 p-0"
                            />
                            <input
                                type="text"
                                value={editingStage.color || ''}
                                onChange={(e) => setEditingStage({ ...editingStage, color: e.target.value })}
                                className="flex-1 border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                            />
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Content Area */}
            < div className="flex-1 overflow-hidden bg-[var(--color-bg)]" >
                {loading && !boardData ? (
                    <div className="flex justify-center items-center h-full text-slate-400 font-medium animate-pulse">Loading Pipeline...</div>
                ) : viewMode === 'kanban' ? (
                    /* Kanban View */
                    <div className="flex flex-col h-full overflow-hidden">
                        {/* Top Scrollbar Dummy Container */}
                        <div
                            ref={topScrollRef}
                            onScroll={() => handleSyncScroll('top')}
                            className="overflow-x-auto flex-shrink-0 px-4 md:px-6"
                            style={{ minHeight: '16px' }} // Standard scrollbar height
                        >
                            <div style={{ width: contentScrollWidth, height: '1px' }}></div>
                        </div>

                        <div
                            ref={mainScrollRef}
                            onScroll={() => handleSyncScroll('main')}
                            className="flex-1 overflow-x-auto overflow-y-hidden p-4 md:p-6 snap-x snap-mandatory"
                        >
                            <div className="flex h-full gap-4 md:gap-6">
                                {filteredBoardData?.columns.map(column => (
                                    <div
                                        key={column.stage.id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, 'stage', column.stage.id)}
                                        className="w-[85vw] md:w-80 flex-shrink-0 flex flex-col bg-[var(--color-surface)]/50 rounded-2xl border border-[var(--color-border)] h-full backdrop-blur-sm snap-center"
                                        onDragOver={handleDragOver}
                                        onDrop={(e) => handleDrop(e, column.stage.id)}
                                    >
                                        {/* Column Header */}
                                        <div className="p-4 flex justify-between items-center rounded-t-2xl group cursor-move transition-colors" style={{ backgroundColor: column.stage.color }}>
                                            <div className="flex items-center gap-3">
                                                <h3 className="font-bold text-white text-sm tracking-wide">{column.stage.name}</h3>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="bg-white/20 text-white text-xs px-2.5 py-1 rounded-full font-bold shadow-sm backdrop-blur-sm">{column.total_count}</span>
                                                {/* Stage Actions */}
                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                                    <button onClick={() => handleEditStageClick(column.stage)} className="p-1 text-white/70 hover:text-white hover:bg-white/20 rounded-lg transition-colors" title="Edit Stage"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                                                    <button onClick={() => handleDeleteStageClick(column.stage.id)} className="p-1 text-white/70 hover:text-white hover:bg-white/20 rounded-lg transition-colors" title="Delete Stage"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Leads List */}
                                        <div
                                            className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar-dark"
                                            onScroll={(e) => {
                                                const target = e.currentTarget;
                                                // Trigger load more when 200px from bottom
                                                if (target.scrollHeight - target.scrollTop <= target.clientHeight + 200) {
                                                    loadMoreLeadsForStage(column.stage.id);
                                                }
                                            }}
                                        >
                                            {column.leads.map(lead => {
                                                const colors = ['bg-blue-100 text-blue-700', 'bg-emerald-100 text-emerald-700', 'bg-violet-100 text-violet-700', 'bg-amber-100 text-amber-700', 'bg-rose-100 text-rose-700', 'bg-indigo-100 text-indigo-700', 'bg-cyan-100 text-cyan-700'];
                                                const colorIndex = (lead.id.charCodeAt(0) + (lead.name?.length || 0)) % colors.length;
                                                const avatarClass = colors[colorIndex];

                                                return (
                                                    <div
                                                        key={lead.id}
                                                        draggable
                                                        onDragStart={(e) => handleDragStart(e, 'lead', lead.id)}
                                                        className="bg-[var(--color-surface)] p-4 rounded-xl shadow-sm border border-[var(--color-border)] cursor-move hover:shadow-lg hover:-translate-y-1 transition-all duration-200 group relative animate-in fade-in slide-in-from-bottom-2"
                                                    >
                                                        <div className="absolute left-0 top-0 right-0 h-1 rounded-t-xl" style={{ backgroundColor: column.stage.color }}></div>

                                                        <div className="flex justify-between items-center mb-1.5">
                                                            <div className="flex items-center gap-2 overflow-hidden">
                                                                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${avatarClass}`}>
                                                                    {(lead.name || '?').charAt(0).toUpperCase()}
                                                                </div>
                                                                <div className="text-[12px] font-medium text-black truncate pr-2">{lead.name || 'Unnamed Lead'}</div>
                                                            </div>
                                                        </div>

                                                        <div className="space-y-0.5 mb-1.5 bg-gradient-to-br from-slate-50 to-white p-1.5 rounded-lg border border-slate-200/60 shadow-sm">
                                                            {lead.company && (
                                                                <div className="text-[12px] text-black font-medium flex items-center gap-1.5">
                                                                    <div className="w-4 h-4 rounded-md bg-white border border-slate-100 flex items-center justify-center shadow-sm text-slate-400 shrink-0">
                                                                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                                                    </div>
                                                                    {lead.company}
                                                                </div>
                                                            )}
                                                            {lead.email && (
                                                                <div className="text-[12px] text-black font-medium flex items-center gap-1.5 truncate">
                                                                    <div className="w-4 h-4 rounded-md bg-white border border-slate-100 flex items-center justify-center shadow-sm text-slate-400 shrink-0">
                                                                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                                                    </div>
                                                                    <span className="truncate">{lead.email}</span>
                                                                </div>
                                                            )}
                                                            {lead.phone && (
                                                                <div className="text-[12px] text-black font-medium flex items-center gap-1.5">
                                                                    <div className="w-4 h-4 rounded-md bg-white border border-slate-100 flex items-center justify-center shadow-sm text-slate-400 shrink-0">
                                                                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                                                    </div>
                                                                    {lead.phone}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {lead.tags && lead.tags.length > 0 && (
                                                            <div className="flex flex-wrap gap-1 mb-1.5">
                                                                {lead.tags.slice(0, 3).map(tag => (
                                                                    <span key={tag} className="text-[9px] bg-[var(--color-bg)] text-[var(--color-text)] opacity-60 px-1.5 py-0.5 rounded-md font-medium">
                                                                        {tag}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}


                                                        <div className="flex justify-between items-center py-2 px-1">
                                                            {/* Left Side: Actions */}
                                                            <div className="flex items-center gap-1">
                                                                {/* Edit */}
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleEditLeadClick(lead); }}
                                                                    className="p-1.5 text-[var(--color-text)] opacity-60 hover:opacity-100 hover:text-[var(--color-brand)] hover:bg-[var(--color-brand)]/10 rounded-lg transition-colors group/btn"
                                                                    title="Edit Lead"
                                                                >
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                                </button>

                                                                {/* WhatsApp */}
                                                                {lead.phone && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            const cleanPhone = lead.phone.replace(/\D/g, '');
                                                                            // Default to 91 (India) if 10 digits, otherwise use as-is
                                                                            const finalPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
                                                                            window.open(`https://api.whatsapp.com/send/?phone=${finalPhone}&text=Hello`, '_blank');
                                                                        }}
                                                                        className="p-1.5 text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-colors group/btn"
                                                                        title="WhatsApp"
                                                                    >
                                                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                                                                    </button>
                                                                )}

                                                                {/* Email */}
                                                                {lead.email && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setEmailRecipient({ email: lead.email, name: lead.name || '' });
                                                                            setIsEmailModalOpen(true);
                                                                        }}
                                                                        className="p-1.5 text-[var(--color-text)] opacity-60 hover:opacity-100 hover:text-[var(--color-brand)] hover:bg-[var(--color-brand)]/10 rounded-lg transition-colors group/btn"
                                                                        title="Email"
                                                                    >
                                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                                                    </button>
                                                                )}

                                                                {/* Add Task */}
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleEditLeadClick(lead);
                                                                        setTimeout(() => setActiveTab('follow_up'), 100);
                                                                    }}
                                                                    className="p-1.5 text-[var(--color-text)] opacity-60 hover:opacity-100 hover:text-[var(--color-brand)] hover:bg-[var(--color-brand)]/10 rounded-lg transition-colors group/btn"
                                                                    title="Add Task"
                                                                >
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                                                                </button>

                                                                {/* Team Assignment */}
                                                                <LeadAssignment 
                                                                    leadId={lead.id} 
                                                                    contact={lead} 
                                                                    onAssigned={() => loadBoard(selectedPipelineId!)}
                                                                />

                                                                {/* Delete */}
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleDeleteLeadClick(lead.id); }}
                                                                    className="p-1.5 text-[var(--color-text)] opacity-60 hover:opacity-100 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors group/btn"
                                                                    title="Delete Lead"
                                                                >
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                                </button>
                                                            </div>

                                                            {/* Right Side: Date */}
                                                            <div className="flex items-center gap-2">
                                                                <div className="text-[10px] text-[var(--color-text)] font-semibold tracking-wide">
                                                                    {new Date(lead.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                                </div>
                                                                {lead.owner_id && (
                                                                    <div className="w-5 h-5 rounded-full bg-[var(--color-brand)]/10 flex items-center justify-center text-[10px] font-bold text-[var(--color-brand)]">U</div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Original hover actions removed since we now have dedicated buttons */}
                                                        {/* <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2 bg-[var(--color-surface)]/90 rounded p-1 shadow-sm"> ... </div> */}
                                                    </div>
                                                );
                                            })}
                                            {loadingStage[column.stage.id] && (
                                                <div className="space-y-3 pt-2">
                                                    {[1, 2].map((i) => (
                                                        <div key={i} className="bg-[var(--color-surface)] p-4 rounded-xl border border-[var(--color-border)] opacity-60 animate-pulse">
                                                            <div className="flex justify-between items-center mb-1.5">
                                                                <div className="h-4 bg-slate-200 rounded w-1/3"></div>
                                                            </div>
                                                            <div className="space-y-1">
                                                                <div className="h-3 bg-slate-100 rounded w-3/4"></div>
                                                                <div className="h-3 bg-slate-100 rounded w-1/2"></div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {/* Add Stage Button */}
                                <button
                                    onClick={() => setIsCreatingStage(true)}
                                    className="w-[85vw] md:w-80 flex-shrink-0 flex flex-col items-center justify-center border-2 border-dashed border-[var(--color-border)] rounded-2xl h-[50vh] md:h-auto md:min-h-[200px] my-auto text-[var(--color-text)] opacity-40 hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] hover:bg-[var(--color-brand)]/5 cursor-pointer transition-all duration-200 group snap-center"
                                >
                                    <div className="w-12 h-12 md:w-10 md:h-10 rounded-full bg-[var(--color-bg)] flex items-center justify-center mb-3 group-hover:bg-[var(--color-surface)] group-hover:shadow-md transition-all">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                    </div>
                                    <span className="font-bold text-base md:text-sm">Add New Stage</span>
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* List View */
                    /* List View */
                    <div className="h-full overflow-auto p-4 md:p-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                        {/* Mobile Card View */}
                        <div className="md:hidden space-y-3 pb-20">
                            {filteredBoardData?.columns.flatMap(col => col.leads.map(lead => ({ ...lead, stageName: col.stage.name, stageColor: col.stage.color }))).map(lead => (
                                <div
                                    key={lead.id}
                                    onClick={() => handleEditLeadClick(lead)}
                                    className="bg-[var(--color-surface)] p-4 rounded-xl border border-[var(--color-border)] shadow-sm active:scale-[0.98] transition-transform"
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h4 className="text-sm font-bold text-slate-800">{lead.name || 'Unnamed'}</h4>
                                            <p className="text-xs text-[var(--color-text)] opacity-60">{lead.company}</p>
                                        </div>
                                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[var(--color-bg)] text-[var(--color-text)] border border-[var(--color-border)]" style={{ color: lead.stageColor, borderColor: `${lead.stageColor}40`, backgroundColor: `${lead.stageColor}10` }}>
                                            {lead.stageName}
                                        </span>
                                    </div>

                                    <div className="space-y-2 mb-4">
                                        {lead.email && (
                                            <div className="flex items-center gap-2 text-xs text-[var(--color-text)] opacity-70">
                                                <svg className="w-3.5 h-3.5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                                {lead.email}
                                            </div>
                                        )}
                                        {lead.phone && (
                                            <div className="flex items-center gap-2 text-xs text-[var(--color-text)] opacity-70">
                                                <svg className="w-3.5 h-3.5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                                {lead.phone}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex justify-between items-center pt-3 border-t border-[var(--color-border)]">
                                        <div className="text-xs text-[var(--color-text)] opacity-50 font-medium">
                                            {new Date(lead.created_at).toLocaleDateString()}
                                        </div>
                                        {lead.estimated_value && (
                                            <div className="text-sm font-bold text-emerald-600">
                                                ${lead.estimated_value.toLocaleString()}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {(!filteredBoardData?.columns.some(c => c.leads.length > 0)) && (
                                <div className="text-center py-12 text-[var(--color-text)] opacity-40">
                                    <p>No leads found matching filters</p>
                                </div>
                            )}
                        </div>

                        {/* Desktop Table View */}
                        <div className="hidden md:block bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm overflow-hidden">
                            <table className="min-w-full divide-y divide-[var(--color-border)]">
                                <thead className="bg-[var(--color-bg)]">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-[11px] font-extrabold text-[var(--color-text)] opacity-50 uppercase tracking-wider">Lead Name</th>
                                        <th className="px-6 py-4 text-left text-[11px] font-extrabold text-[var(--color-text)] opacity-50 uppercase tracking-wider">Contact</th>
                                        <th className="px-6 py-4 text-left text-[11px] font-extrabold text-[var(--color-text)] opacity-50 uppercase tracking-wider">Company</th>
                                        <th className="px-6 py-4 text-left text-[11px] font-extrabold text-[var(--color-text)] opacity-50 uppercase tracking-wider">Pipeline/Stage</th>
                                        <th className="px-6 py-4 text-left text-[11px] font-extrabold text-[var(--color-text)] opacity-50 uppercase tracking-wider">Assigned To</th>
                                        <th className="px-6 py-4 text-left text-[11px] font-extrabold text-[var(--color-text)] opacity-50 uppercase tracking-wider">Value</th>
                                        <th className="px-6 py-4 text-left text-[11px] font-extrabold text-[var(--color-text)] opacity-50 uppercase tracking-wider">Created</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
                                    {filteredBoardData?.columns.flatMap(col => col.leads.map(lead => ({ ...lead, stageName: col.stage.name, stageColor: col.stage.color }))).map(lead => (
                                        <tr key={lead.id} className="hover:bg-[var(--color-bg)] transition-colors cursor-pointer" onClick={() => handleEditLeadClick(lead)}>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-bold text-slate-800">{lead.name || 'Unnamed'}</div>
                                                <div className="flex gap-1 mt-1">
                                                    {lead.tags?.map(tag => (
                                                        <span key={tag} className="text-[10px] bg-[var(--color-bg)] text-[var(--color-text)] opacity-70 px-1.5 py-0.5 rounded">
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-[var(--color-text)] opacity-80">{lead.email}</div>
                                                <div className="text-xs text-[var(--color-text)] opacity-50">{lead.phone}</div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-[var(--color-text)] opacity-80">{lead.company || '-'}</td>
                                            <td className="px-6 py-4">
                                                <PipelineAssignment leadId={lead.id} contact={lead} onAssignmentComplete={() => loadBoardData(selectedPipelineId!)} />
                                            </td>
                                            <td className="px-6 py-4">
                                                <LeadAssignment leadId={lead.id} contact={lead} />
                                            </td>
                                            <td className="px-6 py-4 text-sm font-bold text-[var(--color-text)] opacity-90">
                                                {lead.estimated_value ? `$${lead.estimated_value.toLocaleString()}` : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-[var(--color-text)] opacity-60">
                                                {new Date(lead.created_at).toLocaleDateString()}
                                            </td>
                                        </tr>
                                    ))}
                                    {(!filteredBoardData?.columns.some(c => c.leads.length > 0)) && (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-[var(--color-text)] opacity-40">
                                                No leads found matching filters
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>



            {/* Edit Lead Modal */}
            <Modal
                isOpen={isEditLeadModalOpen}
                onClose={() => setIsEditLeadModalOpen(false)}
                title={`Contact Info (Edit) | Contact Type: ${editingLead.type || 'Lead'}`}
                size="3xl"
                scrollable={true}
                footer={
                    <div className="flex justify-end w-full gap-2">
                        <button
                            onClick={() => setIsEditLeadModalOpen(false)}
                            className="px-4 py-2 text-[var(--color-text)] opacity-70 hover:opacity-100 hover:bg-[var(--color-bg)] rounded-lg transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSaveLead}
                            disabled={leadLoading}
                            className="px-4 py-2 bg-[var(--color-brand)] text-white rounded-lg font-bold hover:opacity-90 transition-opacity"
                        >
                            {leadLoading ? 'Saving...' : 'UPDATE'}
                        </button>
                    </div>
                }
            >
                <div className="flex flex-col h-full">
                    {/* Tabs */}
                    <div className="sticky top-0 z-10 bg-[var(--color-surface)] pb-4 mb-4 border-b border-[var(--color-border)]">
                        <div className="flex gap-2 overflow-x-auto no-scrollbar">
                            {['Opportunity', 'Additional Info', 'Call Logs', 'Follow-up', 'Notes', 'Appointments'].map(tab => {
                                const tabKey = tab.toLowerCase().replace(' ', '_').replace('-', '_');
                                const isActive = activeTab === tabKey || (tabKey === 'follow_up' && activeTab === 'follow_up');
                                return (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tabKey === 'follow_up' ? 'follow_up' : tabKey)}
                                        className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors ${isActive ? 'bg-[var(--color-brand)] text-white' : 'bg-transparent text-[var(--color-text)] hover:bg-[var(--color-bg)]'}`}
                                    >
                                        {tab}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                        {activeTab === 'opportunity' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold mb-1 text-[var(--color-text)]">Opportunity Name</label>
                                    <input
                                        type="text"
                                        value={editingLead.name || ''}
                                        onChange={(e) => setEditingLead({ ...editingLead, name: e.target.value })}
                                        className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-1 text-[var(--color-text)]">Contact Name <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        value={editingLead.name || ''}
                                        onChange={(e) => setEditingLead({ ...editingLead, name: e.target.value })}
                                        className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-1 text-[var(--color-text)]">Email</label>
                                    <input
                                        type="email"
                                        value={editingLead.email || ''}
                                        onChange={(e) => setEditingLead({ ...editingLead, email: e.target.value })}
                                        className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-1 text-[var(--color-text)]">Phone</label>
                                    <PhoneInputWithCountry
                                        value={editingLead.phone || ''}
                                        onChange={(val) => setEditingLead({ ...editingLead, phone: val })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-1 text-[var(--color-text)]">City</label>
                                    <input
                                        type="text"
                                        value={editingLead.custom_data?.city || ''}
                                        onChange={(e) => setEditingLead({ ...editingLead, custom_data: { ...editingLead.custom_data, city: e.target.value } })}
                                        className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-1 text-[var(--color-text)]">Pipeline <span className="text-red-500">*</span></label>
                                    <select
                                        value={editingLead.pipeline_id || ''}
                                        onChange={(e) => setEditingLead({ ...editingLead, pipeline_id: e.target.value })}
                                        className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                    >
                                        {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-1 text-[var(--color-text)]">Stage <span className="text-red-500">*</span></label>
                                    <select
                                        value={editingLead.stage_id || ''}
                                        onChange={(e) => setEditingLead({ ...editingLead, stage_id: e.target.value })}
                                        className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                    >
                                        {boardData?.columns.map(c => <option key={c.stage.id} value={c.stage.id}>{c.stage.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-1 text-[var(--color-text)]">Created At</label>
                                    <input
                                        type="text"
                                        disabled
                                        value={editingLead.created_at ? new Date(editingLead.created_at).toLocaleString() : ''}
                                        className="w-full border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] opacity-60 rounded-lg px-3 py-2 text-sm outline-none cursor-not-allowed"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-1 text-[var(--color-text)]">Updated At</label>
                                    <input
                                        type="text"
                                        disabled
                                        value={new Date().toLocaleString()} // Mock for now
                                        className="w-full border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] opacity-60 rounded-lg px-3 py-2 text-sm outline-none cursor-not-allowed"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-1 text-[var(--color-text)]">Tags</label>
                                    <input
                                        type="text"
                                        placeholder="Add tags separated by comma"
                                        value={editingLead.tags?.join(', ') || ''}
                                        onChange={(e) => setEditingLead({ ...editingLead, tags: e.target.value.split(',').map(t => t.trim()) })}
                                        className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-1 text-[var(--color-text)]">Type</label>
                                    <select
                                        value={editingLead.type || 'Lead'}
                                        onChange={(e) => setEditingLead({ ...editingLead, type: e.target.value })}
                                        className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                    >
                                        <option value="Lead">Lead</option>
                                        <option value="Customer">Customer</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-1 text-[var(--color-text)]">Lead Value</label>
                                    <input
                                        type="number"
                                        value={editingLead.estimated_value || ''}
                                        onChange={(e) => setEditingLead({ ...editingLead, estimated_value: parseFloat(e.target.value) })}
                                        className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-1 text-[var(--color-text)]">Status</label>
                                    <select
                                        value={editingLead.status || 'active'}
                                        onChange={(e) => setEditingLead({ ...editingLead, status: e.target.value })}
                                        className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                    >
                                        <option value="active">Active</option>
                                        <option value="Hot">Hot</option>
                                        <option value="Warm">Warm</option>
                                        <option value="Cold">Cold</option>
                                        <option value="Won">Won</option>
                                        <option value="Lost">Lost</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {activeTab === 'additional_info' && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold mb-1 text-[var(--color-text)]">First Name <span className="text-red-500">*</span></label>
                                        <input
                                            type="text"
                                            value={editingLead.custom_data?.first_name || ''}
                                            onChange={(e) => setEditingLead({ ...editingLead, custom_data: { ...editingLead.custom_data, first_name: e.target.value } })}
                                            className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold mb-1 text-[var(--color-text)]">Last Name</label>
                                        <input
                                            type="text"
                                            value={editingLead.custom_data?.last_name || ''}
                                            onChange={(e) => setEditingLead({ ...editingLead, custom_data: { ...editingLead.custom_data, last_name: e.target.value } })}
                                            className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold mb-1 text-[var(--color-text)]">Email <span className="text-red-500">*</span></label>
                                        <input
                                            type="email"
                                            value={editingLead.email || ''}
                                            onChange={(e) => setEditingLead({ ...editingLead, email: e.target.value })}
                                            className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold mb-1 text-[var(--color-text)]">Phone <span className="text-red-500">*</span></label>
                                        <PhoneInputWithCountry
                                            value={editingLead.phone || ''}
                                            onChange={(val) => setEditingLead({ ...editingLead, phone: val })}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold mb-1 text-[var(--color-text)]">Contact Type</label>
                                        <select
                                            value={editingLead.type || 'Lead'}
                                            onChange={(e) => setEditingLead({ ...editingLead, type: e.target.value })}
                                            className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                        >
                                            <option value="Lead">Lead</option>
                                            <option value="Customer">Customer</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold mb-1 text-[var(--color-text)]">Business Name</label>
                                        <input
                                            type="text"
                                            value={editingLead.company || ''}
                                            onChange={(e) => setEditingLead({ ...editingLead, company: e.target.value })}
                                            className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold mb-1 text-[var(--color-text)]">GST No</label>
                                        <input
                                            type="text"
                                            value={editingLead.custom_data?.gst_no || ''}
                                            onChange={(e) => setEditingLead({ ...editingLead, custom_data: { ...editingLead.custom_data, gst_no: e.target.value } })}
                                            className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold mb-1 text-[var(--color-text)]">Business Address</label>
                                        <input
                                            type="text"
                                            value={editingLead.custom_data?.business_address || ''}
                                            onChange={(e) => setEditingLead({ ...editingLead, custom_data: { ...editingLead.custom_data, business_address: e.target.value } })}
                                            className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold mb-1 text-[var(--color-text)]">State</label>
                                        <input
                                            type="text"
                                            value={editingLead.custom_data?.state || ''}
                                            onChange={(e) => setEditingLead({ ...editingLead, custom_data: { ...editingLead.custom_data, state: e.target.value } })}
                                            className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold mb-1 text-[var(--color-text)]">Postal Code</label>
                                        <input
                                            type="text"
                                            value={editingLead.custom_data?.postal_code || ''}
                                            onChange={(e) => setEditingLead({ ...editingLead, custom_data: { ...editingLead.custom_data, postal_code: e.target.value } })}
                                            className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'call_logs' && (
                            <div className="space-y-6">
                                <div className="space-y-4 border-b border-[var(--color-border)] pb-6">
                                    <h3 className="font-bold text-[var(--color-text)]">Log Call</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <select
                                            value={newCallLog.call_type}
                                            onChange={(e) => setNewCallLog({ ...newCallLog, call_type: e.target.value })}
                                            className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                        >
                                            <option value="outbound">Outbound</option>
                                            <option value="inbound">Inbound</option>
                                            <option value="missed">Missed</option>
                                        </select>
                                        <input
                                            type="number"
                                            placeholder="Duration (seconds)"
                                            value={newCallLog.duration || ''}
                                            onChange={(e) => setNewCallLog({ ...newCallLog, duration: parseInt(e.target.value) || 0 })}
                                            className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                        />
                                    </div>
                                    <input
                                        type="datetime-local"
                                        value={newCallLog.called_at}
                                        onChange={(e) => setNewCallLog({ ...newCallLog, called_at: e.target.value })}
                                        className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                    />
                                    <textarea
                                        placeholder="Call Notes"
                                        value={newCallLog.notes}
                                        onChange={(e) => setNewCallLog({ ...newCallLog, notes: e.target.value })}
                                        className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none h-20 resize-none"
                                    />
                                    <button
                                        onClick={handleAddCallLog}
                                        className="px-4 py-2 bg-[var(--color-brand)] text-white rounded-lg font-bold hover:opacity-90 transition-opacity float-right"
                                    >
                                        Log Call
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    <h3 className="font-bold text-[var(--color-text)]">Call History</h3>
                                    {callLogs.length === 0 && <p className="text-sm text-[var(--color-text)] opacity-50">No call logs found.</p>}
                                    {callLogs.map(log => (
                                        <div key={log.id} className="p-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-sm">
                                            <div className="flex justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase ${log.call_type === 'inbound' ? 'bg-green-100 text-green-800' : log.call_type === 'missed' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                                                        {log.call_type}
                                                    </span>
                                                    <span className="text-xs text-[var(--color-text)] opacity-50">{new Date(log.called_at).toLocaleString()}</span>
                                                </div>
                                                <span className="text-xs text-[var(--color-text)] opacity-70">{log.duration}s</span>
                                            </div>
                                            <p className="text-xs text-[var(--color-text)] opacity-70 mt-1">{log.notes}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'follow_up' && (
                            <div className="space-y-6">
                                <div className="space-y-4 border-b border-[var(--color-border)] pb-6">
                                    <h3 className="font-bold text-[var(--color-text)]">Add Follow-up Task</h3>
                                    <input
                                        type="text"
                                        placeholder="Follow-up Title"
                                        value={newTask.title}
                                        onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                                        className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                    />
                                    <textarea
                                        placeholder="Description"
                                        value={newTask.description}
                                        onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                                        className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none h-20 resize-none"
                                    />
                                    <input
                                        type="datetime-local"
                                        value={newTask.due_date}
                                        onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                                        className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                    />
                                    <button
                                        onClick={handleAddFollowUp}
                                        className="px-4 py-2 bg-[var(--color-brand)] text-white rounded-lg font-bold hover:opacity-90 transition-opacity float-right"
                                    >
                                        ADD
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    <h3 className="font-bold text-[var(--color-text)]">Tasks</h3>
                                    {tasks.length === 0 && <p className="text-sm text-[var(--color-text)] opacity-50">No tasks found.</p>}
                                    {tasks.map(task => (
                                        <div key={task.id} className="p-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-sm">
                                            <div className="flex justify-between">
                                                <h4 className="font-bold text-sm text-[var(--color-text)]">{task.title}</h4>
                                                <span className="text-xs text-[var(--color-text)] opacity-50">{new Date(task.due_date).toLocaleDateString()}</span>
                                            </div>
                                            <p className="text-xs text-[var(--color-text)] opacity-70 mt-1">{task.description}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'notes' && (
                            <div className="space-y-6">
                                <div className="space-y-4 border-b border-[var(--color-border)] pb-6">
                                    <h3 className="font-bold text-[var(--color-text)]">Add Note</h3>
                                    <input
                                        type="text"
                                        placeholder="Title *"
                                        value={newNote.title}
                                        onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                                        className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Add Tags (comma separated)"
                                        value={newNote.tags}
                                        onChange={(e) => setNewNote({ ...newNote, tags: e.target.value })}
                                        className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                    />
                                    <textarea
                                        placeholder="Write Notes *"
                                        value={newNote.content}
                                        onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
                                        className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none h-32 resize-none"
                                    />
                                    <button
                                        onClick={handleAddNote}
                                        className="px-4 py-2 bg-[var(--color-brand)] text-white rounded-lg font-bold hover:opacity-90 transition-opacity float-right"
                                    >
                                        Save
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    <h3 className="font-bold text-[var(--color-text)]">Previous Notes</h3>
                                    {notes.length === 0 && <p className="text-sm text-[var(--color-text)] opacity-50">No notes found.</p>}
                                    {notes.map(note => (
                                        <div key={note.id} className="p-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-sm">
                                            <div className="flex justify-between">
                                                <h4 className="font-bold text-sm text-[var(--color-text)]">{note.title}</h4>
                                                <span className="text-xs text-[var(--color-text)] opacity-50">{new Date(note.created_at).toLocaleDateString()}</span>
                                            </div>
                                            <p className="text-xs text-[var(--color-text)] opacity-70 mt-1 whitespace-pre-wrap">{note.content}</p>
                                            {note.tags && note.tags.length > 0 && (
                                                <div className="flex gap-1 mt-2">
                                                    {note.tags.map((tag: string) => (
                                                        <span key={tag} className="text-[10px] bg-[var(--color-bg)] text-[var(--color-text)] opacity-60 px-1.5 py-0.5 rounded">
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'appointments' && (
                            <div className="space-y-6">
                                <div className="space-y-4 border-b border-[var(--color-border)] pb-6">
                                    <h3 className="font-bold text-[var(--color-text)]">Schedule Appointment</h3>
                                    <input
                                        type="text"
                                        placeholder="Title *"
                                        value={newAppointment.title}
                                        onChange={(e) => setNewAppointment({ ...newAppointment, title: e.target.value })}
                                        className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                    />
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold mb-1 text-[var(--color-text)] opacity-70">Start Time</label>
                                            <input
                                                type="datetime-local"
                                                value={newAppointment.start_time}
                                                onChange={(e) => setNewAppointment({ ...newAppointment, start_time: e.target.value })}
                                                className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold mb-1 text-[var(--color-text)] opacity-70">End Time</label>
                                            <input
                                                type="datetime-local"
                                                value={newAppointment.end_time}
                                                onChange={(e) => setNewAppointment({ ...newAppointment, end_time: e.target.value })}
                                                className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                            />
                                        </div>
                                    </div>
                                    <textarea
                                        placeholder="Description"
                                        value={newAppointment.description}
                                        onChange={(e) => setNewAppointment({ ...newAppointment, description: e.target.value })}
                                        className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none h-20 resize-none"
                                    />
                                    <button
                                        onClick={handleAddAppointment}
                                        className="px-4 py-2 bg-[var(--color-brand)] text-white rounded-lg font-bold hover:opacity-90 transition-opacity float-right"
                                    >
                                        Schedule
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    <h3 className="font-bold text-[var(--color-text)]">Upcoming Appointments</h3>
                                    {appointments.length === 0 && <p className="text-sm text-[var(--color-text)] opacity-50">No appointments found.</p>}
                                    {appointments.map(apt => (
                                        <div key={apt.id} className="p-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-sm">
                                            <div className="flex justify-between">
                                                <h4 className="font-bold text-sm text-[var(--color-text)]">{apt.title}</h4>
                                                <span className="text-xs text-[var(--color-text)] opacity-50">{new Date(apt.start_time).toLocaleString()}</span>
                                            </div>
                                            <p className="text-xs text-[var(--color-text)] opacity-70 mt-1">{apt.description}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </Modal>

            {
                toast && (
                    <Toast
                        type={toast.type}
                        title={toast.title}
                        message={toast.message}
                        onClose={() => setToast(null)}
                    />
                )
            }

            {/* Email Modal */}
            <EmailModal
                isOpen={isEmailModalOpen}
                onClose={() => setIsEmailModalOpen(false)}
                recipientEmail={emailRecipient.email}
                recipientName={emailRecipient.name}
            />
        </div >
    );
};

export default PipelineView;
