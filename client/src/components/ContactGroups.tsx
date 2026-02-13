
import React, { useState, useEffect } from 'react';
import { ContactGroup } from '../types';
import { contactGroupService } from '../services/contactGroupService';
import { PlusIcon, EditIcon, TrashIcon, CloseIcon, SearchIcon, UsersIcon, ChevronDownIcon, BriefcaseIcon, DownloadIcon } from './icons';

interface ContactGroupsProps {
    onGroupClick?: (groupId: string) => void;
    onGroupCountUpdate?: (count: number) => void;
}

const ContactGroups: React.FC<ContactGroupsProps> = ({ onGroupClick, onGroupCountUpdate }) => {
    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const [groups, setGroups] = useState<ContactGroup[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'Active' | 'Archive'>('Active');
    const [searchTerm, setSearchTerm] = useState('');
    const [entriesPerPage] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isBulkDropdownOpen, setIsBulkDropdownOpen] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<ContactGroup | null>(null);
    const [formData, setFormData] = useState<Partial<ContactGroup>>({ name: '', description: '', contactCount: 0 });
    const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; type: 'single' | 'bulk'; id?: string; count?: number }>({ isOpen: false, type: 'single' });
    const [exportingId, setExportingId] = useState<string | null>(null);

    useEffect(() => {
        if (onGroupCountUpdate) {
            onGroupCountUpdate(groups.length);
        }
    }, [groups, onGroupCountUpdate]);

    useEffect(() => {
        loadGroups();
        const handleClickOutside = (event: MouseEvent) => {
            if (isBulkDropdownOpen && !(event.target as Element).closest('.bulk-action-container')) { setIsBulkDropdownOpen(false); }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isBulkDropdownOpen]);

    const loadGroups = async () => {
        setIsLoading(true);
        const data = await contactGroupService.getGroups();
        setGroups(data);
        setIsLoading(false);
    };

    const handleOpenModal = (group?: ContactGroup) => {
        if (group) { setEditingGroup(group); setFormData({ ...group }); }
        else { setEditingGroup(null); setFormData({ name: '', description: '', contactCount: 0 }); }
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name?.trim()) return;
        const newGroup: ContactGroup = {
            id: editingGroup ? editingGroup.id : `grp-${Date.now()}`,
            name: formData.name.trim(),
            description: formData.description || '',
            contactCount: editingGroup ? editingGroup.contactCount : 0,
            createdAt: editingGroup ? editingGroup.createdAt : new Date().toLocaleDateString(),
            status: editingGroup?.status || 'Active'
        };
        await contactGroupService.saveGroup(newGroup); await loadGroups(); setIsModalOpen(false);
    };

    const handleDelete = (id: string) => {
        setDeleteModal({ isOpen: true, type: 'single', id });
    };

    const proceedDelete = async () => {
        if (deleteModal.type === 'single' && deleteModal.id) {
            await contactGroupService.deleteGroup(deleteModal.id);
            const newSet = new Set(selectedIds); newSet.delete(deleteModal.id); setSelectedIds(newSet);
        } else if (deleteModal.type === 'bulk') {
            for (const id of Array.from(selectedIds)) await contactGroupService.deleteGroup(id as string);
            setSelectedIds(new Set());
        }
        await loadGroups();
        setDeleteModal({ isOpen: false, type: 'single' });
    };

    const handleArchive = async (group: ContactGroup) => {
        const newStatus = group.status === 'Active' ? 'Archive' : 'Active';
        await contactGroupService.saveGroup({ ...group, status: newStatus as 'Active' | 'Archive' });
        await loadGroups();
    };

    const handleExport = async (group: ContactGroup) => {
        setExportingId(group.id);
        try {
            const contacts = await contactGroupService.exportGroupContacts(group.id);
            if (!contacts || contacts.length === 0) {
                alert('No contacts found in this group.');
                setExportingId(null);
                return;
            }

            // Convert to CSV
            const headers = ['Name', 'Phone', 'Email', 'Source', 'Status', 'Created At'];
            const csvContent = [
                headers.join(','),
                ...contacts.map(c => [
                    `"${c.name || ''}"`,
                    `"${c.phone || ''}"`,
                    `"${c.email || ''}"`,
                    `"${c.source || ''}"`,
                    `"${c.status || ''}"`,
                    `"${c.created_at ? new Date(c.created_at).toLocaleDateString() : ''}"`
                ].join(','))
            ].join('\n');

            // Download
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${group.name}_contacts.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('Export failed:', error);
            alert('Failed to export contacts.');
        } finally {
            setExportingId(null);
        }
    };

    const handleSelectAll = () => {
        const allSelected = currentEntries.length > 0 && currentEntries.every(g => selectedIds.has(g.id));
        const newSet = new Set(selectedIds);
        if (allSelected) currentEntries.forEach(g => newSet.delete(g.id));
        else currentEntries.forEach(g => newSet.add(g.id));
        setSelectedIds(newSet);
    };
    const handleSelectRow = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
        setSelectedIds(newSet);
    };

    const handleBulkAction = async (action: 'delete' | 'archive') => {
        setIsBulkDropdownOpen(false);
        if (selectedIds.size === 0) return;
        if (action === 'delete') {
            setDeleteModal({ isOpen: true, type: 'bulk', count: selectedIds.size });
        } else if (action === 'archive') {
            const groupsToUpdate = groups.filter(g => selectedIds.has(g.id));
            for (const group of groupsToUpdate) {
                const newStatus = group.status === 'Active' ? 'Archive' : 'Active';
                await contactGroupService.saveGroup({ ...group, status: newStatus });
            }
            setSelectedIds(new Set()); await loadGroups();
        }
    };

    const filteredGroups = groups.filter(g => (g.status || 'Active') === activeTab && g.name.toLowerCase().includes(searchTerm.toLowerCase()));
    const totalPages = Math.ceil(filteredGroups.length / entriesPerPage);
    const currentEntries = filteredGroups.slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage);

    return (
        <div className="p-4 sm:p-8 space-y-6 animate-fade-in">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-1.5">
                <div className="flex items-center p-1 bg-slate-50 rounded-xl">
                    {['Active', 'Archive'].map((tab) => (
                        <button key={tab} onClick={() => { setActiveTab(tab as any); setCurrentPage(1); setSelectedIds(new Set()); }} className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${activeTab === tab ? 'bg-white text-brand-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}>{tab} Groups</button>
                    ))}
                </div>
            </div>

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto flex-1 lg:max-w-2xl">
                    <div className="relative group flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-brand-600 group-focus-within:text-brand-600 transition-colors"><SearchIcon /></div>
                        <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="pl-10 pr-4 py-2.5 w-full bg-white border border-brand-600 rounded-btn focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 text-sm shadow-sm outline-none transition-all placeholder:text-slate-400" />
                    </div>

                    <div className="relative bulk-action-container">
                        <button onClick={() => setIsBulkDropdownOpen(!isBulkDropdownOpen)} disabled={selectedIds.size === 0} className={`w-full sm:w-auto px-4 py-2.5 text-sm font-bold rounded-btn shadow-sm flex items-center justify-center gap-2 transition-all border ${selectedIds.size > 0 ? 'bg-brand-600 text-white border-brand-600 hover:bg-brand-700 shadow-md shadow-brand-200' : 'bg-brand-600 text-white border-brand-600 opacity-60 cursor-not-allowed'}`}>Bulk <ChevronDownIcon className="w-3 h-3" /></button>
                        {isBulkDropdownOpen && selectedIds.size > 0 && (
                            <div className="absolute left-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-btn shadow-xl z-30 py-1 overflow-hidden animate-fade-in">
                                <button onClick={() => handleBulkAction('archive')} className="block w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 font-medium transition-colors">{activeTab === 'Active' ? 'Archive Selected' : 'Activate Selected'}</button>
                                <button onClick={() => handleBulkAction('delete')} className="block w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 font-medium transition-colors">Delete Selected</button>
                            </div>
                        )}
                    </div>
                </div>
                <button onClick={() => handleOpenModal()} className="flex items-center justify-center space-x-2 bg-brand-600 hover:bg-brand-700 text-white px-6 py-2.5 rounded-btn font-bold shadow-md shadow-brand-200 transition-all transform hover:-translate-y-0.5 text-sm w-full sm:w-auto"><PlusIcon /><span>Create Group</span></button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="flex items-center justify-center p-12 text-slate-400"><div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mr-3"></div>Loading...</div>
                ) : filteredGroups.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-16 text-center"><div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4"><UsersIcon className="w-8 h-8 text-slate-300" /></div><p className="text-slate-900 font-bold text-lg">No groups found</p></div>
                ) : (
                    <>
                        <div className="hidden md:block overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-100">
                                <thead className="bg-brand-600 text-white shadow-md">
                                    <tr>
                                        <th className="px-6 py-4 text-left w-10 !bg-brand-600 text-white"><input type="checkbox" className="rounded border-brand-300 text-brand-600 focus:ring-brand-500 h-4 w-4 cursor-pointer" checked={currentEntries.length > 0 && currentEntries.every(g => selectedIds.has(g.id))} onChange={handleSelectAll} /></th>
                                        <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Title</th>
                                        <th className="px-6 py-4 text-center text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Contacts</th>
                                        <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Created</th>
                                        <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Updated</th>
                                        <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Description</th>
                                        <th className="px-6 py-4 text-right text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {currentEntries.map((group) => (
                                        <tr key={group.id} className={`hover:bg-slate-50 transition-colors ${selectedIds.has(group.id) ? 'bg-brand-50/30' : ''}`}>
                                            <td className="px-6 py-4"><input type="checkbox" className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 h-4 w-4 cursor-pointer" checked={selectedIds.has(group.id)} onChange={() => handleSelectRow(group.id)} /></td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <button
                                                    onClick={() => onGroupClick?.(group.id)}
                                                    className="text-sm font-bold text-slate-900 hover:text-brand-600 transition-colors cursor-pointer underline decoration-transparent hover:decoration-brand-600"
                                                >
                                                    {group.name}
                                                </button>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                                                    {group.contactCount || 0}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">{formatDate(group.createdAt)}</td>
                                            <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">{formatDate(group.updatedAt || group.createdAt)}</td>
                                            <td className="px-6 py-4 text-sm text-slate-500">{group.description || '-'}</td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end space-x-2">
                                                    <button onClick={() => handleExport(group)} className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Export Contacts">
                                                        {exportingId === group.id ? (
                                                            <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                                                        ) : (
                                                            <DownloadIcon className="w-4 h-4" />
                                                        )}
                                                    </button>
                                                    <button onClick={() => handleOpenModal(group)} className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"><EditIcon className="w-4 h-4" /></button>
                                                    <button onClick={() => handleArchive(group)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><BriefcaseIcon className="w-4 h-4" /></button>
                                                    <button onClick={() => handleDelete(group.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><TrashIcon className="w-4 h-4" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {/* Mobile View */}
                        <div className="md:hidden grid grid-cols-1 gap-4 p-4 bg-slate-50/50">
                            {currentEntries.map(group => (
                                <div key={group.id} className={`bg-white p-5 rounded-xl border ${selectedIds.has(group.id) ? 'border-brand-300 ring-1 ring-brand-200 shadow-md' : 'border-slate-200 shadow-sm'} relative`}>
                                    <div className="absolute top-5 right-5"><input type="checkbox" className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 h-5 w-5" checked={selectedIds.has(group.id)} onChange={() => handleSelectRow(group.id)} /></div>
                                    <h3 className="font-bold text-slate-900 text-lg">{group.name}</h3>
                                    <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                                        <button onClick={() => handleExport(group)} className="p-2 bg-slate-50 rounded-lg text-slate-500 hover:text-green-600 border border-slate-200 hover:border-green-200">
                                            {exportingId === group.id ? (
                                                <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                                            ) : (
                                                <DownloadIcon className="w-4 h-4" />
                                            )}
                                        </button>
                                        <button onClick={() => handleOpenModal(group)} className="p-2 bg-slate-50 rounded-lg text-slate-500 hover:text-brand-600 border border-slate-200 hover:border-brand-200"><EditIcon className="w-4 h-4" /></button>
                                        <button onClick={() => handleDelete(group.id)} className="p-2 bg-slate-50 rounded-lg text-slate-500 hover:text-red-600 border border-slate-200 hover:border-red-200"><TrashIcon className="w-4 h-4" /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
                <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center gap-4">
                    <div className="flex gap-2">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-4 py-2 border border-slate-300 rounded-btn bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 text-sm font-bold shadow-sm">Previous</button>
                        <div className="px-4 py-2 bg-brand-600 text-white rounded-btn text-sm font-bold shadow-sm shadow-brand-200">{currentPage}</div>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-4 py-2 border border-slate-300 rounded-btn bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 text-sm font-bold shadow-sm">Next</button>
                    </div>
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity" onClick={() => setIsModalOpen(false)}></div>
                    <div className="relative bg-white w-full sm:w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col animate-slide-up sm:animate-fade-in">
                        <div className="flex justify-between items-center px-6 py-5 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl">
                            <h3 className="text-lg font-extrabold text-slate-900">{editingGroup ? 'Edit Group' : 'New Group'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 bg-white border border-slate-200 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"><CloseIcon className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6"><form id="group-form" onSubmit={handleSave} className="space-y-5"><div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Group Name</label><input type="text" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-btn focus:ring-2 focus:ring-brand-500 text-slate-900 outline-none font-medium" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div></form></div>
                        <div className="px-6 py-5 bg-slate-50 border-t border-slate-200 flex justify-end space-x-3 rounded-b-2xl">
                            <button onClick={() => setIsModalOpen(false)} className="px-6 py-3 bg-white border border-slate-200 rounded-btn font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-sm">Cancel</button>
                            <button type="submit" form="group-form" className="px-6 py-3 bg-brand-600 text-white rounded-btn font-bold hover:bg-brand-700 shadow-md shadow-brand-200 transition-transform transform hover:-translate-y-0.5">Save Group</button>
                        </div>
                    </div>
                </div>
            )}
            {deleteModal.isOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => setDeleteModal({ ...deleteModal, isOpen: false })}></div>
                    <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-scale-in border border-slate-100">
                        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4 mx-auto">
                            <TrashIcon className="w-6 h-6 text-red-600" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 text-center mb-2">Delete {deleteModal.type === 'single' ? 'Group' : `${deleteModal.count} Groups`}?</h3>
                        <p className="text-sm text-slate-500 text-center mb-6">
                            Are you sure you want to delete {deleteModal.type === 'single' ? 'this group' : 'these groups'}? This action cannot be undone.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteModal({ ...deleteModal, isOpen: false })}
                                className="flex-1 px-4 py-2.5 bg-white border border-slate-300 rounded-btn font-bold text-slate-700 hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={proceedDelete}
                                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-btn font-bold hover:bg-red-700 shadow-md shadow-red-200"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
export default ContactGroups;
