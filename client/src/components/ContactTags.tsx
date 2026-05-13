import React, { useState, useEffect } from 'react';
import { Tag, tagService } from '../services/tagService'; // You might need to export Tag type from service or shared types
import { PlusIcon, EditIcon, TrashIcon, CloseIcon, SearchIcon, ChevronDownIcon, TagIcon, ChevronLeftIcon } from './icons';
import Toast from './Toast';
import { PermissionGate } from '../modules/teamStaff/components/PermissionGate';
import { ACCESS_TYPES } from '../modules/teamStaff/hooks/usePermissions';

interface ContactTagsProps {
    onTagClick?: (tagId: string) => void;
}

const ContactTags: React.FC<ContactTagsProps> = () => {
    // Tag List State
    const [tags, setTags] = useState<Tag[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [entriesPerPage] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [tagStats, setTagStats] = useState<Record<string, { lastUpdated: string | null, count: number }>>({});
    const [isBulkDropdownOpen, setIsBulkDropdownOpen] = useState(false);
    const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info' | 'warning', title: string, message: string } | null>(null);

    // Create/Edit Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTag, setEditingTag] = useState<Tag | null>(null);
    const [formData, setFormData] = useState<Partial<Tag>>({ name: '', description: '', color: '#10b981' });

    // Contacts View State (Drill-down)
    const [viewMode, setViewMode] = useState<'list' | 'details'>('list');
    const [activeTag, setActiveTag] = useState<Tag | null>(null);
    const [tagContacts, setTagContacts] = useState<any[]>([]); // Use proper Contact type
    const [contactsLoading, setContactsLoading] = useState(false);
    const [contactsPage, setContactsPage] = useState(1);
    const [contactsTotal, setContactsTotal] = useState(0);

    useEffect(() => {
        loadTags();
    }, []);

    useEffect(() => {
        if (viewMode === 'details' && activeTag) {
            loadTagContacts(activeTag.name, contactsPage);
        }
    }, [contactsPage, viewMode, activeTag]);

    const loadTags = async () => {
        setIsLoading(true);
        try {
            const data = await tagService.getTags();
            setTags(data);
        } catch (err) {
            console.error(err);
        }
        setIsLoading(false);
    };

    const loadTagContacts = async (tagName: string, page: number) => {
        setContactsLoading(true);
        try {
            const { contacts, total } = await tagService.getContactsByTag(tagName, page, 10);
            setTagContacts(contacts);
            setContactsTotal(total);
        } catch (err) {
            console.error(err);
        }
        setContactsLoading(false);
    };

    const handleOpenModal = (tag?: Tag) => {
        if (tag) {
            setEditingTag(tag);
            setFormData({ ...tag });
        } else {
            setEditingTag(null);
            setFormData({ name: '', description: '', color: '#10b981' });
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name?.trim()) return;

        try {
            await tagService.saveTag({
                ...formData,
                id: editingTag?.id
            });
            await loadTags();
            setIsModalOpen(false);
        } catch (err) {
            console.error("Failed to save tag", err);
            setToast({
                type: 'error',
                title: 'Error Saving Tag',
                message: 'Failed to save tag. Please ensure the tag name is unique.'
            });
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("Are you sure? This will delete the tag from the management list, but existing contacts may still have the text tag.")) {
            await tagService.deleteTag(id);
            await loadTags();
            const newSet = new Set(selectedIds);
            newSet.delete(id);
            setSelectedIds(newSet);
        }
    };

    const handleBulkDelete = async () => {
        if (window.confirm(`Delete ${selectedIds.size} tags?`)) {
            for (const id of Array.from(selectedIds)) {
                await tagService.deleteTag(id);
            }
            setSelectedIds(new Set());
            await loadTags();
            setIsBulkDropdownOpen(false);
        }
    };

    const handleViewContacts = (tag: Tag) => {
        setActiveTag(tag);
        setContactsPage(1);
        setViewMode('details');
    };

    const handleBackToList = () => {
        setViewMode('list');
        setActiveTag(null);
        setTagContacts([]);
    };

    // Filter Logic for Tags List
    const filteredTags = tags.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()));
    const totalPages = Math.ceil(filteredTags.length / entriesPerPage);
    const currentEntries = filteredTags.slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage);

    // Fetch stats for visible tags
    useEffect(() => {
        const fetchStats = async () => {
            const stats: Record<string, { lastUpdated: string | null, count: number }> = {};
            await Promise.all(currentEntries.map(async (tag) => {
                const [lastTime, count] = await Promise.all([
                    tagService.getLastContactTime(tag.name),
                    tagService.getContactCount(tag.name)
                ]);
                stats[tag.id] = { lastUpdated: lastTime, count: count };
            }));
            setTagStats(prev => ({ ...prev, ...stats }));
        };

        if (currentEntries.length > 0) {
            fetchStats();
        }
    }, [currentEntries]);

    // Filter Logic for Contacts Inside Tag (handled by server pagination mostly, but we display here)

    if (viewMode === 'details' && activeTag) {
        return (
            <div className="p-4 sm:p-6 space-y-6 animate-fade-in">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <button onClick={handleBackToList} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <ChevronLeftIcon className="w-6 h-6 text-slate-600" />
                    </button>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            <TagIcon className="w-6 h-6 text-brand-600" />
                            {activeTag.name}
                        </h2>
                        <p className="text-sm text-slate-500">Managing contacts with this tag</p>
                    </div>
                </div>

                {/* Contacts Table */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    {contactsLoading ? (
                        <div className="p-12 text-center text-slate-400">Loading contacts...</div>
                    ) : tagContacts.length === 0 ? (
                        <div className="p-12 text-center text-slate-500">No contacts found with this tag.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-100">
                                <thead className="bg-slate-50/80">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Name</th>
                                        <th className="px-6 py-3 text-left text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Phone</th>
                                        <th className="px-6 py-3 text-left text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Email</th>
                                        <th className="px-6 py-3 text-left text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Added At</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {tagContacts.map((c) => (
                                        <tr key={c.id} className="hover:bg-slate-50">
                                            <td className="px-6 py-4 font-bold text-slate-800">{c.name || 'Unknown'}</td>
                                            <td className="px-6 py-4 text-sm text-slate-600">{c.phone}</td>
                                            <td className="px-6 py-4 text-sm text-slate-600">{c.email || '-'}</td>
                                            <td className="px-6 py-4 text-xs text-slate-400">{new Date(c.created_at).toLocaleDateString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination for Contacts */}
                    <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
                        <span className="text-xs text-slate-500">Total: {contactsTotal} contacts</span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setContactsPage(p => Math.max(1, p - 1))}
                                disabled={contactsPage === 1}
                                className="px-3 py-1 border border-slate-300 rounded bg-white text-sm disabled:opacity-50"
                            >
                                Prev
                            </button>
                            <span className="px-3 py-1 bg-white border border-slate-300 rounded text-sm">{contactsPage}</span>
                            <button
                                onClick={() => setContactsPage(p => p + 1)}
                                disabled={tagContacts.length < 10 && (contactsPage * 10 >= contactsTotal)} // Approximation logic
                                className="px-3 py-1 border border-slate-300 rounded bg-white text-sm disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Default: Tags List View
    return (
        <div className="p-4 sm:p-6 space-y-6 animate-fade-in">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex gap-3 w-full lg:w-auto flex-1 lg:max-w-xl">
                    <div className="relative group flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-brand-600"><SearchIcon /></div>
                        <input
                            type="text"
                            placeholder="Search tags..."
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            className="pl-10 pr-4 py-2.5 w-full bg-white border border-brand-600 rounded-btn focus:ring-2 focus:ring-brand-500/20 text-sm shadow-sm outline-none placeholder:text-slate-400"
                        />
                    </div>
                    {selectedIds.size > 0 && (
                        <PermissionGate moduleName="Tags" requiredAccess={ACCESS_TYPES.READ_WRITE}>
                            <button onClick={handleBulkDelete} className="px-4 py-2 bg-red-50 text-red-600 border border-red-100 rounded-btn font-bold text-sm hover:bg-red-100">
                                Delete ({selectedIds.size})
                            </button>
                        </PermissionGate>
                    )}
                </div>
                <PermissionGate moduleName="Tags" requiredAccess={ACCESS_TYPES.READ_WRITE}>
                    <button onClick={() => handleOpenModal()} className="flex items-center justify-center space-x-2 bg-brand-600 hover:bg-brand-700 text-white px-6 py-2.5 rounded-btn font-bold shadow-md text-sm w-full sm:w-auto">
                        <PlusIcon /><span>Create Tag</span>
                    </button>
                </PermissionGate>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="flex items-center justify-center p-12 text-slate-400">Loading Tags...</div>
                ) : filteredTags.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-16 text-center">
                        <TagIcon className="w-12 h-12 text-slate-200 mb-3" />
                        <p className="text-slate-900 font-bold">No tags found</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-100">
                            <thead className="bg-brand-600 text-white shadow-md">
                                <tr>
                                    <th className="px-6 py-4 w-10 !bg-brand-600 text-white">
                                        <input
                                            type="checkbox"
                                            className="rounded border-brand-300 text-brand-600 focus:ring-brand-500 h-4 w-4 cursor-pointer"
                                            checked={currentEntries.length > 0 && currentEntries.every(t => selectedIds.has(t.id))}
                                            onChange={() => {
                                                const allSelected = currentEntries.every(t => selectedIds.has(t.id));
                                                const newSet = new Set(selectedIds);
                                                if (allSelected) currentEntries.forEach(t => newSet.delete(t.id));
                                                else currentEntries.forEach(t => newSet.add(t.id));
                                                setSelectedIds(newSet);
                                            }}
                                        />
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Tag Name</th>
                                    <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Description</th>
                                    <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Contacts</th>
                                    <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Created</th>
                                    <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Last Updated</th>
                                    <th className="px-6 py-4 text-right text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {currentEntries.map((tag) => (
                                    <tr key={tag.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <input
                                                type="checkbox"
                                                className="rounded border-slate-300 h-4 w-4"
                                                checked={selectedIds.has(tag.id)}
                                                onChange={() => {
                                                    const newSet = new Set(selectedIds);
                                                    if (newSet.has(tag.id)) newSet.delete(tag.id); else newSet.add(tag.id);
                                                    setSelectedIds(newSet);
                                                }}
                                            />
                                        </td>
                                        <td className="px-6 py-4">
                                            <button onClick={() => handleViewContacts(tag)} className="group flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px]" style={{ backgroundColor: tag.color + '20', color: tag.color }}>
                                                    #
                                                </div>
                                                <span className="font-bold text-slate-900 group-hover:text-brand-600 underline decoration-transparent group-hover:decoration-brand-600 transition-all">
                                                    {tag.name}
                                                </span>
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 text-xs text-slate-500 font-medium">{tag.description || '-'}</td>
                                        <td className="px-6 py-4 text-xs font-bold text-slate-900">
                                            {tagStats[tag.id]?.count ?? '-'}
                                        </td>
                                        <td className="px-6 py-4 text-xs text-slate-500 font-medium">
                                            {tag.created_at ? new Date(tag.created_at).toLocaleString() : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-xs text-slate-500 font-medium">
                                            {tagStats[tag.id]?.lastUpdated ? new Date(tagStats[tag.id]!.lastUpdated!).toLocaleString() : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <PermissionGate moduleName="Tags" requiredAccess={ACCESS_TYPES.READ_WRITE}>
                                                    <button onClick={() => handleOpenModal(tag)} className="p-2 text-slate-400 hover:text-brand-600 rounded-lg"><EditIcon className="w-4 h-4" /></button>
                                                </PermissionGate>
                                                <PermissionGate moduleName="Tags" requiredAccess={ACCESS_TYPES.READ_WRITE}>
                                                    <button onClick={() => handleDelete(tag.id)} className="p-2 text-slate-400 hover:text-red-600 rounded-lg"><TrashIcon className="w-4 h-4" /></button>
                                                </PermissionGate>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {/* Pagination for Tags */}
                <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center gap-4">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-4 py-2 border border-slate-300 rounded-btn bg-white text-sm font-bold disabled:opacity-50">Previous</button>
                    <span className="text-sm font-bold text-slate-600">Page {currentPage} of {totalPages || 1}</span>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-4 py-2 border border-slate-300 rounded-btn bg-white text-sm font-bold disabled:opacity-50">Next</button>
                </div>
            </div>

            {/* Toast Notification */}
            {toast && (
                <Toast
                    type={toast.type}
                    title={toast.title}
                    message={toast.message}
                    onClose={() => setToast(null)}
                />
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
                    <div className="relative bg-white w-full max-w-md rounded-2xl shadow-xl flex flex-col animate-slide-up">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-2xl">
                            <h3 className="text-lg font-extrabold text-slate-900">{editingTag ? 'Edit Tag' : 'New Tag'}</h3>
                            <button onClick={() => setIsModalOpen(false)}><CloseIcon className="w-5 h-5 text-slate-400" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Tag Name</label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-btn focus:ring-2 focus:ring-brand-500 outline-none"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g. Verified, VIP"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Description</label>
                                <textarea
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-btn focus:ring-2 focus:ring-brand-500 outline-none h-24 resize-none"
                                    value={formData.description || ''}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Optional description..."
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Color</label>
                                <div className="flex gap-2 flex-wrap">
                                    {['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#64748b'].map(c => (
                                        <button
                                            key={c}
                                            onClick={() => setFormData({ ...formData, color: c })}
                                            className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${formData.color === c ? 'ring-2 ring-offset-2 ring-brand-500 scale-110' : ''}`}
                                            style={{ backgroundColor: c }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end gap-3">
                            <button onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 bg-white border border-slate-200 rounded-btn text-slate-600 font-bold">Cancel</button>
                            <button onClick={handleSave} className="px-5 py-2.5 bg-brand-600 text-white rounded-btn font-bold hover:bg-brand-700 shadow-md">Save Tag</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ContactTags;
