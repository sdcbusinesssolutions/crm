import React, { useState, useEffect } from 'react';
import { submissionService, Flow, Submission } from '../../services/submissionService';
import { ChevronLeftIcon, UsersIcon, TriggerIcon, ChevronRightIcon } from '../icons';
import { usePermissions, ACCESS_TYPES } from '../../modules/teamStaff/hooks/usePermissions';

export const ContactForms: React.FC = () => {
    const { hasAccess } = usePermissions();
    const canRead = hasAccess('Form Contact', ACCESS_TYPES.READ);
    const canWrite = hasAccess('Form Contact', ACCESS_TYPES.READ_WRITE);
    const canDelete = hasAccess('Form Contact', ACCESS_TYPES.ALL_ACCESS);

    const [view, setView] = useState<'flows' | 'submissions'>('flows');
    const [displayMode, setDisplayMode] = useState<'list' | 'grid'>('list'); // Default to list
    const [flows, setFlows] = useState<Flow[]>([]);
    const [selectedFlow, setSelectedFlow] = useState<Flow | null>(null);
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [loading, setLoading] = useState(false);

    // Pagination & Filter State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const [searchQuery, setSearchQuery] = useState('');

    // Selection state for Bulk Actions
    const [selectedSubmissions, setSelectedSubmissions] = useState<Set<string>>(new Set());

    // Edit State
    const [editingSubmission, setEditingSubmission] = useState<Submission | null>(null);
    const [editFormData, setEditFormData] = useState<any>({});
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    // Modal States
    const [confirmationModal, setConfirmationModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        type: 'danger' | 'info';
    }>({ isOpen: false, title: '', message: '', onConfirm: () => { }, type: 'danger' });

    const [alertModal, setAlertModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: 'success' | 'error';
    }>({ isOpen: false, title: '', message: '', type: 'error' });

    useEffect(() => {
        if (canRead) {
            loadFlows();
        }
    }, [canRead]);

    const loadFlows = async () => {
        setLoading(true);
        try {
            const data = await submissionService.getFlows();
            setFlows(data);
        } catch (e) {
            console.error("Failed to load flows", e);
        } finally {
            setLoading(false);
        }
    };

    const handleFlowClick = async (flow: Flow) => {
        setSelectedFlow(flow);
        setView('submissions');
        setLoading(true);
        try {
            const data = await submissionService.getSubmissions(flow.id);
            setSubmissions(data);
            setSelectedSubmissions(new Set()); // Reset selection
        } catch (e) {
            console.error("Failed to load submissions", e);
        } finally {
            setLoading(false);
        }
    };

    const handleBack = () => {
        setView('flows');
        setSelectedFlow(null);
        setSubmissions([]);
        setSearchQuery(''); // Reset search when going back
        setSelectedSubmissions(new Set());
    };

    // --- Search & Filter Logic ---
    const getFilteredFlows = () => {
        // Only show PUBLISHED flows
        const publishedFlows = flows.filter(f => f.status === 'PUBLISHED');

        if (!searchQuery) return publishedFlows;
        return publishedFlows.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
    };

    const getFilteredSubmissions = () => {
        if (!searchQuery) return submissions;
        const q = searchQuery.toLowerCase();
        return submissions.filter(s =>
            s.contact_name?.toLowerCase().includes(q) ||
            s.contact_phone?.includes(q) ||
            (s.submission_data && Object.values(s.submission_data).some(v => String(v).toLowerCase().includes(q)))
        );
    };

    const filteredFlows = getFilteredFlows();
    const filteredSubmissions = getFilteredSubmissions();

    // Use filtered data for pagination (Shared Logic)
    const activeDataList = view === 'flows' ? filteredFlows : filteredSubmissions;
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = activeDataList.slice(indexOfFirstItem, indexOfLastItem); // Generic current items
    const totalPages = Math.ceil(activeDataList.length / itemsPerPage);

    // Cast specific types for rendering
    const currentFlows = view === 'flows' ? (currentItems as Flow[]) : [];
    const currentSubmissions = view === 'submissions' ? (currentItems as Submission[]) : [];

    // --- CSV Export Logic ---
    const downloadCSV = () => {
        const submissionsToExport = selectedSubmissions.size > 0
            ? filteredSubmissions.filter(s => selectedSubmissions.has(s.id))
            : filteredSubmissions;

        if (submissionsToExport.length === 0) return;

        // Get all unique keys for header
        const keys = getSubmissionKeys(submissionsToExport);
        const headers = ['Contact Name', 'Contact Phone', 'Submitted At', ...keys];

        const csvRows = [
            headers.join(','), // Header row
            ...submissionsToExport.map(sub => {
                const row = [
                    `"${sub.contact_name || ''}"`,
                    `"${sub.contact_phone}"`,
                    `"${new Date(sub.submitted_at).toLocaleString()}"`,
                    ...keys.map(key => {
                        const val = sub.submission_data?.[key];
                        // Handle objects by stringifying them, escape quotes in values
                        const formattedVal = typeof val === 'object' && val !== null
                            ? JSON.stringify(val)
                            : String(val || '');
                        return `"${formattedVal.replace(/"/g, '""')}"`;
                    })
                ];
                return row.join(',');
            })
        ];

        const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${selectedFlow?.name || 'submissions'}_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // --- Bulk Action Handlers ---
    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            // Select all currently filtered submissions
            const allIds = new Set(filteredSubmissions.map(s => s.id));
            setSelectedSubmissions(allIds);
        } else {
            setSelectedSubmissions(new Set());
        }
    };

    const handleSelectOne = (id: string) => {
        const newSet = new Set(selectedSubmissions);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedSubmissions(newSet);
    };

    const handleDeleteOne = (id: string) => {
        if (!canDelete) return;
        setConfirmationModal({
            isOpen: true,
            title: 'Delete Submission',
            message: 'Are you sure you want to delete this submission? This action cannot be undone.',
            type: 'danger',
            onConfirm: async () => {
                try {
                    await submissionService.deleteSubmission(id);
                    setSubmissions(prev => prev.filter(s => s.id !== id));
                    const newSet = new Set(selectedSubmissions);
                    newSet.delete(id);
                    setSelectedSubmissions(newSet);
                    setConfirmationModal(prev => ({ ...prev, isOpen: false }));
                    setAlertModal({ isOpen: true, title: 'Success', message: 'Submission deleted successfully.', type: 'success' });
                } catch (error) {
                    console.error('Failed to delete submission', error);
                    setAlertModal({ isOpen: true, title: 'Error', message: 'Failed to delete submission.', type: 'error' });
                }
            }
        });
    };

    const handleBulkDelete = () => {
        if (!canDelete) return;
        if (selectedSubmissions.size === 0) return;

        setConfirmationModal({
            isOpen: true,
            title: 'Bulk Delete',
            message: `Are you sure you want to delete ${selectedSubmissions.size} submissions?`,
            type: 'danger',
            onConfirm: async () => {
                try {
                    const idsToDelete = Array.from(selectedSubmissions);
                    await submissionService.bulkDeleteSubmissions(idsToDelete);

                    setSubmissions(prev => prev.filter(s => !selectedSubmissions.has(s.id)));
                    setSelectedSubmissions(new Set());
                    setConfirmationModal(prev => ({ ...prev, isOpen: false }));
                    setAlertModal({ isOpen: true, title: 'Success', message: 'Submissions deleted successfully.', type: 'success' });
                } catch (error) {
                    console.error('Failed to bulk delete', error);
                    setAlertModal({ isOpen: true, title: 'Error', message: 'Failed to delete submissions.', type: 'error' });
                }
            }
        });
    };

    // --- Edit Handlers ---
    const handleEditClick = (sub: Submission) => {
        if (!canWrite) return;
        setEditingSubmission(sub);
        // Flatten data for easier editing if needed, or keep structured
        setEditFormData({
            contact_name: sub.contact_name,
            contact_phone: sub.contact_phone,
            ...sub.submission_data
        });
        setIsEditModalOpen(true);
    };

    const handleEditSave = async () => {
        if (!editingSubmission) return;
        try {
            // Separate contact info from submission data
            const { contact_name, contact_phone, ...data } = editFormData;

            const updatedSub = {
                ...editingSubmission,
                contact_name,
                contact_phone,
                submission_data: data
            };

            await submissionService.updateSubmission(editingSubmission.id, {
                contact_name,
                contact_phone,
                submission_data: data
            });

            setSubmissions(prev => prev.map(s => s.id === editingSubmission.id ? updatedSub : s));
            setIsEditModalOpen(false);
            setEditingSubmission(null);
            setAlertModal({ isOpen: true, title: 'Success', message: 'Submission updated successfully.', type: 'success' });
        } catch (error: any) {
            console.error('Failed to update submission', error);
            setAlertModal({
                isOpen: true,
                title: 'Error',
                message: `Failed to update submission: ${error.message || 'Unknown error'}`,
                type: 'error'
            });
        }
    };

    const handlePageChange = (pageNumber: number) => {
        setCurrentPage(pageNumber);
    };

    // Dynamic Columns Logic
    const getSubmissionKeys = (submissions: Submission[]) => {
        const keys = new Set<string>();
        submissions.forEach(sub => {
            if (sub.submission_data && typeof sub.submission_data === 'object') {
                Object.keys(sub.submission_data).forEach(k => {
                    if (k !== 'flow_token') keys.add(k);
                });
            }
        });
        return Array.from(keys);
    };

    const submissionKeys = getSubmissionKeys(submissions);

    if (!canRead && !loading) {
        return (
            <div className="flex flex-col w-full h-full bg-slate-50 font-sans text-slate-900 justify-center items-center p-8 min-h-[400px]">
                <div className="text-center max-w-sm">
                    <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100 shadow-sm">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    </div>
                    <h3 className="text-lg font-black text-slate-800 mb-1">Access Denied</h3>
                    <p className="text-sm text-slate-500 mb-4">You do not have the required permissions to view Form Contacts. Please contact your administrator.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col w-full h-full bg-canvas-bg font-sans text-canvas-text animate-fade-in relative overflow-hidden">
            {/* Header */}
            <div className="bg-canvas-surface/80 backdrop-blur-md border-b border-border-default shrink-0 z-30 sticky top-0">
                <div className="px-4 sm:px-8 py-6 max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        {view === 'submissions' && (
                            <button onClick={handleBack} className="p-2 -ml-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500">
                                <ChevronLeftIcon className="w-5 h-5" />
                            </button>
                        )}
                        <div>
                            <h1 className="text-2xl font-extrabold text-canvas-text tracking-tight">
                                {view === 'flows' ? 'Form Contacts' : selectedFlow?.name || 'Form Submissions'}
                            </h1>
                            <p className="text-slate-500 text-sm mt-1 font-medium">
                                {view === 'flows' ? 'Select a WhatsApp Form to view submissions' : `Viewing archived submissions for ${selectedFlow?.name}`}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Search Box */}
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg className="h-4 w-4 text-brand-600 group-focus-within:text-brand-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                            <input
                                type="text"
                                className="block w-full pl-10 pr-3 py-2 border border-brand-600 rounded-xl leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 sm:text-sm transition-all shadow-sm"
                                placeholder={view === 'flows' ? "Search Forms..." : "Search Submissions..."}
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setCurrentPage(1); // Reset page on filter
                                }}
                            />
                        </div>

                        {view === 'submissions' ? (
                            <div className="flex items-center gap-3">
                                {canDelete && selectedSubmissions.size > 0 && (
                                    <button
                                        onClick={handleBulkDelete}
                                        className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm font-bold hover:bg-red-100 transition-all shadow-sm animate-fade-in"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        Delete ({selectedSubmissions.size})
                                    </button>
                                )}
                                <button
                                    onClick={downloadCSV}
                                    disabled={filteredSubmissions.length === 0}
                                    className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                    Export CSV{selectedSubmissions.size > 0 ? ' (Selected)' : ''}
                                </button>
                                <div className="bg-slate-100 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 border border-slate-200 font-mono">
                                    {filteredSubmissions.length}
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200">
                                <button
                                    onClick={() => setDisplayMode('list')}
                                    className={`p-2 rounded-md transition-all ${displayMode === 'list' ? 'bg-white shadow-sm text-brand-600' : 'text-slate-400 hover:text-slate-600'}`}
                                    title="List View"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                    </svg>
                                </button>
                                <button
                                    onClick={() => setDisplayMode('grid')}
                                    className={`p-2 rounded-md transition-all ${displayMode === 'grid' ? 'bg-white shadow-sm text-brand-600' : 'text-slate-400 hover:text-slate-600'}`}
                                    title="Grid View"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                    </svg>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-8 pb-24">
                <div className="max-w-7xl mx-auto">
                    {loading ? (
                        <div className="flex flex-col justify-center items-center h-64 text-slate-400 font-medium">
                            <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mb-4"></div>
                            Loading...
                        </div>
                    ) : (
                        <>
                            {view === 'flows' ? (
                                <>
                                    {flows.length === 0 ? (
                                        <div className="col-span-full text-center py-24 px-4 bg-white rounded-2xl border border-slate-200 border-dashed shadow-sm">
                                            <p className="text-slate-900 font-bold text-lg mb-2">No Forms Found</p>
                                            <p className="text-slate-500 text-sm">Create WhatsApp Flows in Meta Business Manager to see them here.</p>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Pagination Logic */}
                                            {(() => {
                                                const Pagination = () => (
                                                    <div className="flex items-center justify-between border-t border-slate-200 pt-4 px-4 sm:px-0 mt-4">
                                                        <div className="text-sm text-slate-500">
                                                            Showing <span className="font-bold">{indexOfFirstItem + 1}</span> to <span className="font-bold">{Math.min(indexOfLastItem, activeDataList.length)}</span> of <span className="font-bold">{activeDataList.length}</span> results
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => handlePageChange(currentPage - 1)}
                                                                disabled={currentPage === 1}
                                                                className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                                            >
                                                                <ChevronLeftIcon className="w-5 h-5" />
                                                            </button>
                                                            <div className="flex items-center gap-1">
                                                                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                                                    <button
                                                                        key={page}
                                                                        onClick={() => handlePageChange(page)}
                                                                        className={`w-8 h-8 rounded-lg text-sm font-bold transition-all ${currentPage === page ? 'bg-brand-600 text-white shadow-md shadow-brand-200' : 'text-slate-500 hover:bg-slate-50'}`}
                                                                    >
                                                                        {page}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                            <button
                                                                onClick={() => handlePageChange(currentPage + 1)}
                                                                disabled={currentPage === totalPages}
                                                                className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                                            >
                                                                <ChevronRightIcon className="w-5 h-5" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                );

                                                return (
                                                    <>
                                                        {displayMode === 'grid' ? (
                                                            <>
                                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                                                                    {currentFlows.map(flow => (
                                                                        <div
                                                                            key={flow.id}
                                                                            onClick={() => handleFlowClick(flow)}
                                                                            className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-brand-500/10 hover:-translate-y-1 transition-all duration-300 cursor-pointer group relative overflow-hidden"
                                                                        >
                                                                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-400 to-green-400"></div>
                                                                            <div className="p-6">
                                                                                <div className="flex justify-between items-start mb-6">
                                                                                    <div className="w-14 h-14 bg-gradient-to-br from-brand-50 to-green-50 rounded-2xl flex items-center justify-center text-brand-600 shadow-sm border border-brand-100 group-hover:scale-110 transition-transform duration-300">
                                                                                        <TriggerIcon className="w-7 h-7" />
                                                                                    </div>
                                                                                    <span className={`text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider ${flow.status === 'PUBLISHED' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                                                                        {flow.status}
                                                                                    </span>
                                                                                </div>

                                                                                <div className="mb-6">
                                                                                    <h3 className="font-bold text-slate-900 text-xl mb-1 group-hover:text-brand-600 transition-colors line-clamp-1" title={flow.name}>
                                                                                        {flow.name}
                                                                                    </h3>
                                                                                    <p className="text-slate-400 text-xs font-medium truncate">ID: {flow.id}</p>
                                                                                </div>

                                                                                <div className="flex items-center justify-between border-t border-slate-50 pt-4">
                                                                                    <div className="flex flex-col">
                                                                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Submissions</span>
                                                                                        <span className="text-2xl font-extrabold text-slate-900">{flow.submission_count || 0}</span>
                                                                                    </div>
                                                                                    <button className="px-4 py-2 bg-slate-50 text-brand-600 rounded-xl text-sm font-bold group-hover:bg-brand-600 group-hover:text-white transition-all shadow-sm flex items-center gap-1 group-hover:shadow-brand-200">
                                                                                        View Details
                                                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                                {totalPages > 1 && <Pagination />}
                                                            </>
                                                        ) : (
                                                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8 p-4">
                                                                <div className="overflow-x-auto rounded-xl border border-slate-100">
                                                                    <table className="min-w-full divide-y divide-slate-100">
                                                                        <thead className="bg-brand-600 text-white shadow-md">
                                                                            <tr>
                                                                                <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600 w-12">#</th>
                                                                                <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Form Name</th>
                                                                                <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Status</th>
                                                                                <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Submissions</th>
                                                                                <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Last Updated</th>
                                                                                <th className="px-6 py-4 text-right text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Action</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="divide-y divide-slate-100 bg-white">
                                                                            {currentFlows.map((flow, idx) => (
                                                                                <tr
                                                                                    key={flow.id}
                                                                                    onClick={() => handleFlowClick(flow)}
                                                                                    className="hover:bg-slate-50 transition-colors cursor-pointer group"
                                                                                >
                                                                                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-400 font-mono">
                                                                                        {indexOfFirstItem + idx + 1}
                                                                                    </td>
                                                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                                                        <div className="flex items-center gap-3">
                                                                                            <div className="w-8 h-8 bg-brand-50 rounded-lg flex items-center justify-center text-brand-600">
                                                                                                <TriggerIcon className="w-4 h-4" />
                                                                                            </div>
                                                                                            <span className="font-bold text-slate-900 group-hover:text-brand-600 transition-colors">{flow.name}</span>
                                                                                        </div>
                                                                                    </td>
                                                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                                                        <span className={`text-xs font-bold px-2 py-1 rounded uppercase ${flow.status === 'PUBLISHED' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                                                                            {flow.status}
                                                                                        </span>
                                                                                    </td>
                                                                                    <td className="px-6 py-4 whitespace-nowrap text-xs">
                                                                                        <span className="font-bold bg-slate-100 px-2 py-1 rounded text-slate-700">
                                                                                            {flow.submission_count || 0}
                                                                                        </span>
                                                                                    </td>
                                                                                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500 font-medium">
                                                                                        {flow.updated_at ? new Date(flow.updated_at).toLocaleString() : '-'}
                                                                                    </td>
                                                                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                                                                        <span className="text-brand-600 font-bold hover:underline">View Submissions</span>
                                                                                    </td>
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                                {totalPages > 1 && <Pagination />}
                                                            </div>
                                                        )}
                                                    </>
                                                );
                                            })()}
                                        </>
                                    )}
                                </>
                            ) : (
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-slate-100">
                                            <thead className="bg-brand-600 text-white shadow-md">
                                                <tr>
                                                    <th className="px-6 py-4 text-left w-10 !bg-brand-600 text-white">
                                                        <input
                                                            type="checkbox"
                                                            className="rounded border-brand-300 text-brand-600 focus:ring-brand-500 h-4 w-4 cursor-pointer"
                                                            onChange={handleSelectAll}
                                                            checked={filteredSubmissions.length > 0 && selectedSubmissions.size === filteredSubmissions.length}
                                                        />
                                                    </th>
                                                    <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Contact</th>
                                                    {submissionKeys.map(key => (
                                                        <th key={key} className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">
                                                            {key.replace(/_/g, ' ')}
                                                        </th>
                                                    ))}
                                                    <th className="px-6 py-4 text-right text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Submitted At</th>
                                                    <th className="px-6 py-4 text-right text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600 w-16">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 bg-white">
                                                {currentSubmissions.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={submissionKeys.length + 4} className="px-6 py-12 text-center text-slate-500 text-sm">
                                                            No submissions found for this form yet.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    currentSubmissions.map(sub => (
                                                        <tr key={sub.id} className={`hover:bg-slate-50 transition-colors ${selectedSubmissions.has(sub.id) ? 'bg-brand-50/30' : ''}`}>
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <input
                                                                    type="checkbox"
                                                                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                                                                    checked={selectedSubmissions.has(sub.id)}
                                                                    onChange={() => handleSelectOne(sub.id)}
                                                                />
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <div className="flex items-center">
                                                                    <div className="bg-brand-100 text-brand-600 rounded-full w-8 h-8 flex items-center justify-center mr-3 font-bold text-xs shrink-0">
                                                                        <UsersIcon className="w-4 h-4" />
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-sm font-bold text-gray-900">{sub.contact_name || 'Guest'}</div>
                                                                        <div className="text-xs text-gray-500 font-mono">{sub.contact_phone}</div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            {submissionKeys.map(key => (
                                                                <td key={key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                                    {typeof sub.submission_data?.[key] === 'object'
                                                                        ? JSON.stringify(sub.submission_data?.[key])
                                                                        : String(sub.submission_data?.[key] || '-')}
                                                                </td>
                                                            ))}
                                                            <td className="px-6 py-4 whitespace-nowrap text-right text-xs text-slate-500 font-mono">
                                                                {new Date(sub.submitted_at).toLocaleString()}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                                                <div className="flex items-center justify-end gap-2">
                                                                    {canWrite && (
                                                                        <button
                                                                            onClick={() => handleEditClick(sub)}
                                                                            className="text-slate-400 hover:text-brand-600 transition-colors p-1 rounded-md hover:bg-brand-50"
                                                                            title="Edit Submission"
                                                                        >
                                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                                        </button>
                                                                    )}
                                                                    {canDelete && (
                                                                        <button
                                                                            onClick={() => handleDeleteOne(sub.id)}
                                                                            className="text-slate-400 hover:text-red-600 transition-colors p-1 rounded-md hover:bg-red-50"
                                                                            title="Delete Submission"
                                                                        >
                                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                        {filteredSubmissions.length > 0 && (
                                            <div className="flex items-center justify-between border-t border-slate-200 pt-4 px-4 sm:px-0 mt-4">
                                                <div className="text-sm text-slate-500">
                                                    Showing <span className="font-bold">{indexOfFirstItem + 1}</span> to <span className="font-bold">{Math.min(indexOfLastItem, activeDataList.length)}</span> of <span className="font-bold">{activeDataList.length}</span> results
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => handlePageChange(currentPage - 1)}
                                                        disabled={currentPage === 1}
                                                        className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                                    >
                                                        <ChevronLeftIcon className="w-5 h-5" />
                                                    </button>
                                                    <div className="flex items-center gap-1">
                                                        {totalPages > 0 && Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                                            <button
                                                                key={page}
                                                                onClick={() => handlePageChange(page)}
                                                                className={`w-8 h-8 rounded-lg text-sm font-bold transition-all ${currentPage === page ? 'bg-brand-600 text-white shadow-md shadow-brand-200' : 'text-slate-500 hover:bg-slate-50'}`}
                                                            >
                                                                {page}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <button
                                                        onClick={() => handlePageChange(currentPage + 1)}
                                                        disabled={currentPage === totalPages}
                                                        className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                                    >
                                                        <ChevronRightIcon className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
            {/* Edit Modal */}
            {isEditModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg transform transition-all scale-100 overflow-hidden">
                        <div className="bg-brand-600 px-6 py-4 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-white">Edit Submission</h3>
                            <button onClick={() => setIsEditModalOpen(false)} className="text-white/80 hover:text-white transition-colors">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto custom-scrollbar">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
                                <input
                                    type="text"
                                    value={editFormData.contact_name || ''}
                                    onChange={e => setEditFormData({ ...editFormData, contact_name: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
                                <input
                                    type="text"
                                    value={editFormData.contact_phone || ''}
                                    onChange={e => setEditFormData({ ...editFormData, contact_phone: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                                />
                            </div>

                            <div className="border-t border-slate-100 pt-4">
                                <p className="text-xs font-bold text-slate-400 uppercase mb-3 tracking-wider">Form Data</p>
                                {Object.keys(editFormData).filter(k => k !== 'contact_name' && k !== 'contact_phone').map(key => (
                                    <div key={key} className="mb-4">
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5 capitalize">{key.replace(/_/g, ' ')}</label>
                                        <input
                                            type="text"
                                            value={typeof editFormData[key] === 'object' ? JSON.stringify(editFormData[key]) : editFormData[key]}
                                            onChange={e => setEditFormData({ ...editFormData, [key]: e.target.value })}
                                            className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-slate-50 focus:bg-white transition-all"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                            <button
                                onClick={() => setIsEditModalOpen(false)}
                                className="flex-1 px-4 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleEditSave}
                                className="flex-1 px-4 py-2.5 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 shadow-lg shadow-brand-200 transition-all transform active:scale-95"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirmation Modal */}
            {confirmationModal.isOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 transform transition-all scale-100 border border-slate-100">
                        <div className="text-center">
                            <div className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full mb-4 ${confirmationModal.type === 'danger' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                                {confirmationModal.type === 'danger' ? (
                                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                ) : (
                                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                )}
                            </div>
                            <h3 className="text-lg leading-6 font-bold text-slate-900">{confirmationModal.title}</h3>
                            <div className="mt-2">
                                <p className="text-sm text-slate-500">{confirmationModal.message}</p>
                            </div>
                        </div>
                        <div className="mt-6 flex gap-3">
                            <button
                                type="button"
                                className="flex-1 bg-white border border-slate-300 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500"
                                onClick={() => setConfirmationModal(prev => ({ ...prev, isOpen: false }))}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className={`flex-1 rounded-xl px-4 py-2 text-sm font-bold text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 ${confirmationModal.type === 'danger' ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' : 'bg-brand-600 hover:bg-brand-700 focus:ring-brand-500'}`}
                                onClick={confirmationModal.onConfirm}
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Alert Modal */}
            {alertModal.isOpen && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 transform transition-all scale-100 border border-slate-100">
                        <div className="text-center">
                            <div className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full mb-4 ${alertModal.type === 'success' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                {alertModal.type === 'success' ? (
                                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                ) : (
                                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                )}
                            </div>
                            <h3 className="text-lg leading-6 font-bold text-slate-900">{alertModal.title}</h3>
                            <div className="mt-2">
                                <p className="text-sm text-slate-500">{alertModal.message}</p>
                            </div>
                        </div>
                        <div className="mt-6">
                            <button
                                type="button"
                                className="w-full inline-flex justify-center rounded-xl border border-transparent shadow-sm px-4 py-2 bg-brand-600 text-base font-bold text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 sm:text-sm"
                                onClick={() => setAlertModal(prev => ({ ...prev, isOpen: false }))}
                            >
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
