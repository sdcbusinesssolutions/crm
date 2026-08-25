import React, { useState, useEffect, useRef } from 'react';
import { flowService } from '../services/flowService';
import { Flow } from '../types';
import { usePermissions, ACCESS_TYPES } from '../modules/teamStaff/hooks/usePermissions';
import { UploadIcon, PlusIcon, CopyIcon, DownloadIcon, TrashIcon, SearchIcon, FilterIcon, EditIcon, TriggerIcon, MenuIcon } from './icons';
import Modal from './Modal';
import VideoGuideModal from './VideoGuideModal';
import VideoGuideButton from './VideoGuideButton';

interface FlowListProps {
    onNavigateToFlow: (flowId: string) => void;
    onToggleSidebar?: () => void;
}

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    // Case insensitive check
    const isPublished = (status || '').toLowerCase() === 'published';
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide border ${isPublished ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isPublished ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
            {isPublished ? 'Published' : 'Draft'}
        </span>
    );
};

const PublishToggle: React.FC<{ isPublished: boolean; onClick: (e: React.MouseEvent) => void }> = ({ isPublished, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isPublished ? 'bg-emerald-500' : 'bg-slate-300'}`}
        title={isPublished ? "Unpublish flow" : "Publish flow"}
    >
        <span className="sr-only">Use setting</span>
        <span
            aria-hidden="true"
            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isPublished ? 'translate-x-4' : 'translate-x-0'}`}
        />
    </button>
);



