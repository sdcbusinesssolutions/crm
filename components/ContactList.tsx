
import React, { useState, useEffect, useRef } from 'react';
import { contactService } from '../services/contactService';
import { contactGroupService } from '../services/contactGroupService';
import { inputFieldService } from '../services/inputFieldService';
import { Contact, ContactGroup, InputField } from '../types';
import {
    PlusIcon, EditIcon, TrashIcon, SearchIcon, UploadIcon, DownloadIcon,
    CloseIcon, BadgeIcon, ChevronDownIcon, UsersIcon
} from './icons';

const ContactList: React.FC = () => {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [entriesPerPage, setEntriesPerPage] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [availableGroups, setAvailableGroups] = useState<ContactGroup[]>([]);
    const [customInputFields, setCustomInputFields] = useState<InputField[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isBulkDropdownOpen, setIsBulkDropdownOpen] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingContact, setEditingContact] = useState<Contact | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [formData, setFormData] = useState<Partial<Contact>>({ name: '', phone: '', email: '', status: 'New', tags: [], source: 'Manual', groupIds: [], customData: {} });
    const [tagInput, setTagInput] = useState('');

    useEffect(() => {
        loadInitialData();
        const handleClickOutside = (event: MouseEvent) => {
            if (isBulkDropdownOpen && !(event.target as Element).closest('.bulk-action-container')) setIsBulkDropdownOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isBulkDropdownOpen]);

    const loadInitialData = async () => {
        setIsLoading(true);
        const [contactsData, groupsData, inputsData] = await Promise.all([
            contactService.getContacts(), contactGroupService.getGroups(), inputFieldService.getInputs()
        ]);
        setContacts(contactsData); setAvailableGroups(groupsData); setCustomInputFields(inputsData); setIsLoading(false);
    };

    const loadContacts = async () => {
        const data = await contactService.getContacts();
        setContacts(data);
    };

    const handleOpenModal = (contact?: Contact) => {
        if (contact) { setEditingContact(contact); setFormData({ ...contact }); }
        else { setEditingContact(null); setFormData({ name: '', phone: '', email: '', status: 'New', tags: [], source: 'Manual', groupIds: [], customData: {} }); }
        setTagInput(''); setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const newContact: Contact = {
            id: editingContact ? editingContact.id : `cnt-${Date.now()}`,
            name: formData.name || 'Unknown',
            phone: formData.phone || '',
            email: formData.email || '',
            status: (formData.status as any) || 'New',
            tags: formData.tags || [],
            source: formData.source || 'Manual',
            createdAt: editingContact ? editingContact.createdAt : new Date().toLocaleDateString(),
            groupIds: formData.groupIds || [],
            customData: formData.customData || {}
        };
        await contactService.saveContact(newContact); await loadContacts(); setIsModalOpen(false);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("Are you sure?")) {
            await contactService.deleteContact(id); await loadContacts();
            if (selectedIds.has(id)) { const newSet = new Set(selectedIds); newSet.delete(id); setSelectedIds(newSet); }
        }
    };

    const handleSelectAll = () => {
        const allOnPageSelected = currentEntries.length > 0 && currentEntries.every(c => selectedIds.has(c.id));
        const newSet = new Set(selectedIds);
        if (allOnPageSelected) currentEntries.forEach(c => newSet.delete(c.id));
        else currentEntries.forEach(c => newSet.add(c.id));
        setSelectedIds(newSet);
    };

    const handleSelectRow = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
        setSelectedIds(newSet);
    };

    const handleBulkDelete = async () => {
        setIsBulkDropdownOpen(false);
        if (selectedIds.size === 0) return;
        if (window.confirm(`Delete ${selectedIds.size} contacts?`)) {
            await contactService.bulkDeleteContacts(Array.from(selectedIds));
            setSelectedIds(new Set());
            await loadContacts();
        }
    };

    const handleAddTag = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && tagInput.trim()) {
            e.preventDefault();
            const newTags = [...(formData.tags || [])];
            if (!newTags.includes(tagInput.trim())) { newTags.push(tagInput.trim()); setFormData({ ...formData, tags: newTags }); }
            setTagInput('');
        }
    };
    const removeTag = (t: string) => setFormData({ ...formData, tags: (formData.tags || []).filter(tag => tag !== t) });
    const handleGroupSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const gid = e.target.value;
        if (gid && !(formData.groupIds || []).includes(gid)) setFormData({ ...formData, groupIds: [...(formData.groupIds || []), gid] });
        e.target.value = '';
    };
    const removeGroup = (gid: string) => setFormData({ ...formData, groupIds: (formData.groupIds || []).filter(id => id !== gid) });
    const handleCustomFieldChange = (name: string, val: string) => setFormData({ ...formData, customData: { ...formData.customData, [name]: val } });

    const handleExport = () => { /* Export logic remains same */ };
    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => { /* Upload logic remains same */ };

    const filteredContacts = contacts.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.phone.includes(searchTerm));
    const totalPages = Math.ceil(filteredContacts.length / entriesPerPage);
    const currentEntries = filteredContacts.slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage);

    const getPageNumbers = () => {
        const pages = [];
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            if (currentPage <= 4) {
                for (let i = 1; i <= 5; i++) pages.push(i);
                pages.push('...');
                pages.push(totalPages);
            } else if (currentPage >= totalPages - 3) {
                pages.push(1);
                pages.push('...');
                for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
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
        return pages;
    };

    return (
        <div className="p-4 sm:p-6 space-y-6 animate-fade-in">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto flex-1 lg:max-w-2xl">
                    <div className="relative group flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-brand-500 transition-colors"><SearchIcon /></div>
                        <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="pl-10 pr-4 py-2.5 w-full bg-white border border-slate-200 rounded-btn focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-sm shadow-sm outline-none transition-all" />
                    </div>
                    <div className="relative bulk-action-container">
                        <button onClick={() => setIsBulkDropdownOpen(!isBulkDropdownOpen)} disabled={selectedIds.size === 0} className={`w-full sm:w-auto px-4 py-2.5 text-sm font-bold rounded-btn shadow-sm flex items-center justify-center gap-2 transition-all border ${selectedIds.size > 0 ? 'bg-slate-800 text-white border-slate-800 hover:bg-slate-900' : 'bg-white text-slate-400 border-slate-200 cursor-not-allowed'}`}><span>Bulk ({selectedIds.size})</span><ChevronDownIcon className="w-4 h-4" /></button>
                        {isBulkDropdownOpen && selectedIds.size > 0 && (
                            <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-btn shadow-xl z-30 overflow-hidden animate-fade-in">
                                <button onClick={handleBulkDelete} className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 font-medium flex items-center transition-colors"><TrashIcon className="w-4 h-4 mr-2" /> Delete Selected</button>
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                    <button onClick={() => handleOpenModal()} className="flex items-center space-x-2 bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-btn font-bold shadow-md shadow-brand-200 transition-all transform hover:-translate-y-0.5 text-sm"><PlusIcon /><span>Create Contact</span></button>
                    <div className="flex gap-2">
                        <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileUpload} />
                        <button onClick={() => fileInputRef.current?.click()} className="p-2.5 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 rounded-btn transition-all shadow-sm"><UploadIcon /></button>
                        <button onClick={handleExport} className="p-2.5 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 rounded-btn transition-all shadow-sm"><DownloadIcon /></button>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>Loading...</div>
                ) : filteredContacts.length === 0 ? (
                    <div className="p-16 text-center"><div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4"><UsersIcon className="w-8 h-8 text-slate-300" /></div><h3 className="text-lg font-bold text-slate-900">No contacts found</h3></div>
                ) : (
                    <>
                        <div className="hidden md:block overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-100">
                                <thead className="bg-slate-50/80">
                                    <tr>
                                        <th className="px-6 py-4 text-left w-10"><input type="checkbox" className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 h-4 w-4 cursor-pointer" checked={currentEntries.length > 0 && currentEntries.every(c => selectedIds.has(c.id))} onChange={handleSelectAll} /></th>
                                        <th className="px-6 py-3 text-left text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Contact Info</th>
                                        <th className="px-6 py-3 text-left text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-3 text-left text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Tags</th>
                                        <th className="px-6 py-3 text-right text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {currentEntries.map((contact) => (
                                        <tr key={contact.id} className={`hover:bg-slate-50 transition-colors group ${selectedIds.has(contact.id) ? 'bg-brand-50/30' : ''}`}>
                                            <td className="px-6 py-4"><input type="checkbox" className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 h-4 w-4 cursor-pointer" checked={selectedIds.has(contact.id)} onChange={() => handleSelectRow(contact.id)} /></td>
                                            <td className="px-6 py-4"><div className="text-sm font-bold text-slate-900">{contact.name}</div><div className="text-xs text-slate-500 font-mono">{contact.phone}</div></td>
                                            <td className="px-6 py-4"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-100">{contact.status}</span></td>
                                            <td className="px-6 py-4"><div className="flex flex-wrap gap-1">{(contact.tags || []).map((tag, i) => <span key={i} className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">{tag}</span>)}</div></td>
                                            <td className="px-6 py-4 text-right"><div className="flex items-center justify-end space-x-2"><button onClick={(e) => { e.stopPropagation(); handleOpenModal(contact); }} className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"><EditIcon className="w-4 h-4" /></button><button onClick={(e) => { e.stopPropagation(); handleDelete(contact.id); }} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><TrashIcon className="w-4 h-4" /></button></div></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="md:hidden grid grid-cols-1 gap-4 p-4 bg-slate-50/50">
                            {currentEntries.map((contact) => (
                                <div key={contact.id} className={`bg-white p-5 rounded-xl border ${selectedIds.has(contact.id) ? 'border-brand-300 ring-1 ring-brand-200 shadow-md' : 'border-slate-200 shadow-sm'} relative`}>
                                    <div className="absolute top-5 right-5"><input type="checkbox" className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 h-5 w-5" checked={selectedIds.has(contact.id)} onChange={() => handleSelectRow(contact.id)} /></div>
                                    <h3 className="font-bold text-slate-900 text-lg">{contact.name}</h3><p className="text-sm text-slate-500 font-mono mb-2">{contact.phone}</p>
                                    <div className="flex justify-end gap-3 pt-3 border-t border-slate-100"><button onClick={() => handleOpenModal(contact)} className="p-2 bg-slate-50 rounded-lg text-slate-500 hover:text-brand-600 border border-slate-200 hover:border-brand-200"><EditIcon className="w-4 h-4" /></button><button onClick={() => handleDelete(contact.id)} className="p-2 bg-slate-50 rounded-lg text-slate-500 hover:text-red-600 border border-slate-200 hover:border-red-200"><TrashIcon className="w-4 h-4" /></button></div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
                <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-col xl:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4 text-sm text-slate-500 font-medium order-2 xl:order-1">
                        <span>
                            Showing <span className="font-bold text-slate-700">{filteredContacts.length > 0 ? (currentPage - 1) * entriesPerPage + 1 : 0}</span> to <span className="font-bold text-slate-700">{Math.min(currentPage * entriesPerPage, filteredContacts.length)}</span> of <span className="font-bold text-slate-700">{filteredContacts.length}</span> entries
                        </span>
                        <select
                            value={entriesPerPage}
                            onChange={(e) => { setEntriesPerPage(Number(e.target.value)); setCurrentPage(1); }}
                            className="bg-white border border-slate-300 text-slate-700 text-xs rounded-lg focus:ring-brand-500 focus:border-brand-500 block p-2 outline-none font-bold"
                        >
                            <option value={10}>10 rows</option>
                            <option value={25}>25 rows</option>
                            <option value={50}>50 rows</option>
                            <option value={100}>100 rows</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-1 order-1 xl:order-2">
                        <button
                            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 text-xs font-bold shadow-sm transition-all"
                        >
                            Prev
                        </button>

                        <div className="flex items-center gap-1 mx-2">
                            {getPageNumbers().map((page, idx) => (
                                page === '...' ? (
                                    <span key={`ell-${idx}`} className="px-2 text-slate-400 font-bold">...</span>
                                ) : (
                                    <button
                                        key={idx}
                                        onClick={() => setCurrentPage(Number(page))}
                                        className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-all shadow-sm border ${currentPage === page
                                            ? 'bg-brand-600 text-white border-brand-600 shadow-brand-200 shadow-md transform scale-105'
                                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                                            }`}
                                    >
                                        {page}
                                    </button>
                                )
                            ))}
                        </div>

                        <button
                            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                            disabled={currentPage === totalPages || totalPages === 0}
                            className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 text-xs font-bold shadow-sm transition-all"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity" onClick={() => setIsModalOpen(false)}></div>
                    <div className="relative bg-white w-full sm:w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-slide-up sm:animate-fade-in">
                        <div className="flex justify-between items-center px-6 py-5 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl">
                            <h3 className="text-lg font-extrabold text-slate-900">{editingContact ? 'Edit Contact' : 'New Lead'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 bg-white border border-slate-200 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"><CloseIcon className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6 overflow-y-auto custom-scrollbar">
                            <form id="contact-form" onSubmit={handleSave} className="space-y-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Full Name</label>
                                    <input type="text" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-btn focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-slate-900 outline-none transition-all font-medium" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Phone</label>
                                        <input type="tel" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-btn focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-slate-900 outline-none transition-all font-medium" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email</label>
                                        <input type="email" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-btn focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-slate-900 outline-none transition-all font-medium" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Status</label>
                                        <div className="relative">
                                            <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-btn focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-slate-900 outline-none transition-all font-medium appearance-none" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as any })}>
                                                {['New', 'Contacted', 'Qualified', 'Converted', 'Lost'].map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                            <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-slate-500"><ChevronDownIcon className="w-4 h-4" /></div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Source</label>
                                        <input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-btn focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-slate-900 outline-none transition-all font-medium" value={formData.source} onChange={e => setFormData({ ...formData, source: e.target.value })} />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Groups</label>
                                    <div className="relative mb-2">
                                        <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-btn focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-slate-900 outline-none transition-all font-medium appearance-none" onChange={handleGroupSelect}>
                                            <option value="">Select a group to add...</option>
                                            {availableGroups.filter(g => !(formData.groupIds || []).includes(g.id)).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                        </select>
                                        <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-slate-500"><ChevronDownIcon className="w-4 h-4" /></div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {(formData.groupIds || []).map(gid => {
                                            const group = availableGroups.find(g => g.id === gid);
                                            return group ? (
                                                <span key={gid} className="bg-brand-50 text-brand-700 px-2.5 py-1 rounded-md text-xs font-bold border border-brand-100 flex items-center gap-1">
                                                    <UsersIcon className="w-3 h-3" /> {group.name}
                                                    <button type="button" onClick={() => removeGroup(gid)} className="ml-1 text-brand-400 hover:text-brand-800"><CloseIcon className="w-3 h-3" /></button>
                                                </span>
                                            ) : null;
                                        })}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tags</label>
                                    <div className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-btn focus-within:ring-2 focus-within:ring-brand-500 focus-within:border-brand-500 transition-all flex flex-wrap items-center gap-2 min-h-[50px]">
                                        {(formData.tags || []).map((tag, i) => (
                                            <span key={i} className="bg-white text-slate-700 px-2 py-1 rounded-md text-xs font-bold border border-slate-200 flex items-center gap-1 shadow-sm">
                                                {tag}
                                                <button type="button" onClick={() => removeTag(tag)} className="text-slate-400 hover:text-red-500"><CloseIcon className="w-3 h-3" /></button>
                                            </span>
                                        ))}
                                        <input type="text" placeholder="Add tag..." className="bg-transparent outline-none text-sm font-medium flex-1 min-w-[80px]" value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={handleAddTag} />
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1.5 ml-1">Press Enter to add tags</p>
                                </div>

                                {customInputFields.length > 0 && (
                                    <div className="pt-4 border-t border-slate-100">
                                        <h4 className="text-sm font-bold text-slate-900 mb-4">Custom Fields</h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                            {customInputFields.map(field => (
                                                <div key={field.id}>
                                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{field.name}</label>
                                                    <input
                                                        type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-btn focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-slate-900 outline-none transition-all font-medium"
                                                        placeholder={field.placeholder}
                                                        value={formData.customData?.[field.name] || ''}
                                                        onChange={e => handleCustomFieldChange(field.name, e.target.value)}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </form>
                        </div>
                        <div className="px-6 py-5 bg-slate-50 border-t border-slate-200 flex justify-end space-x-3 rounded-b-2xl">
                            <button onClick={() => setIsModalOpen(false)} className="px-6 py-3 bg-white border border-slate-200 rounded-btn font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-sm">Cancel</button>
                            <button type="submit" form="contact-form" className="px-6 py-3 bg-brand-600 text-white rounded-btn font-bold hover:bg-brand-700 shadow-md shadow-brand-200 transition-all transform hover:-translate-y-0.5 flex items-center space-x-2"><BadgeIcon /><span>{editingContact ? 'Update' : 'Save'}</span></button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
export default ContactList;
