
import React, { useState, useEffect, useRef } from 'react';
import { flowService } from '../services/flowService';
import { Flow } from '../types';
import { UploadIcon, PlusIcon, CopyIcon, DownloadIcon, TrashIcon, SearchIcon, FilterIcon, EditIcon, TriggerIcon } from './icons';

interface DashboardProps {
    onNavigateToFlow: (flowId: string) => void;
}

const StatusBadge: React.FC<{status: string}> = ({status}) => {
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

const Dashboard: React.FC<DashboardProps> = ({ onNavigateToFlow }) => {
    const [flows, setFlows] = useState<Flow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('All');
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadFlows();
    }, []);

    const loadFlows = async () => {
        setIsLoading(true);
        const data = await flowService.getFlows();
        setFlows(data);
        setIsLoading(false);
    };

    const handleCreateFlow = async () => {
        const newFlow = await flowService.createFlow();
        onNavigateToFlow(newFlow.id);
    };

    const handleDeleteFlow = async (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        if(!window.confirm("Are you sure you want to delete this flow?")) return;

        const previousFlows = [...flows];
        setFlows(prevFlows => prevFlows.filter(f => String(f.id) !== String(id)));
        try {
            await flowService.deleteFlow(id);
        } catch (error) {
            alert("Failed to delete flow. Restoring list.");
            setFlows(previousFlows);
        }
    };

    const handleDuplicateFlow = async (e: React.MouseEvent, flow: Flow) => {
        e.preventDefault();
        e.stopPropagation();
        // Use robust ID generation to prevent key collisions
        const duplicatedFlow: Flow = {
            ...flow,
            id: `flow_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
            name: `${flow.name} (Copy)`,
            updatedAt: new Date().toLocaleDateString(),
            status: 'Draft'
        };
        await flowService.saveFlow(duplicatedFlow);
        await loadFlows();
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
                const newFlow: Flow = {
                    ...importedFlow,
                    // Robust ID generation
                    id: `flow_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
                    name: importedFlow.name ? `${importedFlow.name} (Imported)` : 'Imported Flow',
                    status: 'Draft',
                    updatedAt: new Date().toLocaleDateString()
                };
                await flowService.saveFlow(newFlow);
                await loadFlows();
            } catch (error) {
                alert('Failed to import flow.');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    const filteredFlows = flows.filter(flow => {
        const matchesSearch = flow.name.toLowerCase().includes(searchTerm.toLowerCase());
        const status = (flow.status || '').toLowerCase();
        const filter = statusFilter.toLowerCase();
        
        if (filter === 'all') return matchesSearch;
        return matchesSearch && status === filter;
    });

    return (
        <div className="flex flex-col w-full h-full bg-canvas-bg font-sans text-canvas-text animate-fade-in relative overflow-hidden">
            {/* Header - Fixed to Top */}
            <div className="bg-canvas-surface/80 backdrop-blur-md border-b border-slate-200 shrink-0 z-30 sticky top-0">
                <div className="px-4 sm:px-8 py-6 max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-extrabold text-canvas-text tracking-tight">Flow Builder</h1>
                        <p className="text-slate-500 text-sm mt-1 font-medium hidden sm:block">Design and automate conversations visually.</p>
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileChange} />
                        <button onClick={handleImportClick} className="flex-1 sm:flex-none flex items-center justify-center space-x-2 text-slate-600 hover:text-slate-900 hover:bg-white px-4 py-2.5 rounded-xl border border-slate-200 hover:border-slate-300 transition-all text-sm font-bold bg-slate-50 shadow-sm">
                            <UploadIcon /> <span className="hidden sm:inline">Import</span>
                        </button>
                        <button onClick={handleCreateFlow} className="flex-1 sm:flex-none flex items-center justify-center space-x-2 bg-brand-500 hover:bg-brand-600 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-brand-500/30 transition-all transform hover:-translate-y-0.5 text-sm font-bold active:scale-95">
                            <PlusIcon /> <span>New Flow</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Scrollable Content Area - Flex Grow */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-8 pb-24">
                <div className="max-w-7xl mx-auto">
                    {/* Filters */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                        <div className="relative w-full md:max-w-sm group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-brand-500 transition-colors">
                                <SearchIcon />
                            </div>
                            <input 
                                type="text" 
                                placeholder="Search flows..." 
                                className="pl-10 pr-4 py-3 w-full bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-sm shadow-sm transition-all outline-none font-medium placeholder-slate-400"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        
                        <div className="relative w-full md:w-auto">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                                <FilterIcon />
                            </div>
                            <select 
                                className="pl-9 pr-10 py-3 w-full md:w-48 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-sm shadow-sm appearance-none cursor-pointer font-bold text-slate-700 outline-none"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                            >
                                <option value="All">All Status</option>
                                <option value="Published">Published</option>
                                <option value="Draft">Draft</option>
                            </select>
                            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-slate-500">
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
                                <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                                    <table className="min-w-full divide-y divide-slate-100">
                                        <thead className="bg-slate-50/80">
                                            <tr>
                                                <th className="px-6 py-5 text-left text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Name</th>
                                                <th className="px-6 py-5 text-left text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Status</th>
                                                <th className="px-6 py-5 text-left text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Last Updated</th>
                                                <th className="px-6 py-5 text-right text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredFlows.map((flow) => {
                                                const isPublished = (flow.status || '').toLowerCase() === 'published';
                                                return (
                                                    <tr 
                                                        key={flow.id} 
                                                        // Using shadow inset for the left border is more reliable than border-l-4 on table rows in some browsers
                                                        className={`transition-all duration-200 group cursor-pointer ${
                                                            isPublished 
                                                                ? 'bg-emerald-50/60 shadow-[inset_4px_0_0_0_#10b981]' 
                                                                : 'bg-white hover:bg-slate-50 shadow-[inset_4px_0_0_0_transparent] hover:shadow-[inset_4px_0_0_0_#cbd5e1]'
                                                        }`}
                                                        onClick={() => onNavigateToFlow(flow.id)}
                                                    >
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <div className="flex items-center">
                                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm mr-4 transition-transform group-hover:scale-110 border ${
                                                                    isPublished 
                                                                        ? 'bg-emerald-100 text-emerald-600 border-emerald-200' 
                                                                        : 'bg-brand-50 text-brand-600 border-brand-100'
                                                                }`}>
                                                                    <TriggerIcon className="w-5 h-5"/>
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="text-sm font-bold text-slate-800">{flow.name}</span>
                                                                    <span className="text-xs text-slate-400 truncate max-w-xs mt-0.5">{flow.description || 'Automated conversation flow'}</span>
                                                                </div>
                                                            </div>
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
                                                                        onClick={(e) => handleTogglePublish(e, flow)} 
                                                                    />
                                                                </div>
                                                                <button onClick={() => onNavigateToFlow(flow.id)} className="p-2 rounded-lg hover:bg-brand-50 text-slate-400 hover:text-brand-600 transition-colors" title="Edit">
                                                                    <EditIcon className="w-4 h-4" />
                                                                </button>
                                                                <button onClick={(e) => handleDuplicateFlow(e, flow)} className="p-2 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors" title="Duplicate">
                                                                    <CopyIcon className="w-4 h-4" />
                                                                </button>
                                                                <button onClick={(e) => handleExportFlow(e, flow)} className="p-2 rounded-lg hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-colors" title="Export JSON">
                                                                    <DownloadIcon className="w-4 h-4" />
                                                                </button>
                                                                <button onClick={(e) => handleDeleteFlow(e, flow.id)} className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors" title="Delete">
                                                                    <TrashIcon className="w-4 h-4" />
                                                                </button>
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
                                    {filteredFlows.map((flow) => {
                                        const isPublished = (flow.status || '').toLowerCase() === 'published';
                                        return (
                                            <div 
                                                key={flow.id} 
                                                onClick={() => onNavigateToFlow(flow.id)}
                                                className={`rounded-2xl p-5 border shadow-sm hover:shadow-md transition-all active:scale-[0.99] relative overflow-hidden group ${
                                                    isPublished 
                                                        ? 'bg-emerald-50 border-emerald-200/60 shadow-[inset_4px_0_0_0_#10b981]' 
                                                        : 'bg-white border-slate-200 shadow-[inset_4px_0_0_0_transparent]'
                                                }`}
                                            >
                                                <div className="pl-2">
                                                    <div className="flex justify-between items-start mb-3">
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm border ${
                                                                isPublished 
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
                                                                <PublishToggle isPublished={isPublished} onClick={(e) => handleTogglePublish(e, flow)} />
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="flex items-center gap-1">
                                                            <button onClick={(e) => handleDuplicateFlow(e, flow)} className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors"><CopyIcon className="w-4 h-4"/></button>
                                                            <button onClick={(e) => handleExportFlow(e, flow)} className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-emerald-50 hover:text-emerald-600 transition-colors"><DownloadIcon className="w-4 h-4"/></button>
                                                            <button onClick={(e) => handleDeleteFlow(e, flow.id)} className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors"><TrashIcon className="w-4 h-4"/></button>
                                                            <button onClick={() => onNavigateToFlow(flow.id)} className="ml-2 px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg shadow-md active:scale-95 transition-all flex items-center gap-1">
                                                                Open Editor
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
                    
                    <div className="mt-8 text-center">
                        <span className="px-4 py-1.5 bg-slate-100 rounded-full text-[10px] font-extrabold text-slate-400 uppercase tracking-widest border border-slate-200">
                            Showing {filteredFlows.length} flow(s)
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
