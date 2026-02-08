
import React, { useState, useEffect, useRef, useMemo } from 'react';
import ContactEditModal from './ContactEditModal';
import { contactService } from '../services/contactService';
import { contactGroupService } from '../services/contactGroupService';
import { inputFieldService } from '../services/inputFieldService';
import { Contact, ContactGroup, InputField } from '../types';
import { tagService, Tag } from '../services/tagService';
import {
    PlusIcon, EditIcon, TrashIcon, SearchIcon, UploadIcon, DownloadIcon,
    CloseIcon, BadgeIcon, ChevronDownIcon, UsersIcon, CheckIcon, BriefcaseIcon, GmailIcon, PhoneIcon
} from './icons';
import Papa from 'papaparse';
import Toast from './Toast';
import { countries } from '../utils/countries';

interface ContactListProps {
    initialGroupFilter?: string | null;
    onClearGroupFilter?: () => void;
    onContactCountUpdate?: (count: number) => void;
}

const ContactList: React.FC<ContactListProps> = ({ initialGroupFilter, onClearGroupFilter, onContactCountUpdate }) => {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [entriesPerPage, setEntriesPerPage] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);

    // Sync count with parent
    useEffect(() => {
        if (onContactCountUpdate) {
            onContactCountUpdate(contacts.length);
        }
    }, [contacts, onContactCountUpdate]); // Dependencies

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    // ... (rest of the component)


    const [availableGroups, setAvailableGroups] = useState<ContactGroup[]>([]);
    const [allTags, setAllTags] = useState<Tag[]>([]);
    const [customInputFields, setCustomInputFields] = useState<InputField[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isBulkDropdownOpen, setIsBulkDropdownOpen] = useState(false);

    // Toast State
    const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info' | 'warning'; title: string; message: string } | null>(null);

    // Create a map for fast color lookup
    const tagColorMap = useMemo(() => {
        return allTags.reduce((acc, tag) => {
            acc[tag.name] = tag.color || '#10b981'; // Default to green
            return acc;
        }, {} as Record<string, string>);
    }, [allTags]);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingContact, setEditingContact] = useState<Contact | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Delete Modal State
    const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; type: 'single' | 'bulk'; id?: string; count?: number }>({ isOpen: false, type: 'single' });



    // Filter State
    const [selectedGroupFilter, setSelectedGroupFilter] = useState<string | null>(null);
    const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);

    // Derived state
    const filteredContacts = contacts.filter(c => {
        // Search filter - search across all fields
        let matchesSearch = true;
        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            matchesSearch =
                (c.name || '').toLowerCase().includes(search) ||
                (c.phone || '').includes(search) ||
                (c.email && c.email.toLowerCase().includes(search)) ||
                (c.status && c.status.toLowerCase().includes(search)) ||
                (c.source && c.source.toLowerCase().includes(search)) ||
                (c.tags || []).some(tag => (tag || '').toLowerCase().includes(search)) ||
                (c.groupIds || []).some(gid => {
                    const group = availableGroups.find(g => g.id === gid);
                    return group && group.name.toLowerCase().includes(search);
                }) ||
                Object.values(c.customData || {}).some(val =>
                    String(val || '').toLowerCase().includes(search)
                );
        }

        // Group filter
        const matchesGroup = !selectedGroupFilter || (c.groupIds || []).includes(selectedGroupFilter);

        // Tag filter
        const matchesTag = !selectedTagFilter || (c.tags || []).includes(selectedTagFilter);

        return matchesSearch && matchesGroup && matchesTag;
    });
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

    const availableTags = useMemo(() => {
        const tags = new Set<string>();
        // Add existing tags from contacts
        contacts.forEach(c => (c.tags || []).forEach(t => tags.add(t)));
        // Add tags from database
        allTags.forEach(t => tags.add(t.name));
        return Array.from(tags).sort();
    }, [contacts, allTags]);

    useEffect(() => {
        // Small delay to ensure session is fully established after sign-in
        const timer = setTimeout(() => {
            loadInitialData();
        }, 150);

        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isBulkDropdownOpen && !(event.target as Element).closest('.bulk-action-container')) setIsBulkDropdownOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isBulkDropdownOpen]);

    useEffect(() => {
        if (initialGroupFilter) {
            setSelectedGroupFilter(initialGroupFilter);
        }
    }, [initialGroupFilter]);

    const loadInitialData = async () => {
        setIsLoading(true);
        try {
            const [contactsData, groupsData, inputsData, tagsData] = await Promise.all([
                contactService.getContacts(),
                contactGroupService.getGroups(),
                inputFieldService.getInputs(),
                tagService.getTags()
            ]);
            setContacts(contactsData || []);
            setAvailableGroups(groupsData || []);
            setCustomInputFields(inputsData || []);
            setAllTags(tagsData || []);
        } catch (e) {
            console.error("Error loading data", e);
        } finally {
            setIsLoading(false);
        }
    };

    const loadContacts = async () => {
        const data = await contactService.getContacts();
        setContacts(data || []);
    };


    // ... (existing imports, but this replace block targets the implementation inside the component mostly)





    const handleDelete = (id: string) => {
        setDeleteModal({ isOpen: true, type: 'single', id });
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

    const handleBulkDelete = () => {
        setIsBulkDropdownOpen(false);
        if (selectedIds.size === 0) return;
        setDeleteModal({ isOpen: true, type: 'bulk', count: selectedIds.size });
    };

    const proceedDelete = async () => {
        setIsLoading(true);
        try {
            // Contextual Delete: If filtering by group, just remove from that group
            if (selectedGroupFilter) {
                const groupName = availableGroups.find(g => g.id === selectedGroupFilter)?.name || 'Group';

                if (deleteModal.type === 'single' && deleteModal.id) {
                    const contact = contacts.find(c => c.id === deleteModal.id);
                    if (contact) {
                        const newGroupIds = (contact.groupIds || []).filter(gid => gid !== selectedGroupFilter);
                        // Update contact with new group list
                        await contactService.saveContact({ ...contact, groupIds: newGroupIds });
                        setToast({ type: 'success', title: 'Removed', message: `Removed from ${groupName}` });
                    }
                } else if (deleteModal.type === 'bulk') {
                    // Start parallel updates
                    const updates = contacts
                        .filter(c => selectedIds.has(c.id))
                        .map(c => {
                            const newGroupIds = (c.groupIds || []).filter(gid => gid !== selectedGroupFilter);
                            return contactService.saveContact({ ...c, groupIds: newGroupIds });
                        });

                    await Promise.all(updates);
                    setToast({ type: 'success', title: 'Removed', message: `Removed ${updates.length} contacts from ${groupName}` });
                    setSelectedIds(new Set());
                }
            }
            // Standard Delete: Delete from database
            else {
                if (deleteModal.type === 'single' && deleteModal.id) {
                    await contactService.deleteContact(deleteModal.id);
                    if (selectedIds.has(deleteModal.id)) {
                        const newSet = new Set(selectedIds);
                        newSet.delete(deleteModal.id);
                        setSelectedIds(newSet);
                    }
                    setToast({ type: 'success', title: 'Deleted', message: 'Contact deleted successfully' });
                } else if (deleteModal.type === 'bulk') {
                    await contactService.bulkDeleteContacts(Array.from(selectedIds));
                    setSelectedIds(new Set());
                    setToast({ type: 'success', title: 'Deleted', message: `${selectedIds.size} contacts deleted successfully` });
                }
            }

            await loadContacts();
        } catch (e) {
            console.error("Delete/Remove failed", e);
            setToast({ type: 'error', title: 'Error', message: 'Failed to process request' });
        } finally {
            setIsLoading(false);
            setDeleteModal({ isOpen: false, type: 'single' });
        }
    };

    const handleOpenModal = (contact?: Contact | null, phoneNumber?: string) => {
        setEditingContact(contact || null);
        setIsModalOpen(true);
    };

    const handleSave = () => {
        loadContacts();
        setIsModalOpen(false);
    };



    const handleExport = () => {
        if (contacts.length === 0) return;

        const csvData = contacts.map(c => {
            const groupNames = (c.groupIds || [])
                .map(gid => availableGroups.find(g => g.id === gid)?.name)
                .filter(Boolean)
                .join(', ');

            const row: any = {
                Name: c.name,
                Phone: c.phone,
                Email: c.email || '',
                Status: c.status,
                Tags: (c.tags || []).join(', '),
                Groups: groupNames,
                Source: c.source || ''
            };

            // Add custom fields
            customInputFields.forEach(field => {
                row[field.name] = c.customData?.[field.name] || '';
            });

            return row;
        });

        const csv = Papa.unparse(csvData);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'contacts_export.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                setIsLoading(true);
                const importedContacts: Partial<Contact>[] = [];

                try {
                    // 1. Refresh Metadata
                    let currentGroups = await contactGroupService.getGroups();
                    let currentFields = await inputFieldService.getInputs();
                    setAvailableGroups(currentGroups);
                    setCustomInputFields(currentFields);

                    // 2. Identify Custom Columns
                    const headers = results.meta.fields || [];
                    const standardHeaders = ['name', 'phone', 'email', 'status', 'tags', 'groups', 'source'];
                    const customHeaders = headers.filter(h => !standardHeaders.includes(h.toLowerCase()));

                    // 3. Auto-create missing Custom Fields
                    for (const header of customHeaders) {
                        const exists = currentFields.some(f => f.name.toLowerCase() === header.toLowerCase());
                        if (!exists) {
                            try {
                                const newField: InputField = {
                                    id: `inp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                    name: header,
                                    type: 'text',
                                    placeholder: `Enter ${header}`
                                };
                                const saved = await inputFieldService.saveInput(newField);
                                if (saved) currentFields.push(saved);
                                else currentFields.push(newField); // Fallback
                            } catch (err) {
                                console.error(`Failed to create field ${header}`, err);
                            }
                        }
                    }
                    setCustomInputFields([...currentFields]); // Update UI

                    // 4. Process Rows
                    for (const row of results.data as any[]) {
                        // Ensure phone is treated as string and exists
                        const phoneVal = row.Phone || row.phone;
                        if (!phoneVal) continue;

                        // Handle Groups
                        const groupNamesStr = row.Groups || row.groups || '';
                        const groupIds: string[] = [];

                        if (groupNamesStr) {
                            const names = groupNamesStr.split(',').map((n: string) => n.trim()).filter(Boolean);
                            for (const name of names) {
                                let group = currentGroups.find(g => g.name.toLowerCase() === name.toLowerCase());
                                if (!group) {
                                    try {
                                        const newGroup = {
                                            id: `grp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                            name: name,
                                            description: 'Imported',
                                            contactCount: 0,
                                            createdAt: new Date().toLocaleDateString(),
                                            status: 'Active' as const
                                        };
                                        const saved = await contactGroupService.saveGroup(newGroup);
                                        if (saved) {
                                            group = saved;
                                            currentGroups.push(saved);
                                        }
                                    } catch (err) {
                                        console.error(`Failed to create group ${name}`, err);
                                    }
                                }
                                if (group) groupIds.push(group.id);
                            }
                        }

                        // Handle Custom Data
                        const customData: Record<string, any> = {};
                        customHeaders.forEach(header => {
                            if (row[header]) {
                                customData[header] = row[header];
                            }
                        });

                        importedContacts.push({
                            name: row.Name || row.name || 'Unknown',
                            phone: String(phoneVal), // Ensure string
                            email: row.Email || row.email || '',
                            status: (row.Status || row.status || 'New') as any,
                            tags: row.Tags ? row.Tags.split(',').map((t: string) => t.trim()) : [],
                            groupIds: groupIds,
                            customData: customData,
                            source: 'Import'
                        });
                    }

                    console.log('📋 Parsed contacts from CSV:', importedContacts.length);
                    console.log('📄 Sample contact:', importedContacts[0]);

                    if (importedContacts.length > 0) {
                        console.log('🚀 Calling bulkCreateContacts...');
                        const result = await contactService.bulkCreateContacts(importedContacts);
                        await loadInitialData();

                        // Parse Stats
                        const stats = result?.stats || {};
                        const inserted = stats.inserted !== undefined ? stats.inserted : importedContacts.length;
                        const duplicates = stats.duplicates || 0;
                        const failed = stats.failed || 0;

                        setToast({
                            type: 'success',
                            title: 'Import Summary',
                            message: `Processed ${importedContacts.length} record(s):\n` +
                                `✅ Unique (Inserted): ${inserted}\n` +
                                `⚠️ Duplicates (Skipped): ${duplicates}\n` +
                                `❌ Failed to Insert: ${failed}\n\n` +
                                (failed > 0 ? `Check 'server/logs/contact_imports_DATE.log' for details on failed records.` : `All valid records were processed successfully.`)
                        });
                    } else {
                        setToast({
                            type: 'warning',
                            title: 'No Contacts Found',
                            message: "No valid contacts found in CSV.\n\nPlease ensure:\n• 'Phone' column exists\n• At least one row has data"
                        });
                    }
                } catch (err: any) {
                    console.error("Import Error", err);
                    let errorMessage = "";

                    if (err.message && (err.message.includes("JSON") || err.message.includes("404"))) {
                        errorMessage = "Server error occurred. Please check:\n\n" +
                            "1. Backend server is running on port 5000\n" +
                            "2. You are logged in (try signing out and back in)\n" +
                            "3. CSV format is correct\n\n" +
                            "Technical details: " + err.message;
                    } else {
                        errorMessage = err.message || "Unknown error occurred";
                    }

                    setToast({
                        type: 'error',
                        title: 'Import Failed',
                        message: errorMessage
                    });
                } finally {
                    setIsLoading(false);
                }
            },
            error: (error) => {
                console.error("CSV Parse Error", error);
                setToast({
                    type: 'error',
                    title: 'CSV Parse Error',
                    message: 'Failed to parse CSV file.\n\nPlease ensure:\n• File is a valid CSV\n• Columns are properly formatted\n• No special characters in headers'
                });
                setIsLoading(false);
            }
        });

        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="p-4 sm:p-6 space-y-6 animate-fade-in">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto flex-1 lg:max-w-2xl">
                    <div className="relative group flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--color-brand)] group-focus-within:text-[var(--color-brand)] transition-colors"><SearchIcon /></div>
                        <input type="text" placeholder="Search by name, phone, email, status, tags, groups..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="pl-10 pr-4 py-2.5 w-full bg-white border border-[var(--color-brand)] rounded-btn focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] text-sm shadow-sm outline-none transition-all placeholder:text-slate-400" />
                    </div>
                    <div className="relative bulk-action-container">
                        <button onClick={() => setIsBulkDropdownOpen(!isBulkDropdownOpen)} disabled={selectedIds.size === 0} className={`w-full sm:w-auto px-4 py-2.5 text-sm font-bold rounded-btn shadow-sm flex items-center justify-center gap-2 transition-all border ${selectedIds.size > 0 ? 'bg-[var(--color-brand)] text-white border-[var(--color-brand)] hover:opacity-90 shadow-md shadow-brand-200' : 'bg-[var(--color-brand)] text-white border-[var(--color-brand)] opacity-60 cursor-not-allowed'}`}><span>Bulk ({selectedIds.size})</span><ChevronDownIcon className="w-4 h-4" /></button>
                        {isBulkDropdownOpen && selectedIds.size > 0 && (
                            <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-btn shadow-xl z-30 overflow-hidden animate-fade-in">
                                <button onClick={handleBulkDelete} className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 font-medium flex items-center transition-colors"><TrashIcon className="w-4 h-4 mr-2" /> Delete Selected</button>
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                    <button onClick={() => handleOpenModal()} className="flex items-center space-x-2 bg-[var(--color-brand)] hover:opacity-90 text-white px-5 py-2.5 rounded-btn font-bold shadow-md shadow-brand-200 transition-all transform hover:-translate-y-0.5 text-sm"><PlusIcon /><span>Create Contact</span></button>
                    <div className="flex gap-2">
                        <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileUpload} />
                        <button onClick={() => fileInputRef.current?.click()} className="p-2.5 bg-[var(--color-brand)] text-white hover:opacity-90 rounded-btn transition-all shadow-md shadow-brand-200 font-bold"><UploadIcon /></button>
                        <button onClick={handleExport} className="p-2.5 bg-[var(--color-brand)] text-white hover:opacity-90 rounded-btn transition-all shadow-md shadow-brand-200 font-bold"><DownloadIcon /></button>
                    </div>
                </div>
            </div>

            {/* Active Filters */}
            {(selectedGroupFilter || selectedTagFilter) && (
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Filters:</span>
                    {selectedGroupFilter && (
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-brand-50 text-brand-700 rounded-lg text-xs font-bold border border-brand-200">
                            <UsersIcon className="w-3 h-3" />
                            {availableGroups.find(g => g.id === selectedGroupFilter)?.name || 'Group'}
                            <button
                                onClick={() => { setSelectedGroupFilter(null); setCurrentPage(1); }}
                                className="ml-1 hover:text-brand-900"
                            >
                                <CloseIcon className="w-3 h-3" />
                            </button>
                        </span>
                    )}
                    {selectedTagFilter && (
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold border border-slate-200">
                            <BadgeIcon className="w-3 h-3" />
                            {selectedTagFilter}
                            <button
                                onClick={() => { setSelectedTagFilter(null); setCurrentPage(1); }}
                                className="ml-1 hover:text-slate-900"
                            >
                                <CloseIcon className="w-3 h-3" />
                            </button>
                        </span>
                    )}
                    <button
                        onClick={() => { setSelectedGroupFilter(null); setSelectedTagFilter(null); setCurrentPage(1); }}
                        className="text-xs text-slate-500 hover:text-slate-700 font-medium underline"
                    >
                        Clear all
                    </button>
                </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {isLoading ? (<div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>Loading...</div>) : filteredContacts.length === 0 ? (<div className="p-16 text-center"><div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4"><UsersIcon className="w-8 h-8 text-slate-300" /></div><h3 className="text-lg font-bold text-slate-900">No contacts found</h3></div>) : (
                    <>
                        <div className="hidden md:block overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-200">
                                <thead className="bg-brand-600 text-white shadow-md">
                                    <tr>
                                        <th className="px-6 py-4 text-left w-10 !bg-brand-600 text-white">
                                            <input type="checkbox" className="rounded border-brand-300 text-brand-600 focus:ring-brand-500 h-4 w-4 cursor-pointer" checked={currentEntries.length > 0 && currentEntries.every(c => selectedIds.has(c.id))} onChange={handleSelectAll} />
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Name</th>
                                        <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Phone</th>
                                        <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Email</th>
                                        <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Created</th>
                                        <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Status</th>
                                        <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Tags</th>
                                        <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Groups</th>
                                        <th className="px-6 py-4 text-right text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {currentEntries.map((contact, idx) => {
                                        // Dynamic Status Colors
                                        const statusColors: any = {
                                            'new': 'bg-blue-100 text-blue-700 border-blue-200',
                                            'contacted': 'bg-amber-100 text-amber-700 border-amber-200',
                                            'qualified': 'bg-emerald-100 text-emerald-700 border-emerald-200',
                                            'won': 'bg-green-100 text-green-700 border-green-200',
                                            'lost': 'bg-red-100 text-red-700 border-red-200',
                                            'active': 'bg-teal-100 text-teal-700 border-teal-200',
                                            'inactive': 'bg-slate-100 text-slate-700 border-slate-200'
                                        };
                                        const sLower = (contact.status || '').toLowerCase();
                                        const sColor = statusColors[sLower] || 'bg-violet-100 text-violet-700 border-violet-200';

                                        return (
                                            <tr key={contact.id} className={`hover:bg-indigo-50/40 transition-colors group ${selectedIds.has(contact.id) ? 'bg-indigo-50' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                                                <td className="px-6 py-4">
                                                    <input type="checkbox" className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 h-4 w-4 cursor-pointer" checked={selectedIds.has(contact.id)} onChange={() => handleSelectRow(contact.id)} />
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-full bg-[var(--color-brand)] flex items-center justify-center text-white font-bold text-sm shadow-sm uppercase">
                                                            {(contact.name || '?').charAt(0)}
                                                        </div>
                                                        <div className="text-sm font-bold text-slate-800">{contact.name}</div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <PhoneIcon className="w-4 h-4 text-[var(--color-brand)] opacity-80" />
                                                        <div className="text-xs font-bold text-slate-600 font-mono tracking-wide">{contact.phone}</div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <GmailIcon className="w-4 h-4 text-[var(--color-brand)] opacity-80" />
                                                        <div className="text-xs font-medium text-slate-600">{contact.email || '-'}</div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-xs font-bold text-slate-500 whitespace-nowrap">{formatDate(contact.createdAt)}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wide border shadow-sm ${sColor}`}>
                                                        {contact.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {(contact.tags || []).map((tag, i) => (
                                                            <button key={i} onClick={() => { setSelectedTagFilter(tag); setCurrentPage(1); }} className="px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all hover:scale-105 shadow-sm bg-brand-50 text-brand-700 border-brand-200">
                                                                {tag}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {(contact.groupIds || []).slice(0, 2).map(gid => {
                                                            const g = availableGroups.find(grp => grp.id === gid);
                                                            return g ? <button key={gid} onClick={() => { setSelectedGroupFilter(gid); setCurrentPage(1); }} className="px-2 py-1 rounded-md text-[10px] font-bold bg-fuchsia-100 text-slate-900 border border-fuchsia-300 hover:bg-fuchsia-200 transition-colors shadow-sm">{g.name}</button> : null;
                                                        })}
                                                        {(contact.groupIds?.length || 0) > 2 && (
                                                            <span className="px-1.5 py-0.5 text-[10px] font-bold text-slate-400 bg-slate-100 rounded-md">+{contact.groupIds!.length - 2}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={(e) => { e.stopPropagation(); handleOpenModal(contact); }} className="p-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-200 shadow-sm"><EditIcon className="w-4 h-4" /></button>
                                                        <button onClick={(e) => { e.stopPropagation(); handleDelete(contact.id); }} className="p-2 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors border border-rose-200 shadow-sm"><TrashIcon className="w-4 h-4" /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="md:hidden grid grid-cols-1 gap-4 p-4 bg-slate-50/50">{currentEntries.map((contact) => (<div key={contact.id} className={`bg-white p-5 rounded-xl border ${selectedIds.has(contact.id) ? 'border-brand-300 ring-1 ring-brand-200 shadow-md' : 'border-slate-200 shadow-sm'} relative`}><div className="absolute top-5 right-5"><input type="checkbox" className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 h-5 w-5" checked={selectedIds.has(contact.id)} onChange={() => handleSelectRow(contact.id)} /></div><h3 className="font-bold text-slate-900 text-lg">{contact.name}</h3><p className="text-sm text-slate-500 font-mono">{contact.phone}</p>{contact.email && <p className="text-sm text-slate-500 mb-2">{contact.email}</p>}<div className="flex justify-end gap-3 pt-3 border-t border-slate-100"><button onClick={() => handleOpenModal(contact)} className="p-2 bg-slate-50 rounded-lg text-slate-500 hover:text-brand-600 border border-slate-200 hover:border-brand-200"><EditIcon className="w-4 h-4" /></button><button onClick={() => handleDelete(contact.id)} className="p-2 bg-slate-50 rounded-lg text-slate-500 hover:text-red-600 border border-slate-200 hover:border-red-200"><TrashIcon className="w-4 h-4" /></button></div></div>))}</div>
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

            {/* Contact Edit/Create Modal */}
            <ContactEditModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                contact={editingContact}
                onSave={loadInitialData}
            />

            {/* Delete Confirmation Modal */}
            {deleteModal.isOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100">
                        <div className="p-6">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 mx-auto ${selectedGroupFilter ? 'bg-amber-100' : 'bg-red-100'}`}>
                                <TrashIcon className={`w-6 h-6 ${selectedGroupFilter ? 'text-amber-600' : 'text-red-600'}`} />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 text-center mb-2">
                                {selectedGroupFilter
                                    ? (deleteModal.type === 'bulk' ? `Remove ${deleteModal.count} from Group?` : 'Remove from Group?')
                                    : (deleteModal.type === 'bulk' ? `Delete ${deleteModal.count} Contacts?` : 'Delete Contact?')
                                }
                            </h3>
                            <p className="text-slate-500 text-center mb-6 text-sm">
                                {selectedGroupFilter
                                    ? (deleteModal.type === 'bulk'
                                        ? "Are you sure you want to remove the selected contacts from this group? They will remain in your main contact list."
                                        : "Are you sure you want to remove this contact from this group? It will remain in your main contact list.")
                                    : (deleteModal.type === 'bulk'
                                        ? "Are you sure you want to delete the selected contacts? This action cannot be undone."
                                        : "Are you sure you want to delete this contact? This action cannot be undone.")
                                }
                            </p>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setDeleteModal({ isOpen: false, type: 'single' })}
                                    className="flex-1 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={proceedDelete}
                                    className={`flex-1 px-4 py-2.5 text-white font-bold rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2 ${selectedGroupFilter ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-200' : 'bg-red-600 hover:bg-red-700 shadow-red-200'}`}
                                    disabled={isLoading}
                                >
                                    {isLoading ? 'Processing...' : (selectedGroupFilter ? 'Remove' : 'Delete')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast Notification */}
            {toast && (
                <div className="fixed bottom-4 right-4 z-[100] animate-fade-in-up">
                    <Toast
                        type={toast.type}
                        title={toast.title}
                        message={toast.message}
                        onClose={() => setToast(null)}
                    />
                </div>
            )}
        </div>
    );
};

export default ContactList;