const FlowList: React.FC<FlowListProps> = ({ onNavigateToFlow, onToggleSidebar }) => {
    const { hasAccess } = usePermissions();
    const canWrite = hasAccess('Flows', ACCESS_TYPES.READ_WRITE);
    const canDelete = hasAccess('Flows', ACCESS_TYPES.ALL_ACCESS);

    const [flows, setFlows] = useState<Flow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('All');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const [serverStatus, setServerStatus] = useState<string>('Checking');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Delete Modal State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [flowToDelete, setFlowToDelete] = useState<string | null>(null);
    const [showVideo, setShowVideo] = useState(false);

    useEffect(() => {
        loadFlows();
        checkServerStatus();
    }, []);

    const checkServerStatus = async () => {
        try {
            // We use /api/status to hit the health check endpoint
            const res = await fetch('/api/status');
            if (res.ok) {
                const data = await res.json();
                if (data && data.status === 'online') {
                    setServerStatus('Online');
                } else {
                    setServerStatus('Offline (Invalid Resp)');
                }
            } else {
                setServerStatus(`Offline (${res.status})`);
            }
        } catch (e: any) {
            setServerStatus(`Offline (${e.message || 'Error'})`);
        }
    };

    const loadFlows = async () => {
        setIsLoading(true);
        const data = await flowService.getFlows();
        setFlows(data);
        setIsLoading(false);
    };

    const handleCreateFlow = () => {
        onNavigateToFlow('new');
    };

    const handleDeleteFlowClick = (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        setFlowToDelete(id);
        setIsDeleteModalOpen(true);
    };

    const confirmDeleteFlow = async () => {
        if (!flowToDelete) return;
        if (!canDelete) {
            alert("You do not have permission to delete this flow.");
            setIsDeleteModalOpen(false);
            return;
        }

        const previousFlows = [...flows];
        setFlows(prevFlows => prevFlows.filter(f => String(f.id) !== String(flowToDelete)));

        setIsDeleteModalOpen(false); // Close immediately for better UX

        try {
            await flowService.deleteFlow(flowToDelete);
        } catch (error) {
            alert("Failed to delete flow. Restoring list.");
            setFlows(previousFlows);
        } finally {
            setFlowToDelete(null);
        }
    };

    const handleDuplicateFlow = async (e: React.MouseEvent, flow: Flow) => {
        e.preventDefault();
        e.stopPropagation();

        try {
            await flowService.createFlow({
                name: `${flow.name} (Copy)`,
                description: flow.description,
                status: 'Draft',
                nodes: flow.nodes,
                edges: flow.edges
            });
            await loadFlows();
        } catch (error) {
            console.error("Failed to duplicate flow", error);
            alert("Failed to duplicate flow");
        }
    };

    const handleExportFlow = (e: React.MouseEvent, flow: Flow) => {
        e.preventDefault();
        e.stopPropagation();
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(flow, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `${flow.name.replace(/\s+/g, '_')}_flow.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const handleTogglePublish = async (e: React.MouseEvent, flow: Flow) => {
        e.preventDefault();
        e.stopPropagation();
        const isCurrentlyPublished = (flow.status || '').toLowerCase() === 'published';
        const newStatus = isCurrentlyPublished ? 'Draft' : 'Published';

        const updatedFlow: Flow = { ...flow, status: newStatus, updatedAt: new Date().toLocaleDateString() };

        // Optimistic update
        setFlows(prev => prev.map(f => f.id === flow.id ? updatedFlow : f));
        await flowService.saveFlow(updatedFlow);
    };

    const handleImportClick = () => fileInputRef.current?.click();

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const content = e.target?.result as string;
                const importedFlow = JSON.parse(content);
                if (!Array.isArray(importedFlow.nodes) || !Array.isArray(importedFlow.edges)) {
                    alert('Invalid flow file.');
                    return;
                }
                const newFlowData = {
                    ...importedFlow,
                    name: importedFlow.name ? `${importedFlow.name} (Imported)` : 'Imported Flow',
                    status: 'Draft',
                    nodes: importedFlow.nodes || [],
                    edges: importedFlow.edges || []
                };
                // Ensure we don't pass an ID, creating a new record
                if ('id' in newFlowData) delete newFlowData.id;

                await flowService.createFlow(newFlowData);
                await loadFlows();
            } catch (error) {
                alert('Failed to import flow.');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    const filteredFlows = flows.filter(flow => {
        const term = searchTerm.toLowerCase().trim();

        // 1. Status Filter
        const status = (flow.status || '').toLowerCase();
        const filter = statusFilter.toLowerCase();
        if (filter !== 'all' && status !== filter) {
            return false;
        }

        // 2. Search Filter (Super Permissive)
        if (!term) return true;

        try {
            // Build a giant searchable string including ALL flow metadata
            const triggerNode = (flow.nodes || []).find((n: any) => n.type === 'onMessage');
            const triggerKeywords = triggerNode?.data?.keywords
                ? (Array.isArray(triggerNode.data.keywords) ? triggerNode.data.keywords.join(' ') : String(triggerNode.data.keywords))
                : '';

            const nodeDataString = (flow.nodes || []).map((n: any) => {
                try {
                    return n.data ? JSON.stringify(n.data) : '';
                } catch (e) { return ''; }
            }).join(' ');

            const searchableText = [
                flow.name,
                flow.description || '',
                flow.status || '',
                flow.updatedAt || '',
                triggerKeywords,
                nodeDataString
            ].join(' ').toLowerCase();

            return searchableText.includes(term);
        } catch (err) {
            return false;
        }
    });

    // ... (Inside Return)
    // Add Result Count near Search Bar




    // Pagination Logic
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredFlows.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredFlows.length / itemsPerPage);

    const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

    return (
        <div className="flex flex-col w-full h-full bg-canvas-bg font-sans text-canvas-text animate-fade-in relative overflow-hidden container-mobile-fix">
            {/* Header - Fixed to Top */}
            <div className="bg-canvas-surface/80 backdrop-blur-md border-b border-slate-200 shrink-0 z-30 sticky top-0">
                <div className="px-4 sm:px-8 py-3 max-w-[1800px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3">
                            {onToggleSidebar && (
                                <button
                                    onClick={onToggleSidebar}
                                    className="lg:hidden p-2 -ml-1 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    <MenuIcon className="w-6 h-6" />
                                </button>
                            )}
                            <h1 className="text-2xl font-extrabold text-canvas-text tracking-tight">Flow Builder</h1>
                            {/* Server Status Indicator */}
                            <div
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-colors ${serverStatus === 'Online' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                                    serverStatus === 'Offline' ? 'bg-red-50 text-red-600 border-red-200' :
                                        'bg-slate-50 text-slate-500 border-slate-200'
                                    }`}
                                title={serverStatus === 'Online' ? "Connected to Backend API" : "Cannot reach Backend API"}
                            >
                                <span className={`w-2 h-2 rounded-full ${serverStatus === 'Online' ? 'bg-emerald-500 shadow-[0_0_5px_#10b981]' :
                                    serverStatus === 'Offline' ? 'bg-red-500' :
                                        'bg-slate-400'
                                    }`}></span>
                                Server: {serverStatus}
                            </div>
                        </div>
                        <p className="text-slate-500 text-sm mt-1 font-medium hidden sm:block">Design and automate conversations visually.</p>
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        {canWrite && (
                            <>
                                <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileChange} />
                                <VideoGuideButton moduleName="Flows" label="VIEW" className="!bg-red-600 hover:!bg-red-700 !text-white !rounded-full !text-[10px] animate-pulse shadow-md hover:shadow-lg mr-2" />
                                <button onClick={handleImportClick} className="flex-1 sm:flex-none flex items-center justify-center space-x-2 bg-[var(--color-brand)] hover:opacity-90 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-brand-200 transition-all transform hover:-translate-y-0.5 text-sm font-bold active:scale-95">
                                    <UploadIcon /> <span className="hidden sm:inline">Import</span>
                                </button>
                                <button onClick={handleCreateFlow} className="flex-1 sm:flex-none flex items-center justify-center space-x-2 bg-[var(--color-brand)] hover:opacity-90 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-brand-200 transition-all transform hover:-translate-y-0.5 text-sm font-bold active:scale-95">
                                    <PlusIcon /> <span>New Flow</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Scrollable Content Area - Flex Grow */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-8 pb-24">
                <div className="max-w-[1800px] mx-auto">
                    {/* Statistics Overview */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                        {(() => {
                            const stats = {
                                total: flows.length,
                                published: flows.filter(f => (f.status || '').toLowerCase() === 'published').length,
                                draft: flows.filter(f => (f.status || '').toLowerCase() === 'draft').length
                            };

                            return (
                                <>
                                    <div className="bg-blue-50/50 p-4 rounded-2xl border-2 border-blue-300 shadow-sm hover:shadow-md transition-all hover:border-blue-500 group">
                                        <div className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Total Flows</div>
                                        <div className="text-2xl font-black text-blue-900">{stats.total}</div>
                                        <div className="text-xs text-blue-600/70 mt-1 font-medium">All automation flows</div>
                                    </div>
                                    <div className="bg-emerald-50/50 p-4 rounded-2xl border-2 border-emerald-300 shadow-sm hover:shadow-md transition-all hover:border-emerald-500 group">
                                        <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">Published</div>
                                        <div className="text-2xl font-black text-emerald-900">{stats.published}</div>
                                        <div className="text-xs text-emerald-600/70 mt-1 font-medium">Active & running</div>
                                    </div>
                                    <div className="bg-amber-50/50 p-4 rounded-2xl border-2 border-amber-300 shadow-sm hover:shadow-md transition-all hover:border-amber-500 group">
                                        <div className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">Draft</div>
                                        <div className="text-2xl font-black text-amber-900">{stats.draft}</div>
                                        <div className="text-xs text-amber-600/70 mt-1 font-medium">In development</div>
                                    </div>
                                </>
                            );
                        })()}
                    </div>

                    {/* Filters */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                        <div className="relative w-full md:max-w-sm group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-brand-600 group-focus-within:text-brand-600 transition-colors">
                                <SearchIcon />
                            </div>
                            <input
                                type="text"
                                placeholder="Search flows..."
                                className="pl-10 pr-4 py-3 w-full bg-white border border-brand-600 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 text-sm shadow-sm transition-all outline-none font-medium placeholder-slate-400"
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            />
                            {searchTerm && (
                                <span className="absolute right-3 top-3.5 text-xs text-slate-400 font-bold bg-slate-100 px-2 py-0.5 rounded-md">
                                    {filteredFlows.length} found
                                </span>
                            )}
                        </div>

                        <div className="relative w-full md:w-auto">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-brand-600">
                                <FilterIcon />
                            </div>
                            <select
                                className="pl-9 pr-10 py-3 w-full md:w-48 bg-white border border-brand-600 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 text-sm shadow-sm appearance-none cursor-pointer font-bold text-slate-700 outline-none"
                                value={statusFilter}
                                onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                            >
                                <option value="All">All Status</option>
                                <option value="Published">Published</option>
                                <option value="Draft">Draft</option>
                            </select>
                            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-brand-600">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            </div>
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="min-h-[400px]">
                        {isLoading ? (
                            <div className="flex flex-col justify-center items-center h-64 text-slate-400 font-medium">
                                <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mb-4"></div>
                                Loading...
                            </div>
                        ) : filteredFlows.length === 0 ? (
                            <div className="text-center py-24 px-4 bg-white rounded-2xl border border-slate-200 border-dashed shadow-sm">
                                <div className="w-20 h-20 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <SearchIcon className="w-8 h-8 text-brand-300" />
                                </div>
                                <p className="text-slate-900 font-bold text-lg mb-2">No flows found</p>
                                <p className="text-slate-500 text-sm mb-8 max-w-xs mx-auto leading-relaxed">We couldn't find any flows matching your current search or filters.</p>
                                <button onClick={handleCreateFlow} className="text-brand-600 font-bold hover:text-brand-700 text-sm flex items-center justify-center mx-auto hover:underline">
                                    Create a new flow <span className="ml-1">&rarr;</span>
                                </button>
                            </div>
                        ) : (
                            <>
                                {/* Desktop Table View */}
                                <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
                                    <table className="min-w-full divide-y divide-slate-100">
                                        <thead className="bg-brand-600 text-white shadow-md">
                                            <tr>
                                                <th className="px-6 py-5 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600 whitespace-nowrap">Name</th>
                                                <th className="px-6 py-5 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600 whitespace-nowrap">Trigger</th>
                                                <th className="px-6 py-5 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600 whitespace-nowrap">Status</th>
                                                <th className="px-6 py-5 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600 whitespace-nowrap">Last Updated</th>
                                                <th className="px-6 py-5 text-right text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600 whitespace-nowrap">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {currentItems.map((flow) => {
                                                const isPublished = (flow.status || '').toLowerCase() === 'published';

                                                // Extract trigger keywords
                                                const triggerNode = (flow.nodes || []).find((n: any) => n.type === 'onMessage');
                                                const triggerKeywords = triggerNode?.data?.keywords
                                                    ? (Array.isArray(triggerNode.data.keywords) ? triggerNode.data.keywords.join(', ') : triggerNode.data.keywords)
                                                    : '-';

                                                return (
                                                    <tr
                                                        key={flow.id}
                                                        // Using shadow inset for the left border is more reliable than border-l-4 on table rows in some browsers
                                                        className={`transition-all duration-200 group cursor-pointer ${isPublished
                                                            ? 'bg-emerald-50/60 shadow-[inset_4px_0_0_0_#10b981]'
                                                            : 'bg-white hover:bg-slate-50 shadow-[inset_4px_0_0_0_transparent] hover:shadow-[inset_4px_0_0_0_#cbd5e1]'
                                                            }`}
                                                        onClick={() => onNavigateToFlow(flow.id)}
                                                    >
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <div className="flex items-center">
                                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm mr-4 transition-transform group-hover:scale-110 border ${isPublished
                                                                    ? 'bg-emerald-100 text-emerald-600 border-emerald-200'
                                                                    : 'bg-brand-50 text-brand-600 border-brand-100'
                                                                    }`}>
                                                                    <TriggerIcon className="w-5 h-5" />
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="text-sm font-bold text-slate-800">{flow.name}</span>
                                                                    <span className="text-xs text-slate-400 truncate max-w-xs mt-0.5">{flow.description || 'Automated conversation flow'}</span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200 font-mono">
                                                                {triggerKeywords || '-'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <StatusBadge status={flow.status} />
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500 font-medium">
                                                            {flow.updatedAt}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                            <div className="flex items-center justify-end space-x-1" onClick={(e) => e.stopPropagation()}>
                                                                <div className="flex items-center space-x-2 mr-4 border-r border-slate-200 pr-4">
                                                                    <PublishToggle
                                                                        isPublished={isPublished}
                                                                        onClick={(e) => canWrite && handleTogglePublish(e, flow)}
                                                                    />
                                                                </div>
                                                                {canWrite ? (
                                                                    <>
                                                                        <button onClick={() => onNavigateToFlow(flow.id)} className="p-2 rounded-lg hover:bg-brand-50 text-slate-400 hover:text-brand-600 transition-colors" title="Edit">
                                                                            <EditIcon className="w-4 h-4" />
                                                                        </button>
                                                                        <button onClick={(e) => handleDuplicateFlow(e, flow)} className="p-2 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors" title="Duplicate">
                                                                            <CopyIcon className="w-4 h-4" />
                                                                        </button>
                                                                        <button onClick={(e) => handleExportFlow(e, flow)} className="p-2 rounded-lg hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-colors" title="Export JSON">
                                                                            <DownloadIcon className="w-4 h-4" />
                                                                        </button>
                                                                        {canDelete && (
                                                                            <button onClick={(e) => handleDeleteFlowClick(e, flow.id)} className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors" title="Delete">
                                                                                <TrashIcon className="w-4 h-4" />
                                                                            </button>
                                                                        )}
                                                                    </>
                                                                ) : (
                                                                    <button onClick={() => onNavigateToFlow(flow.id)} className="p-2 rounded-lg hover:bg-brand-50 text-slate-400 hover:text-brand-600 transition-colors" title="View">
                                                                        <TriggerIcon className="w-4 h-4" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile Card View */}
                                <div className="md:hidden grid grid-cols-1 gap-4">
                                    {currentItems.map((flow) => {
                                        const isPublished = (flow.status || '').toLowerCase() === 'published';
                                        return (
                                            <div
                                                key={flow.id}
                                                onClick={() => onNavigateToFlow(flow.id)}
                                                className={`rounded-2xl p-5 border shadow-sm hover:shadow-md transition-all active:scale-[0.99] relative overflow-hidden group ${isPublished
                                                    ? 'bg-emerald-50 border-emerald-200/60 shadow-[inset_4px_0_0_0_#10b981]'
                                                    : 'bg-white border-slate-200 shadow-[inset_4px_0_0_0_transparent]'
                                                    }`}
                                            >
                                                <div className="pl-2">
                                                    <div className="flex justify-between items-start mb-3">
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm border ${isPublished
                                                                ? 'bg-emerald-100 text-emerald-600 border-emerald-200'
                                                                : 'bg-brand-50 text-brand-600 border-brand-100'
                                                                }`}>
                                                                <TriggerIcon className="w-5 h-5" />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <h3 className="font-bold text-slate-900 text-lg leading-tight truncate">{flow.name}</h3>
                                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide mt-0.5">{flow.updatedAt}</p>
                                                            </div>
                                                        </div>
                                                        <StatusBadge status={flow.status} />
                                                    </div>

                                                    <p className="text-sm text-slate-500 mb-4 line-clamp-2 font-medium leading-relaxed">
                                                        {flow.description || 'No description provided'}
                                                    </p>

                                                    <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-auto" onClick={(e) => e.stopPropagation()}>
                                                        <div className="flex items-center gap-3">
                                                            <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-2">
                                                                <PublishToggle isPublished={isPublished} onClick={(e) => canWrite && handleTogglePublish(e, flow)} />
                                                            </div>
                                                        </div>

                                                         <div className="flex items-center gap-1">
                                                            {canWrite && (
                                                                <>
                                                                    <button onClick={(e) => handleDuplicateFlow(e, flow)} className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors"><CopyIcon className="w-4 h-4" /></button>
                                                                    <button onClick={(e) => handleExportFlow(e, flow)} className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-emerald-50 hover:text-emerald-600 transition-colors"><DownloadIcon className="w-4 h-4" /></button>
                                                                    {canDelete && (
                                                                        <button onClick={(e) => handleDeleteFlowClick(e, flow.id)} className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors"><TrashIcon className="w-4 h-4" /></button>
                                                                    )}
                                                                </>
                                                            )}
                                                            <button onClick={() => onNavigateToFlow(flow.id)} className="ml-2 px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg shadow-md active:scale-[0.95] transition-all flex items-center gap-1">
                                                                {canWrite ? 'Open Editor' : 'View Flow'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>

                    <div className="mt-8 flex flex-col items-center gap-4">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => paginate(currentPage - 1)}
                                disabled={currentPage === 1}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${currentPage === 1
                                    ? 'text-slate-300 cursor-not-allowed bg-slate-50'
                                    : 'text-slate-600 hover:text-brand-600 bg-white hover:bg-brand-50 border border-slate-200 hover:border-brand-200'
                                    }`}
                            >
                                Previous
                            </button>

                            <div className="flex items-center gap-1">
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map(number => (
                                    <button
                                        key={number}
                                        onClick={() => paginate(number)}
                                        className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-bold transition-all ${currentPage === number
                                            ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20'
                                            : 'text-slate-500 hover:text-brand-600 hover:bg-slate-100'
                                            }`}
                                    >
                                        {number}
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={() => paginate(currentPage + 1)}
                                disabled={currentPage === totalPages || totalPages === 0}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${currentPage === totalPages || totalPages === 0
                                    ? 'text-slate-300 cursor-not-allowed bg-slate-50'
                                    : 'text-slate-600 hover:text-brand-600 bg-white hover:bg-brand-50 border border-slate-200 hover:border-brand-200'
                                    }`}
                            >
                                Next
                            </button>
                        </div>

                        <span className="text-xs font-medium text-slate-400">
                            Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredFlows.length)} of {filteredFlows.length} flows
                        </span>
                    </div>
                </div>
            </div>
            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                title="Delete Flow"
                footer={
                    <div className="flex justify-end gap-3 w-full">
                        <button
                            onClick={() => setIsDeleteModalOpen(false)}
                            className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={confirmDeleteFlow}
                            className="px-4 py-2 text-sm font-bold text-white bg-red-600 border border-transparent rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 shadow-md shadow-red-500/30 transition-all active:scale-95"
                        >
                            Delete Flow
                        </button>
                    </div>
                }
            >
                <div className="flex flex-col gap-4">
                    <div className="p-4 bg-red-50 border border-red-100 rounded-lg">
                        <p className="text-sm text-red-700">
                            <strong>Warning:</strong> Are you sure you want to delete this flow? This action cannot be undone and all associated analytics and logs will be permanently removed.
                        </p>
                    </div>
                </div>
            </Modal>
            

        </div>
    );
};

export default FlowList;
