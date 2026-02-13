import React, { useState, useEffect } from 'react';
import { PlusIcon, SearchIcon, EditIcon, TrashIcon, CopyIcon, EyeIcon } from '../icons';
import { supabase } from '../../lib/supabase';
import Modal from '../Modal';
import Toast from '../Toast';
import TemplatePreview from './TemplatePreview';

interface Template {
    id: string;
    name: string;
    language: string;
    category: string;
    status: string;
    updated_at: string;
    template_type: string;
    header_text?: string;
    body_text?: string;
    footer_text?: string;
    buttons?: any;
    quality_score?: any; // Can be string or object { score: string, date: number }
    components?: any[]; // Add components to interface
}

interface TemplateListProps {
    onNavigateToBuilder: (templateId: string | null) => void;
}

const TemplateList: React.FC<TemplateListProps> = ({ onNavigateToBuilder }) => {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('All');
    const [filterStatus, setFilterStatus] = useState('All');
    const [toast, setToast] = useState<{ type: 'success' | 'error', title: string, message: string } | null>(null);
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

    useEffect(() => {
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        setIsLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const response = await fetch('/api/whatsapp/templates', {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });

            if (!response.ok) throw new Error('Failed to fetch templates');

            const result = await response.json();
            setTemplates(result.data || []);
        } catch (error: any) {
            console.error('Error fetching templates:', error);
            setToast({ type: 'error', title: 'Error', message: error.message });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!window.confirm(`Are you sure you want to delete template "${name}"?`)) return;

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const response = await fetch(`/api/whatsapp/templates/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });

            if (!response.ok) throw new Error('Failed to delete template');

            setTemplates(templates.filter(t => t.id !== id));
            setToast({ type: 'success', title: 'Deleted', message: 'Template deleted successfully' });
        } catch (error: any) {
            console.error('Error deleting template:', error);
            setToast({ type: 'error', title: 'Error', message: error.message });
        }
    };

    const handleDuplicate = async (template: Template) => {
        if (!window.confirm(`Duplicate template "${template.name}"?`)) return;

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const response = await fetch(`/api/whatsapp/templates/${template.id}/duplicate`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to duplicate template');
            }

            setToast({ type: 'success', title: 'Duplicated', message: 'Template duplicated successfully' });
            fetchTemplates(); // Refresh list
        } catch (error: any) {
            console.error('Error duplicating template:', error);
            setToast({ type: 'error', title: 'Error', message: error.message });
        }
    };

    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);

    const filteredTemplates = templates.filter(t => {
        const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = filterCategory === 'All' || t.category === filterCategory;
        const matchesStatus = filterStatus === 'All' || t.status === filterStatus;
        return matchesSearch && matchesCategory && matchesStatus;
    });

    // Reset pagination when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterCategory, filterStatus]);

    // Pagination Logic
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentTemplates = filteredTemplates.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredTemplates.length / itemsPerPage);

    return (
        <div className="flex flex-col w-full h-full bg-slate-50 font-sans text-slate-900 animate-fade-in relative overflow-hidden container-mobile-fix">
            {/* Header - Fixed to Top */}
            <div className="bg-white/80 backdrop-blur-md border-b border-slate-200 shrink-0 z-30 sticky top-0">
                <div className="px-4 sm:px-8 py-3 max-w-[1800px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">WhatsApp Templates</h1>
                        <p className="text-slate-500 text-sm mt-1 font-medium hidden sm:block">Manage your message templates.</p>
                    </div>
                    <button
                        onClick={() => onNavigateToBuilder(null)}
                        className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-brand-200 transition-all flex items-center gap-2"
                    >
                        <PlusIcon className="w-5 h-5" />
                        Create New Template
                    </button>
                </div>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-8 pb-24">
                <div className="max-w-[1800px] mx-auto space-y-6">

                    {/* Statistics Overview */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        {(() => {
                            const stats = {
                                total: templates.length,
                                approved: templates.filter(t => t.status === 'APPROVED').length,
                                pending: templates.filter(t => t.status === 'PENDING').length,
                                rejected: templates.filter(t => t.status === 'REJECTED').length,
                                marketing: templates.filter(t => t.category === 'MARKETING').length,
                                utility: templates.filter(t => t.category === 'UTILITY').length
                            };

                            return (
                                <>
                                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total</div>
                                        <div className="text-2xl font-black text-slate-900">{stats.total}</div>
                                    </div>
                                    <div className="bg-green-50 p-4 rounded-xl border border-green-200 shadow-sm hover:shadow-md transition-shadow">
                                        <div className="text-xs font-bold text-green-600 uppercase tracking-wider mb-1">Approved</div>
                                        <div className="text-2xl font-black text-green-700">{stats.approved}</div>
                                    </div>
                                    <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200 shadow-sm hover:shadow-md transition-shadow">
                                        <div className="text-xs font-bold text-yellow-600 uppercase tracking-wider mb-1">Pending</div>
                                        <div className="text-2xl font-black text-yellow-700">{stats.pending}</div>
                                    </div>
                                    <div className="bg-red-50 p-4 rounded-xl border border-red-200 shadow-sm hover:shadow-md transition-shadow">
                                        <div className="text-xs font-bold text-red-600 uppercase tracking-wider mb-1">Rejected</div>
                                        <div className="text-2xl font-black text-red-700">{stats.rejected}</div>
                                    </div>
                                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 shadow-sm hover:shadow-md transition-shadow">
                                        <div className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Marketing</div>
                                        <div className="text-2xl font-black text-blue-700">{stats.marketing}</div>
                                    </div>
                                    <div className="bg-purple-50 p-4 rounded-xl border border-purple-200 shadow-sm hover:shadow-md transition-shadow">
                                        <div className="text-xs font-bold text-purple-600 uppercase tracking-wider mb-1">Utility</div>
                                        <div className="text-2xl font-black text-purple-700">{stats.utility}</div>
                                    </div>
                                </>
                            );
                        })()}
                    </div>

                    {/* Filters & Search */}
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-center justify-between">
                        <div className="flex flex-wrap gap-4 items-center w-full md:w-auto">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-slate-500">Category:</span>
                                <select
                                    value={filterCategory}
                                    onChange={(e) => setFilterCategory(e.target.value)}
                                    className="px-3 py-2 bg-white border border-brand-600 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
                                >
                                    <option value="All">All</option>
                                    <option value="MARKETING">Marketing</option>
                                    <option value="UTILITY">Utility</option>
                                    <option value="AUTHENTICATION">Authentication</option>
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
                                    <option value="APPROVED">Approved</option>
                                    <option value="PENDING">Pending</option>
                                    <option value="REJECTED">Rejected</option>
                                    <option value="PAUSED">Paused</option>
                                </select>
                            </div>
                        </div>
                        <div className="relative w-full md:w-80">
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-600" />
                            <input
                                type="text"
                                placeholder="Search Templates..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-white border border-brand-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all shadow-sm"
                            />
                        </div>
                    </div>

                    {/* Table */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-separate border-spacing-0">
                                <thead>
                                    <tr className="bg-brand-600 text-white shadow-md">
                                        <th className="px-6 py-5 text-left font-black uppercase tracking-wider text-xs text-white drop-shadow-sm !bg-brand-600 whitespace-nowrap">Name</th>
                                        <th className="px-6 py-5 text-left font-black uppercase tracking-wider text-xs text-white drop-shadow-sm !bg-brand-600 whitespace-nowrap">Language</th>
                                        <th className="px-6 py-5 text-left font-black uppercase tracking-wider text-xs text-white drop-shadow-sm !bg-brand-600 whitespace-nowrap">Category</th>
                                        <th className="px-6 py-5 text-left font-black uppercase tracking-wider text-xs text-white drop-shadow-sm !bg-brand-600 whitespace-nowrap">Status</th>
                                        <th className="px-6 py-5 text-left font-black uppercase tracking-wider text-xs text-white drop-shadow-sm !bg-brand-600 whitespace-nowrap">Quality</th>
                                        <th className="px-6 py-5 text-left font-black uppercase tracking-wider text-xs text-white drop-shadow-sm !bg-brand-600 whitespace-nowrap">Updated On</th>
                                        <th className="px-6 py-5 text-right font-black uppercase tracking-wider text-xs text-white drop-shadow-sm !bg-brand-600 whitespace-nowrap">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {isLoading ? (
                                        <tr><td colSpan={7} className="px-6 py-16 text-center text-slate-500">Loading...</td></tr>
                                    ) : currentTemplates.length === 0 ? (
                                        <tr><td colSpan={7} className="px-6 py-16 text-center text-slate-500">No templates found.</td></tr>
                                    ) : (
                                        currentTemplates.map((template) => (
                                            <tr key={template.id} className="hover:bg-slate-50 transition-colors group border-b border-slate-100">
                                                <td className="px-6 py-4 text-sm font-bold text-slate-900 border-b border-slate-100">{template.name}</td>
                                                <td className="px-6 py-4 text-sm text-slate-600 border-b border-slate-100">{template.language}</td>
                                                <td className="px-6 py-4 text-sm text-slate-600 border-b border-slate-100">
                                                    <span className="inline-block bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-medium">
                                                        {template.category}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 border-b border-slate-100">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${template.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                                                        template.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                                                            'bg-yellow-100 text-yellow-800'
                                                        }`}>
                                                        {template.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 border-b border-slate-100">
                                                    <span
                                                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold cursor-help ${(typeof template.quality_score === 'string' ? template.quality_score : template.quality_score?.score) === 'GREEN' ? 'bg-green-100 text-green-800' :
                                                            (typeof template.quality_score === 'string' ? template.quality_score : template.quality_score?.score) === 'YELLOW' ? 'bg-yellow-100 text-yellow-800' :
                                                                (typeof template.quality_score === 'string' ? template.quality_score : template.quality_score?.score) === 'RED' ? 'bg-red-100 text-red-800' :
                                                                    'bg-slate-100 text-slate-500'
                                                            }`}
                                                        title={typeof template.quality_score === 'object' && template.quality_score?.date
                                                            ? `Last updated: ${new Date(template.quality_score.date * 1000).toLocaleString()}`
                                                            : 'Quality score not available'
                                                        }
                                                    >
                                                        {(() => {
                                                            const rawScore = typeof template.quality_score === 'object' && template.quality_score?.score
                                                                ? template.quality_score.score
                                                                : (typeof template.quality_score === 'string' ? template.quality_score : 'N/A');

                                                            // Map specific values to user-friendly terms
                                                            if (rawScore === 'UNKNOWN') return 'Not Rated';
                                                            if (rawScore === 'N/A') return 'N/A';

                                                            // Convert others to Title Case (GREEN -> Green)
                                                            return rawScore.charAt(0).toUpperCase() + rawScore.slice(1).toLowerCase();
                                                        })()}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-500 border-b border-slate-100">
                                                    {new Date(template.updated_at).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4 text-right border-b border-slate-100">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => setSelectedTemplate(template)}
                                                            className="text-slate-400 hover:text-brand-600 transition-colors p-1"
                                                            title="Preview"
                                                        >
                                                            <EyeIcon className="w-5 h-5" />
                                                        </button>
                                                        <button
                                                            onClick={() => onNavigateToBuilder(template.id)}
                                                            className="text-slate-400 hover:text-brand-600 transition-colors p-1"
                                                            title="Edit"
                                                        >
                                                            <EditIcon className="w-5 h-5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(template.id, template.name)}
                                                            className="text-slate-400 hover:text-red-600 transition-colors p-1"
                                                            title="Delete"
                                                        >
                                                            <TrashIcon className="w-5 h-5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDuplicate(template)}
                                                            className="text-slate-400 hover:text-blue-600 transition-colors p-1"
                                                            title="Duplicate"
                                                        >
                                                            <CopyIcon className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50">
                                <div className="text-sm text-slate-500">
                                    Showing <span className="font-bold">{indexOfFirstItem + 1}</span> to <span className="font-bold">{Math.min(indexOfLastItem, filteredTemplates.length)}</span> of <span className="font-bold">{filteredTemplates.length}</span> results
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                        disabled={currentPage === 1}
                                        className="px-3 py-1 text-sm border border-slate-200 rounded-md hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Previous
                                    </button>
                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(number => (
                                        <button
                                            key={number}
                                            onClick={() => setCurrentPage(number)}
                                            className={`px-3 py-1 text-sm border rounded-md ${currentPage === number ? 'bg-brand-600 text-white border-brand-600' : 'border-slate-200 hover:bg-white'}`}
                                        >
                                            {number}
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                        disabled={currentPage === totalPages}
                                        className="px-3 py-1 text-sm border border-slate-200 rounded-md hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Preview Modal */}
            {selectedTemplate && (
                <Modal
                    isOpen={true}
                    onClose={() => setSelectedTemplate(null)}
                    title={`Preview: ${selectedTemplate.name}`}
                    size="lg"
                >
                    <div className="flex justify-center bg-slate-100 p-4 rounded-xl">
                        {(() => {
                            console.log('Previewing Template:', selectedTemplate); // DEBUG
                            let variableSamples: any[] = [];
                            let mediaUrl: string | undefined = undefined;
                            let carouselMediaUrls: string[] = [];
                            let previewActions = selectedTemplate.buttons || { type: 'NONE', buttons: [] };

                            try {
                                if (selectedTemplate.components && Array.isArray(selectedTemplate.components)) {
                                    const components = selectedTemplate.components;

                                    // 1. Extract Variables and Header Media
                                    components.forEach((c: any) => {
                                        // Variables
                                        if (c.type === 'BODY' && c.example) {
                                            if (c.example.body_text && Array.isArray(c.example.body_text) && c.example.body_text.length > 0) {
                                                const first = c.example.body_text[0];
                                                variableSamples = Array.isArray(first) ? first : c.example.body_text;
                                            } else if (c.example.body_text_named_params) {
                                                variableSamples = c.example.body_text_named_params;
                                            }
                                        }

                                        // Header Media
                                        if (c.type === 'HEADER' && c.example) {
                                            const urlVal = c.example.header_url || c.example.header_handle;
                                            if (urlVal) {
                                                if (Array.isArray(urlVal) && urlVal.length > 0) mediaUrl = urlVal[0];
                                                else if (typeof urlVal === 'string') mediaUrl = urlVal;
                                            }
                                        }

                                        // Carousel Media Extraction
                                        if (c.type === 'CAROUSEL' && Array.isArray(c.cards)) {
                                            c.cards.forEach((card: any) => {
                                                let url = '';
                                                // Try Meta Structure (card.components)
                                                if (Array.isArray(card.components)) {
                                                    const header = card.components.find((cc: any) => cc.type === 'HEADER');
                                                    if (header && header.example) {
                                                        const val = header.example.header_url || header.example.header_handle;
                                                        if (val) {
                                                            if (Array.isArray(val) && val.length > 0) url = val[0];
                                                            else if (typeof val === 'string') url = val;
                                                        }
                                                    }
                                                }
                                                // Fallback to Local/Flat Structure (card.header)
                                                if (!url && card.header && card.header.example) {
                                                    const val = card.header.example.header_url || card.header.example.header_handle;
                                                    if (val) {
                                                        if (Array.isArray(val) && val.length > 0) url = val[0];
                                                        else if (typeof val === 'string') url = val;
                                                    }
                                                }
                                                carouselMediaUrls.push(url);
                                            });
                                        }
                                    });

                                    // 2. Reconstruct Actions from Components (if needed or to be safe)
                                    const buttonsComp = components.find((c: any) => c.type === 'BUTTONS');
                                    const carouselComp = components.find((c: any) => c.type === 'CAROUSEL');

                                    if (carouselComp) {
                                        // Construct Carousel Actions
                                        const cards = (carouselComp.cards || []).map((card: any) => {
                                            let cardBody = '';
                                            let cardButtons: any[] = [];
                                            let cardHeaderFormat = 'IMAGE';

                                            if (Array.isArray(card.components)) {
                                                const b = card.components.find((cc: any) => cc.type === 'BODY');
                                                if (b) cardBody = b.text;
                                                const h = card.components.find((cc: any) => cc.type === 'HEADER');
                                                if (h) cardHeaderFormat = h.format;
                                                const btns = card.components.find((cc: any) => cc.type === 'BUTTONS');
                                                if (btns && btns.buttons) {
                                                    cardButtons = btns.buttons.map((btn: any) => ({
                                                        type: btn.type,
                                                        text: btn.text,
                                                        url: btn.url,
                                                        phone_number: btn.phone_number
                                                    }));
                                                }
                                            }

                                            return {
                                                header: { format: cardHeaderFormat },
                                                body: cardBody,
                                                buttons: cardButtons
                                            };
                                        });

                                        previewActions = {
                                            type: 'MEDIA_CARD_CAROUSEL',
                                            cards: cards
                                        };

                                    } else if (buttonsComp && buttonsComp.buttons && buttonsComp.buttons.length > 0) {
                                        // 3. Construct Standard Actions (Quick Reply, CTA, Form)
                                        // Always prioritize components if available, as they are the source of truth
                                        const btns = buttonsComp.buttons;
                                        const hasQuickReply = btns.some((b: any) => b.type === 'QUICK_REPLY');
                                        const hasCta = btns.some((b: any) => b.type === 'URL' || b.type === 'PHONE_NUMBER');
                                        const hasFlow = btns.some((b: any) => b.type === 'FLOW');

                                        if (hasQuickReply && hasCta) {
                                            previewActions = { type: 'ALL', buttons: btns };
                                        } else if (hasQuickReply) {
                                            previewActions = { type: 'QUICK_REPLY', buttons: btns };
                                        } else if (hasCta) {
                                            previewActions = { type: 'CALL_TO_ACTION', buttons: btns };
                                        } else if (hasFlow) {
                                            previewActions = { type: 'FORM', buttons: btns };
                                        }
                                    }
                                }
                            } catch (e) {
                                console.error('Error extracting preview data', e);
                            }

                            return (
                                <TemplatePreview
                                    type={selectedTemplate.template_type}
                                    header={selectedTemplate.header_text || ''}
                                    body={selectedTemplate.body_text || ''}
                                    footer={selectedTemplate.footer_text || ''}
                                    actions={previewActions}
                                    language={selectedTemplate.language}
                                    variableSamples={variableSamples}
                                    mediaUrl={mediaUrl}
                                    carouselMediaUrls={carouselMediaUrls}
                                />
                            );
                        })()}
                    </div>
                </Modal>
            )}

            {toast && <Toast type={toast.type} title={toast.title} message={toast.message} onClose={() => setToast(null)} />}
        </div>
    );
};

export default TemplateList;
