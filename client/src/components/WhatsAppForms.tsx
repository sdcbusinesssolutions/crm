import React, { useState, useEffect } from 'react';
import { PlusIcon, SearchIcon, FilterIcon, EditIcon, TrashIcon, ChevronDownIcon } from './icons';
import { supabase } from '../lib/supabase';
import Modal from './Modal';
import Toast from './Toast';

interface WhatsAppFlow {
    id: string;
    name: string;
    status: 'DRAFT' | 'PUBLISHED' | 'DEPRECATED' | 'BLOCKED' | 'THROTTLED' | 'LOCAL_ARCHIVE';
    categories: string[];
    validation_errors: any[];
    created_at?: string; // API doesn't return this by default but useful if we had it
}

import { usePermissions, ACCESS_TYPES } from '../modules/teamStaff/hooks/usePermissions';

interface WhatsAppFormsProps {
    onNavigateToBuilder: (flowId: string | null) => void;
}

const WhatsAppForms: React.FC<WhatsAppFormsProps> = ({ onNavigateToBuilder }) => {
    const { hasAccess } = usePermissions();
    const canWrite = hasAccess('Form Builder', ACCESS_TYPES.READ_WRITE);

    const [flows, setFlows] = useState<WhatsAppFlow[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('All');
    const [filterStatus, setFilterStatus] = useState('All');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newFlowName, setNewFlowName] = useState('');
    const [newFlowCategory, setNewFlowCategory] = useState<string[]>(['OTHER']);
    const [createMode, setCreateMode] = useState<'json' | 'builder' | null>(null);
    const [jsonContent, setJsonContent] = useState('');
    const [jsonError, setJsonError] = useState<string | null>(null);

    const categories = [
        'SIGN_UP', 'SIGN_IN', 'APPOINTMENT_BOOKING', 'LEAD_GENERATION', 'CONTACT_US', 'CUSTOMER_SUPPORT', 'SURVEY', 'OTHER'
    ];

    useEffect(() => {
        fetchFlows();
    }, []);

    const filteredFlows = flows.filter(flow => {
        const matchesSearch = flow.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = filterCategory === 'All' || (flow.categories && flow.categories.includes(filterCategory));
        const matchesStatus = filterStatus === 'All' || flow.status === filterStatus;
        const isNotArchived = flow.status !== 'LOCAL_ARCHIVE';
        return matchesSearch && matchesCategory && matchesStatus && isNotArchived;
    });

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Reset pagination on filter change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterCategory, filterStatus]);

    // Pagination Calculations
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentFlows = filteredFlows.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredFlows.length / itemsPerPage);

    const fetchFlows = async () => {
        setIsLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const response = await fetch('/api/whatsapp/forms', {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch flows');
            }

            const data = await response.json();
            // API returns { data: [...], paging: {...} }
            setFlows(data.data || []);
        } catch (error) {
            console.error('Error fetching flows:', error);
            // Fallback to empty list or show error toast
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateFlow = async (overrideName?: string) => {
        const flowName = overrideName || newFlowName;
        if (!flowName) return;

        let flowJsonParsed = null;
        if (createMode === 'json') {
            // Validate JSON
            try {
                flowJsonParsed = JSON.parse(jsonContent);

                // Basic Schema Validation
                if (!flowJsonParsed.version) {
                    throw new Error('Missing "version" field in Flow JSON');
                }
                if (!flowJsonParsed.screens) {
                    throw new Error('Missing "screens" array in Flow JSON');
                }

                setJsonError(null);
            } catch (e: any) {
                setJsonError(e.message || 'Invalid JSON format');
                return;
            }
        }

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const response = await fetch('/api/whatsapp/forms', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    name: flowName,
                    categories: newFlowCategory,
                    flow_json: flowJsonParsed,
                    publish: false // Default to draft
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                const errorMessage = typeof errorData.error === 'string' ? errorData.error : JSON.stringify(errorData.error);

                // Check for specific unique name error
                if (errorMessage.toLowerCase().includes('unique') || errorMessage.toLowerCase().includes('already exists')) {
                    throw new Error('Flow name already exists. Please try again (a new name will be generated).');
                }
                throw new Error(errorMessage || 'Failed to create flow');
            }

            const newFlow = await response.json();
            console.log('Flow created:', newFlow);

            // Mock success
            setIsCreateModalOpen(false);
            setCreateMode(null);
            setNewFlowName('');
            setJsonContent('');
            fetchFlows(); // Refresh list

            if (createMode === 'builder' || overrideName) {
                // Navigate to builder with the new flow ID
                onNavigateToBuilder(newFlow.id);
            }
        } catch (error: any) {
            console.error('Error creating flow:', error);
            setJsonError(error.message || 'Failed to create flow');
        }
    };

    const handleCreateBuilderFlow = (name: string) => {
        handleCreateFlow(name);
    };

    const handleDeleteFlow = async (flowId: string, flowName: string) => {
        if (!window.confirm(`Are you sure you want to delete the flow "${flowName}"? This action cannot be undone.`)) {
            return;
        }

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const response = await fetch(`/api/whatsapp/forms/${flowId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete flow');
            }

            // Remove from list
            setFlows(flows.filter(f => f.id !== flowId));
        } catch (error: any) {
            console.error('Error deleting flow:', error);
            alert(`Failed to delete flow: ${error.message}`);
        }
    };

    const [previewFlow, setPreviewFlow] = useState<WhatsAppFlow | null>(null);
    const [sendFlowData, setSendFlowData] = useState<{ id: string, name: string } | null>(null);
    const [sendFormData, setSendFormData] = useState({
        phoneNumbers: '',
        headerText: '',
        bodyText: '',
        footerText: ''
    });
    const [isSending, setIsSending] = useState(false);
    const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info' | 'warning', title: string, message: string } | null>(null);

    const handlePreview = (flow: WhatsAppFlow) => {
        setPreviewFlow(flow);
    };

    const handleSendClick = (flow: WhatsAppFlow) => {
        setSendFlowData({ id: flow.id, name: flow.name });
        setSendFormData({
            phoneNumbers: '',
            headerText: `Check out ${flow.name}`,
            bodyText: 'Please complete this form',
            footerText: 'Powered by WhatsApp'
        });
    };

    const handleSendSubmit = async () => {
        if (!sendFlowData) return;
        setIsSending(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const response = await fetch(`/api/whatsapp/forms/${sendFlowData.id}/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    phone_numbers: sendFormData.phoneNumbers,
                    header_text: sendFormData.headerText,
                    body_text: sendFormData.bodyText,
                    footer_text: sendFormData.footerText
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to send flow');
            }

            const result = await response.json();
            const successCount = result.results.filter((r: any) => r.status === 'success').length;
            const failedCount = result.results.filter((r: any) => r.status === 'failed').length;

            setToast({
                type: 'success',
                title: 'Flow Sent',
                message: `Successfully sent to ${successCount} number(s).${failedCount > 0 ? ` Failed to send to ${failedCount} number(s).` : ''}`
            });
            setSendFlowData(null);
        } catch (error: any) {
            console.error('Error sending flow:', error);
            setToast({
                type: 'error',
                title: 'Failed to Send',
                message: error.message
            });
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="flex-1 h-full overflow-y-auto custom-scrollbar bg-slate-50/50 p-6 md:p-10">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">WhatsApp Forms</h1>
                        <p className="text-slate-500 mt-2 text-lg font-medium">Manage your WhatsApp Flows and Forms.</p>
                    </div>
                    {canWrite && (
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="px-5 py-2.5 bg-[var(--color-brand)] hover:opacity-90 text-white rounded-xl text-sm font-bold shadow-lg shadow-brand-200 transition-all flex items-center gap-2"
                        >
                            <PlusIcon className="w-5 h-5" />
                            Create New
                        </button>
                    )}
                </div>

                {/* Statistics Overview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {(() => {
                        const stats = {
                            total: flows.filter(f => f.status !== 'LOCAL_ARCHIVE').length,
                            published: flows.filter(f => f.status === 'PUBLISHED').length,
                            draft: flows.filter(f => f.status === 'DRAFT').length
                        };

                        return (
                            <>
                                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Forms</div>
                                    <div className="text-2xl font-black text-slate-900">{stats.total}</div>
                                </div>
                                <div className="bg-green-50 p-4 rounded-xl border border-green-200 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="text-xs font-bold text-green-600 uppercase tracking-wider mb-1">Published</div>
                                    <div className="text-2xl font-black text-green-700">{stats.published}</div>
                                </div>
                                <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Draft</div>
                                    <div className="text-2xl font-black text-blue-700">{stats.draft}</div>
                                </div>
                            </>
                        );
                    })()}
                </div>

                {/* Filters */}
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex flex-wrap gap-4 items-center w-full md:w-auto">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-500">Category:</span>
                            <select
                                value={filterCategory}
                                onChange={(e) => setFilterCategory(e.target.value)}
                                className="px-3 py-2 bg-white border border-brand-600 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
                            >
                                <option value="All">All</option>
                                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-500">Status:</span>
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="px-3 py-2 bg-white border border-brand-600 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
                            >
                                <option value="All">All</option>
                                <option value="DRAFT">Draft</option>
                                <option value="PUBLISHED">Published</option>
                            </select>
                        </div>
                    </div>
                    <div className="relative w-full md:w-64">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-600" />
                        <input
                            type="text"
                            placeholder="Search Form"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-white border border-brand-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all shadow-sm"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-brand-600 text-white shadow-md">
                                <tr className="bg-brand-600 border-none">
                                    <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Form Name</th>
                                    <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Category</th>
                                    <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Status</th>
                                    <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-8 text-center text-slate-500">Loading...</td>
                                    </tr>
                                ) : filteredFlows.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-8 text-center text-slate-500">No forms found.</td>
                                    </tr>
                                ) : (
                                    currentFlows.map((flow) => (
                                        <tr key={flow.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4 text-sm font-bold text-slate-900">{flow.name}</td>
                                            <td className="px-6 py-4 text-sm text-slate-600">
                                                {(flow.categories || []).map(cat => (
                                                    <span key={cat} className="inline-block bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-medium mr-1">
                                                        {cat}
                                                    </span>
                                                ))}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${flow.status === 'PUBLISHED' ? 'bg-green-100 text-green-800' :
                                                    flow.status === 'DRAFT' ? 'bg-blue-100 text-blue-800' :
                                                        'bg-slate-100 text-slate-800'
                                                    }`}>
                                                    {flow.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right flex justify-end gap-2">
                                                 <button
                                                    onClick={() => handlePreview(flow)}
                                                    className="text-slate-400 hover:text-blue-600 transition-colors p-1"
                                                    title="Preview"
                                                >
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                </button>
                                                {canWrite && (
                                                    <>
                                                        <button
                                                            onClick={() => handleSendClick(flow)}
                                                            className="text-slate-400 hover:text-green-600 transition-colors p-1"
                                                            title="Send Flow"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                                                        </button>
                                                        <button
                                                            onClick={() => onNavigateToBuilder(flow.id)}
                                                            className="text-slate-400 hover:text-brand-600 transition-colors p-1"
                                                            title="Edit"
                                                        >
                                                            <EditIcon className="w-5 h-5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteFlow(flow.id, flow.name)}
                                                            className="text-slate-400 hover:text-red-600 transition-colors p-1"
                                                            title="Delete"
                                                        >
                                                            <TrashIcon className="w-5 h-5" />
                                                        </button>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
                {/* Pagination */}
                {totalPages > 0 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/30">
                        <div className="text-xs text-slate-500 font-medium">
                            Showing <span className="font-bold">{filteredFlows.length > 0 ? indexOfFirstItem + 1 : 0}</span> to <span className="font-bold">{Math.min(indexOfLastItem, filteredFlows.length)}</span> of <span className="font-bold">{filteredFlows.length}</span> Records
                        </div>

                        {totalPages > 1 && (
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                    className="px-3 py-1 text-xs font-bold border border-slate-200 rounded-md hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed text-slate-600 transition-colors"
                                >
                                    Previous
                                </button>
                                <div className="flex gap-1">
                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(number => (
                                        <button
                                            key={number}
                                            onClick={() => setCurrentPage(number)}
                                            className={`w-7 h-7 flex items-center justify-center rounded-md text-xs font-bold transition-all ${currentPage === number ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500 hover:bg-white border border-transparent hover:border-slate-200'}`}
                                        >
                                            {number}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                    disabled={currentPage === totalPages}
                                    className="px-3 py-1 text-xs font-bold border border-slate-200 rounded-md hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed text-slate-600 transition-colors"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Create Modal */}
            <Modal
                isOpen={isCreateModalOpen}
                onClose={() => { setIsCreateModalOpen(false); setCreateMode(null); setNewFlowName(''); setJsonContent(''); setJsonError(null); }}
                title="Create WhatsApp Flow"
                size="2xl"
            >
                <div className="space-y-6">
                    {!createMode ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <button
                                onClick={() => setCreateMode('json')}
                                className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 rounded-xl hover:border-brand-500 hover:bg-brand-50/30 transition-all group"
                            >
                                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-brand-100 transition-colors">
                                    <span className="text-2xl font-mono text-slate-500 group-hover:text-brand-600">{"{ }"}</span>
                                </div>
                                <span className="text-lg font-bold text-slate-700 group-hover:text-brand-700">Create from JSON</span>
                                <span className="text-sm text-slate-500 mt-2 text-center">Paste existing Flow JSON code</span>
                            </button>

                            <button
                                onClick={() => {
                                    setNewFlowName('');
                                    setCreateMode('builder');
                                }}
                                className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 rounded-xl hover:border-brand-500 hover:bg-brand-50/30 transition-all group"
                            >
                                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-brand-100 transition-colors">
                                    <PlusIcon className="w-8 h-8 text-slate-500 group-hover:text-brand-600" />
                                </div>
                                <span className="text-lg font-bold text-slate-700 group-hover:text-brand-700">Drag & Drop Builder</span>
                                <span className="text-sm text-slate-500 mt-2 text-center">Visually build your flow</span>
                            </button>
                        </div>
                    ) : createMode === 'json' ? (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Flow Name</label>
                                    <input
                                        type="text"
                                        value={newFlowName}
                                        onChange={(e) => setNewFlowName(e.target.value)}
                                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
                                        placeholder="Enter flow name"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Category</label>
                                    <select
                                        value={newFlowCategory[0]}
                                        onChange={(e) => setNewFlowCategory([e.target.value])}
                                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
                                    >
                                        {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Flow JSON</label>
                                <textarea
                                    value={jsonContent}
                                    onChange={(e) => setJsonContent(e.target.value)}
                                    className="w-full h-64 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
                                    placeholder='{"version": "5.0", "screens": [...] }'
                                />
                                {jsonError && <p className="text-red-500 text-xs mt-1 font-medium">{jsonError}</p>}
                            </div>
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setCreateMode(null)}
                                    className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={() => handleCreateFlow()}
                                    disabled={!newFlowName}
                                    className="px-4 py-2 bg-brand-600 text-white font-bold rounded-lg hover:bg-brand-700 shadow-md shadow-brand-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Create Flow
                                </button>
                            </div>
                        </div>
                    ) : createMode === 'builder' ? (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Flow Name</label>
                                    <input
                                        type="text"
                                        value={newFlowName}
                                        onChange={(e) => setNewFlowName(e.target.value)}
                                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
                                        placeholder="Enter flow name"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Category</label>
                                    <select
                                        value={newFlowCategory[0]}
                                        onChange={(e) => setNewFlowCategory([e.target.value])}
                                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
                                    >
                                        {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-8">
                                <button
                                    onClick={() => setCreateMode(null)}
                                    className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={() => handleCreateBuilderFlow(newFlowName)}
                                    disabled={!newFlowName}
                                    className="px-4 py-2 bg-brand-600 text-white font-bold rounded-lg hover:bg-brand-700 shadow-md shadow-brand-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Start Building
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto mb-4"></div>
                            <p className="text-slate-500 font-medium text-lg">Creating your flow...</p>
                            {jsonError && (
                                <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-lg text-sm max-w-md mx-auto">
                                    <p className="font-bold mb-1">Error Creating Flow</p>
                                    <p>{jsonError}</p>
                                    <button
                                        onClick={() => setCreateMode(null)}
                                        className="mt-3 text-red-700 font-bold underline"
                                    >
                                        Try Again
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </Modal>

            {/* Preview Modal */}
            <Modal
                isOpen={!!previewFlow}
                onClose={() => setPreviewFlow(null)}
                title="Flow Preview"
                size="4xl"
            >
                <div className="flex-1 bg-slate-100 flex items-center justify-center p-4 min-h-[60vh]">
                    {(previewFlow as any)?.preview?.preview_url ? (
                        <iframe
                            src={(previewFlow as any).preview.preview_url}
                            className="w-full h-full rounded-xl border border-slate-200 bg-white shadow-sm min-h-[600px]"
                            title="Flow Preview"
                        />
                    ) : (
                        <div className="text-center text-slate-500">
                            <p>No preview URL available for this flow.</p>
                            <p className="text-xs mt-2">Note: Draft flows might not have a preview URL generated yet.</p>
                        </div>
                    )}
                </div>
            </Modal>

            {/* Send Flow Modal */}
            <Modal
                isOpen={!!sendFlowData}
                onClose={() => setSendFlowData(null)}
                title={`Send Flow: ${sendFlowData?.name}`}
                size="lg"
                footer={
                         <div className="flex justify-end gap-3 w-full">
                            <button
                                onClick={() => setSendFlowData(null)}
                                className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                {canWrite ? 'Cancel' : 'Close'}
                            </button>
                            {canWrite && (
                                <button
                                    onClick={handleSendSubmit}
                                    disabled={isSending || !sendFormData.phoneNumbers || !sendFormData.bodyText}
                                    className="px-4 py-2 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 shadow-md shadow-green-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {isSending ? 'Sending...' : (
                                        <>
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                                            Send Flow
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                }
            >
                <div className="space-y-4">
                    <div>
                        <span className="inline-block bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs font-bold">PUBLISHED</span>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Phone Number(s)</label>
                        <input
                            type="text"
                            value={sendFormData.phoneNumbers}
                            onChange={(e) => setSendFormData({ ...sendFormData, phoneNumbers: e.target.value })}
                            className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
                            placeholder="e.g., 91882228282 or multiple numbers: 91882228282,91993337777"
                        />
                        <p className="text-xs text-slate-500 mt-1">Include country code without '+' or '00'. For multiple numbers, separate with commas (no spaces).</p>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Header Text</label>
                        <input
                            type="text"
                            value={sendFormData.headerText}
                            onChange={(e) => setSendFormData({ ...sendFormData, headerText: e.target.value })}
                            className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
                            placeholder="Header text for your message"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Body Text</label>
                        <textarea
                            value={sendFormData.bodyText}
                            onChange={(e) => setSendFormData({ ...sendFormData, bodyText: e.target.value })}
                            className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
                            rows={3}
                            placeholder="Main body of your message"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Footer Text</label>
                        <input
                            type="text"
                            value={sendFormData.footerText}
                            onChange={(e) => setSendFormData({ ...sendFormData, footerText: e.target.value })}
                            className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
                            placeholder="Footer text for your message"
                        />
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
                )}
        </div>
    );
};

export default WhatsAppForms;
