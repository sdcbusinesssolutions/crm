
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { contactService } from '../services/contactService';
import { contactGroupService } from '../services/contactGroupService';
import { inputFieldService } from '../services/inputFieldService';
import { Contact, ContactGroup, InputField } from '../types';
import { tagService, Tag } from '../services/tagService';
import { getPipelines, getPipelineStages, updateLead, createLead, getLeads } from '../services/lead-management-api';
import { Pipeline, PipelineStage } from '../types/lead-management';
import {
    PlusIcon, EditIcon, TrashIcon, SearchIcon, UploadIcon, DownloadIcon,
    CloseIcon, BadgeIcon, ChevronDownIcon, UsersIcon, CheckIcon, BriefcaseIcon, GmailIcon, PhoneIcon, CalendarIcon, EyeIcon, EyeOffIcon

} from './icons';
import Papa from 'papaparse';
import Toast from './Toast';
import { PermissionGate } from '../modules/teamStaff/components/PermissionGate';
import { usePermissions, ACCESS_TYPES } from '../modules/teamStaff/hooks/usePermissions';
import { countries } from '../utils/countries';
import LeadAssignment from '../modules/teamStaff/components/LeadAssignment';
import PipelineAssignment from '../modules/teamStaff/components/PipelineAssignment';

interface ContactListProps {
    initialGroupFilter?: string | null;
    onClearGroupFilter?: () => void;
    onContactCountUpdate?: (count: number) => void;
}

const ContactList: React.FC<ContactListProps> = ({ initialGroupFilter, onClearGroupFilter, onContactCountUpdate }) => {
    const { hasAccess } = usePermissions();
    const canRead = hasAccess('Contact List', ACCESS_TYPES.READ);
    const canWrite = hasAccess('Contact List', ACCESS_TYPES.READ_WRITE);
    const canDelete = hasAccess('Contact List', ACCESS_TYPES.ALL_ACCESS);

    const [contacts, setContacts] = useState<Contact[]>([]);
    const [totalContacts, setTotalContacts] = useState(0); // Added for server-side pagination
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [entriesPerPage, setEntriesPerPage] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [isNumberMasked, setIsNumberMasked] = useState(true);

    const formatPhone = (phone: string | undefined | null) => {
        if (!phone) return '';
        if (!isNumberMasked) return phone;
        if (phone.length <= 4) return '****';
        return phone.substring(0, phone.length - 4).replace(/./g, '*') + phone.substring(phone.length - 4);
    };

    // Sync count with parent
    useEffect(() => {
        if (!canRead) return;
        if (onContactCountUpdate) {
            onContactCountUpdate(totalContacts);
        }
    }, [totalContacts, onContactCountUpdate, canRead]);

    if (!canRead) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 h-full p-8 text-center bg-slate-50">
                <div className="w-20 h-20 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-6 border border-red-100 text-red-500">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </div>
                <h2 className="text-2xl font-bold mb-2 text-slate-900">Access Denied</h2>
                <p className="max-w-md mx-auto text-slate-500">You do not have permission to view or manage the Contact List. Please contact your administrator if you believe this is an error.</p>
            </div>
        );
    }

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

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
    const [formData, setFormData] = useState<Partial<Contact>>({ name: '', phone: '', email: '', status: 'New', tags: [], source: 'Manual', groupIds: [], customData: {} });
    const [tagInput, setTagInput] = useState('');
    const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);

    // Delete Modal State
    const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; type: 'single' | 'bulk'; id?: string; count?: number }>({ isOpen: false, type: 'single' });

    // Pipeline State in Modal
    const [modalPipelines, setModalPipelines] = useState<Pipeline[]>([]);
    const [modalStages, setModalStages] = useState<PipelineStage[]>([]);
    const [modalPipelineId, setModalPipelineId] = useState<string>('');
    const [modalStageId, setModalStageId] = useState<string>('');
    const [existingLeadsForModal, setExistingLeadsForModal] = useState<any[]>([]);
    const [isPipelineLoading, setIsPipelineLoading] = useState(false);

    // Inline Creation State
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');

    const [isCreatingField, setIsCreatingField] = useState(false);
    const [newFieldName, setNewFieldName] = useState('');
    const [newFieldType, setNewFieldType] = useState('text');

    // Inline Field Editing State
    const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
    const [tempFieldName, setTempFieldName] = useState('');

    // Filter State
    const [selectedGroupFilter, setSelectedGroupFilter] = useState<string | null>(null);
    const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);

    // SERVER-SIDE FILTERING: We no longer filter in memory.
    // The 'contacts' state now only holds the current page of records.
    const totalPages = Math.ceil(totalContacts / entriesPerPage);
    const currentEntries = contacts; // The contacts array IS the current page now.

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
        // Add existing tags from currently loaded contacts
        contacts.forEach(c => (c.tags || []).forEach(t => tags.add(t)));
        // Add tags from database
        allTags.forEach(t => tags.add(t.name));
        return Array.from(tags).sort();
    }, [contacts, allTags]);

    useEffect(() => {
        if (!canRead) return;
        // Small delay to ensure session is fully established after sign-in
        const timer = setTimeout(() => {
            loadInitialData();
        }, 150);

        return () => clearTimeout(timer);
    }, [canRead]);

    // Effect to reload contacts when page or filters change
    useEffect(() => {
        if (canRead) {
            loadContacts();
        }
    }, [currentPage, entriesPerPage, searchTerm, selectedGroupFilter, selectedTagFilter, startDate, endDate, canRead]);

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
            const [groupsData, inputsData, tagsData] = await Promise.all([
                contactGroupService.getGroups(),
                inputFieldService.getInputs(),
                tagService.getTags()
            ]);
            setAvailableGroups(groupsData || []);
            setCustomInputFields(inputsData || []);
            setAllTags(tagsData || []);
            
            // Initial contacts load happens in the other useEffect
        } catch (e) {
            console.error("Error loading data", e);
        } finally {
            setIsLoading(false);
        }
    };

    const loadContacts = async () => {
        setIsLoading(true);
        try {
            const result = await contactService.getContactsPaginated(currentPage, entriesPerPage, {
                search: searchTerm,
                groupId: selectedGroupFilter || undefined,
                tag: selectedTagFilter || undefined,
                startDate,
                endDate
            });
            setContacts(result.data || []);
            setTotalContacts(result.total || 0);
        } catch (e) {
            console.error("Failed to load contacts", e);
        } finally {
            setIsLoading(false);
        }
    };


    // ... (existing imports, but this replace block targets the implementation inside the component mostly)

    const [countryCode, setCountryCode] = useState('+91');
    const [localPhone, setLocalPhone] = useState('');
    const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
    const [countrySearchTerm, setCountrySearchTerm] = useState('');

    useEffect(() => {
        if (isModalOpen) {
            const loadPipelinesData = async () => {
                setIsPipelineLoading(true);
                try {
                    const pData = await getPipelines();
                    setModalPipelines(pData);
                    
                    if (editingContact && editingContact.phone) {
                        const leadsRes: any = await getLeads(undefined, undefined, 1, 100, { search: editingContact.phone });
                        const leadsData = leadsRes?.data || leadsRes || [];
                        if (Array.isArray(leadsData) && leadsData.length > 0) {
                            setExistingLeadsForModal(leadsData);
                            // Set initial selection to the first pipeline if none selected
                            if (!modalPipelineId && leadsData[0].pipeline_id) {
                                setModalPipelineId(leadsData[0].pipeline_id);
                                setModalStageId(leadsData[0].stage_id);
                            }
                        }
                    }
                } catch (e) {
                    console.error('Error loading pipelines', e);
                } finally {
                    setIsPipelineLoading(false);
                }
            };
            loadPipelinesData();
        } else {
            setModalPipelineId('');
            setModalStageId('');
            setExistingLeadsForModal([]);
            setModalStages([]);
        }
    }, [isModalOpen, editingContact]);

    useEffect(() => {
        if (modalPipelineId) {
            getPipelineStages(modalPipelineId).then(setModalStages).catch(console.error);
            // Auto-select stage if this pipeline is already assigned
            const existingLead = existingLeadsForModal.find(l => l.pipeline_id === modalPipelineId);
            if (existingLead && existingLead.stage_id) {
                setModalStageId(existingLead.stage_id);
            }
        } else {
            setModalStages([]);
        }
    }, [modalPipelineId, existingLeadsForModal]);

    const handleOpenModal = (contact?: Contact) => {
        if (contact) {
            setEditingContact(contact);
            setFormData({ ...contact });

            const phone = contact.phone || '';
            // Try to match the longest country code first to avoid partial matches
            // (e.g. match +1242 (Bahamas) before +1 (US))

            // Sort countries by code length desc for detection
            const sortedCodes = [...countries].sort((a, b) => b.code.length - a.code.length);

            let matched = false;
            for (const c of sortedCodes) {
                const cleanCode = c.code.replace('+', '');
                if (phone.startsWith(cleanCode)) {
                    setCountryCode(c.code);
                    setLocalPhone(phone.substring(cleanCode.length));
                    matched = true;
                    break;
                }
            }

            if (!matched) {
                // formatting fallback
                setLocalPhone(phone);
                // default to +91 if no match found or just leave whatever default was
            }
        }
        else {
            setEditingContact(null);
            setFormData({ name: '', phone: '', email: '', status: 'New', tags: [], source: 'Manual', groupIds: [], customData: {} });
            setCountryCode('+91');
            setLocalPhone('');
        }
        setTagInput('');
        setIsCreatingGroup(false);
        setIsCreatingField(false);
        setEditingFieldId(null);
        setIsCountryDropdownOpen(false);
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate Phone
        if (localPhone.length !== 10) {
            alert('Please enter a valid 10-digit mobile number.');
            return;
        }

        const fullPhone = `${countryCode.replace('+', '')}${localPhone}`;
        let finalTags = [...(formData.tags || [])];

        // Auto-add pending tag input if it exists
        if (tagInput.trim()) {
            const newTag = tagInput.trim();
            if (!finalTags.includes(newTag)) {
                finalTags.push(newTag);
                // Also ensure it exists in backend
                if (!allTags.some(t => t.name === newTag)) {
                    try {
                        const savedTag = await tagService.saveTag({ name: newTag, color: '#10b981' });
                        setAllTags(prev => [...prev, savedTag]);
                    } catch (err) {
                        console.error("Failed to auto-create tag on save", err);
                    }
                }
            }
        }

        const newContact: Contact = {
            id: editingContact ? editingContact.id : `cnt-${Date.now()}`,
            name: formData.name || 'Unknown',
            phone: fullPhone,
            email: formData.email || '',
            status: (formData.status as any) || 'New',
            tags: finalTags,
            source: formData.source || 'Manual',
            createdAt: editingContact ? editingContact.createdAt : new Date().toLocaleDateString(),
            groupIds: formData.groupIds || [],
            customData: formData.customData || {}
        };
        try {
            await contactService.saveContact(newContact);

            // Save Lead Pipeline/Stage
            if (modalPipelineId && modalStageId) {
                const existingLead = existingLeadsForModal.find(l => l.pipeline_id === modalPipelineId);
                if (existingLead) {
                    await updateLead(existingLead.id, {
                        pipeline_id: modalPipelineId,
                        stage_id: modalStageId,
                        name: newContact.name,
                        email: newContact.email || '',
                        phone: newContact.phone
                    });
                } else {
                    await createLead({
                        name: newContact.name,
                        email: newContact.email || '',
                        phone: newContact.phone,
                        pipeline_id: modalPipelineId,
                        stage_id: modalStageId,
                        source: ((newContact.source || 'manual').toLowerCase() as any)
                    });
                }
            }

            setToast({ type: 'success', title: 'Success', message: 'Contact saved successfully!' });
            await loadContacts();
            setIsModalOpen(false);
        } catch (error: any) {
            console.error("Failed to save contact or assign lead to pipeline", error);
            setToast({ type: 'error', title: 'Error', message: error.message || 'Failed to save contact. Please try again.' });
        }
    };

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

    const handleDeleteAllFiltered = () => {
        setIsBulkDropdownOpen(false);
        if (totalContacts === 0) return;
        setDeleteModal({ isOpen: true, type: 'bulk', count: totalContacts, id: 'filtered' });
    };

    const handleDeleteEntireCRM = () => {
        setIsBulkDropdownOpen(false);
        if (totalContacts === 0) return;
        setDeleteModal({ isOpen: true, type: 'bulk', count: totalContacts, id: 'all' });
    };

    const proceedDelete = async () => {
        setIsLoading(true);
        try {
            // Contextual Delete: If filtering by group AND it's not a 'real delete all' from database
            if (selectedGroupFilter && deleteModal.id !== 'filtered' && deleteModal.id !== 'all') {
                const groupName = availableGroups.find(g => g.id === selectedGroupFilter)?.name || 'Group';

                if (deleteModal.type === 'single' && deleteModal.id) {
                    const contact = contacts.find(c => c.id === deleteModal.id);
                    if (contact) {
                        const newGroupIds = (contact.groupIds || []).filter(gid => gid !== selectedGroupFilter);
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
                    if (deleteModal.id === 'filtered') {
                        const count = await contactService.deleteFilteredContacts({
                            search: searchTerm,
                            groupId: selectedGroupFilter || undefined,
                            tag: selectedTagFilter || undefined,
                            startDate,
                            endDate
                        });
                        setToast({ type: 'success', title: 'Deleted', message: `${count} filtered contacts deleted` });
                    } else if (deleteModal.id === 'all') {
                        const count = await contactService.deleteAllContacts();
                        setToast({ type: 'success', title: 'CRM Wiped', message: `All ${count} contacts have been deleted` });
                    } else {
                        const idsToDelete = Array.from(selectedIds);
                        if (idsToDelete.length > 0) {
                            await contactService.bulkDeleteContacts(idsToDelete);
                            setToast({ type: 'success', title: 'Deleted', message: `${idsToDelete.length} contacts deleted` });
                        }
                    }
                    setSelectedIds(new Set());
                }
            }

            await loadContacts();
        } catch (e: any) {
            console.error("Delete/Remove failed", e);
            const errorMsg = e?.message || 'An unexpected error occurred';
            setToast({ type: 'error', title: 'Error', message: `Delete failed: ${errorMsg}` });
        } finally {
            setIsLoading(false);
            setDeleteModal({ isOpen: false, type: 'single' });
        }
    };

    // --- Logic for Tags ---
    const handleTagInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTagInput(e.target.value);
        setIsTagDropdownOpen(true);
    };

    const handleAddTag = async (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && tagInput.trim()) {
            e.preventDefault();
            await addTag(tagInput);
        }
    };

    const addTag = async (tag: string) => {
        const trimmed = tag.trim();
        if (!trimmed) return;

        // Check if tag exists globally, if not create it
        if (!allTags.some(t => t.name === trimmed)) {
            try {
                // Optimistically add to UI map logic if needed, but waiting is safer
                const savedTag = await tagService.saveTag({ name: trimmed, color: '#10b981' });
                setAllTags(prev => [...prev, savedTag]);
            } catch (err) {
                console.error("Failed to create new tag", err);
                // If it fails, we might still want to add it to the contact locally? 
                // Let's assume yes, so the user isn't blocked.
            }
        }

        const newTags = [...(formData.tags || [])];
        if (!newTags.includes(trimmed)) { setFormData(prev => ({ ...prev, tags: [...newTags, trimmed] })); }
        setTagInput(''); setIsTagDropdownOpen(false);
    };
    const removeTag = (t: string) => setFormData({ ...formData, tags: (formData.tags || []).filter(tag => tag !== t) });

    const handleGroupSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        if (val && !(formData.groupIds || []).includes(val)) setFormData({ ...formData, groupIds: [...(formData.groupIds || []), val] });
        e.target.value = '';
    };

    const handleCreateGroup = async () => {
        if (!newGroupName.trim()) return;
        const newGroup: ContactGroup = { id: `grp-${Date.now()}`, name: newGroupName.trim(), description: '', contactCount: 0, createdAt: new Date().toLocaleDateString(), status: 'Active' };

        try {
            const savedGroup = await contactGroupService.saveGroup(newGroup);

            if (savedGroup && savedGroup.id) {
                setAvailableGroups([...availableGroups, savedGroup]);
                setFormData({ ...formData, groupIds: [...(formData.groupIds || []), savedGroup.id] });
            } else {
                // Use fallback group locally if server fails (prevents crash)
                console.warn("Using local group due to server error");
                setAvailableGroups([...availableGroups, newGroup]);
                setFormData({ ...formData, groupIds: [...(formData.groupIds || []), newGroup.id] });
            }
        } catch (e) {
            console.error("Create group error", e);
        }

        setIsCreatingGroup(false); setNewGroupName('');
    };

    const removeGroup = (gid: string) => setFormData({ ...formData, groupIds: (formData.groupIds || []).filter(id => id !== gid) });

    const handleCustomFieldChange = (name: string, val: string) => {
        setFormData(prev => ({ ...prev, customData: { ...(prev.customData || {}), [name]: val } }));
    };

    const handleCreateField = async () => {
        if (!newFieldName.trim()) return;
        const tempField: InputField = { id: `inp-${Date.now()}`, name: newFieldName.trim(), type: newFieldType as any, placeholder: `Enter ${newFieldName}` };

        try {
            const savedField = await inputFieldService.saveInput(tempField);
            if (savedField && savedField.id) {
                setCustomInputFields([...customInputFields, savedField]);
            } else {
                setCustomInputFields([...customInputFields, tempField]);
            }
        } catch (e) {
            console.error("Create field error", e);
            setCustomInputFields([...customInputFields, tempField]);
        }

        setIsCreatingField(false); setNewFieldName('');
    };

    const handleStartEditField = (field: InputField) => { setEditingFieldId(field.id); setTempFieldName(field.name); };
    const handleCancelEditField = () => { setEditingFieldId(null); setTempFieldName(''); };
    const handleUpdateField = async (field: InputField) => {
        if (!tempFieldName.trim()) return;
        const newName = tempFieldName.trim();

        const updatedFieldData = { ...field, name: newName };
        await inputFieldService.saveInput(updatedFieldData);

        const updatedFields = await inputFieldService.getInputs();
        setCustomInputFields(updatedFields);
        // Migrate data
        if (field.name !== newName) {
            setFormData(prev => {
                const newData = { ...(prev.customData || {}) };
                if (newData[field.name] !== undefined) { newData[newName] = newData[field.name]; delete newData[field.name]; }
                return { ...prev, customData: newData };
            });
        }

        setEditingFieldId(null);
    };
    const handleDeleteFieldInline = async (id: string) => {
        if (window.confirm("Delete field?")) {
            await inputFieldService.deleteInput(id);
            setCustomInputFields(customInputFields.filter(f => f.id !== id));
        }
    };

    const handleExport = async () => {
        setIsLoading(true);
        try {
            // 1. Fetch ALL contacts matching filters for export
            const contactsToExport = await contactService.exportContacts({
                search: searchTerm,
                groupId: selectedGroupFilter || undefined,
                tag: selectedTagFilter || undefined,
                startDate,
                endDate
            });

            if (contactsToExport.length === 0) {
                setToast({ type: 'info', title: 'No Data', message: 'No contacts found to export.' });
                return;
            }

            // 2. If user has specifically selected IDs, filter the export list to those
            const finalData = selectedIds.size > 0 
                ? contactsToExport.filter(c => selectedIds.has(c.id))
                : contactsToExport;

            if (finalData.length === 0) return;

            // 3. Convert to CSV
            const csvData = finalData.map(c => {
                const groupNames = (c.groupIds || [])
                    .map(gid => availableGroups.find(g => g.id === gid)?.name)
                    .filter(Boolean)
                    .join(', ');

                const row: any = {
                    Name: c.name,
                    Phone: formatPhone(c.phone),
                    Email: c.email || '',
                    Status: c.status,
                    Tags: (c.tags || []).join(', '),
                    Groups: groupNames,
                    Pipelines: (c as any).pipelines_string || '',
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
            link.setAttribute('download', selectedIds.size > 0 ? 'selected_contacts.csv' : 'contacts_export.csv');
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (e) {
            console.error("Export failed", e);
            setToast({ type: 'error', title: 'Export Failed', message: 'Could not generate export file.' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                setIsLoading(true);
                const importedContacts: any[] = [];

                try {
                    // 1. Refresh Metadata
                    let currentGroups = await contactGroupService.getGroups();
                    let currentFields = await inputFieldService.getInputs();
                    let currentPipelines = await getPipelines();
                    let currentStages: Record<string, any[]> = {};
                    for (const p of currentPipelines) {
                        currentStages[p.id] = await getPipelineStages(p.id);
                    }

                    setAvailableGroups(currentGroups);
                    setCustomInputFields(currentFields);

                    // 2. Identify Custom Columns
                    const headers = results.meta.fields || [];
                    const standardHeaders = ['name', 'phone', 'email', 'status', 'tags', 'groups', 'pipelines', 'source'];
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
                    const seenPhones = new Set<string>();
                    let fileDuplicates = 0;

                    for (const row of results.data as any[]) {
                        // Ensure phone is treated as string and exists
                        const phoneVal = row.Phone || row.phone;
                        if (!phoneVal) continue;
                        
                        const phoneStr = String(phoneVal).trim();
                        if (seenPhones.has(phoneStr)) {
                            fileDuplicates++;
                            continue;
                        }
                        seenPhones.add(phoneStr);

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

                        // Handle Pipelines
                        const pipelinesStr = row.Pipelines || row.pipelines || '';
                        const importPipelines: { pipelineId: string, stageId: string }[] = [];

                        if (pipelinesStr) {
                            const entries = pipelinesStr.split('|').flatMap((n: string) => n.split(',')).map((n: string) => n.trim()).filter(Boolean);
                            for (const entry of entries) {
                                // Match: "Pipeline Name (Stage Name)" or just "Pipeline Name"
                                const match = entry.match(/^(.+?)(?:\s*\((.+?)\))?$/);
                                if (match) {
                                    const pName = match[1].trim();
                                    const sName = match[2] ? match[2].trim() : null;

                                    const pipeline = currentPipelines.find((p: any) => p.name.toLowerCase() === pName.toLowerCase());
                                    if (pipeline) {
                                        const pStages = currentStages[pipeline.id] || [];
                                        let stage = sName ? pStages.find((s: any) => s.name.toLowerCase() === sName.toLowerCase()) : pStages[0];
                                        if (!stage && pStages.length > 0) stage = pStages[0];

                                        if (stage) {
                                            importPipelines.push({ pipelineId: pipeline.id, stageId: stage.id });
                                        }
                                    }
                                }
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
                            importPipelines: importPipelines,
                            source: 'Import'
                        } as any);
                    }

                    console.log('📋 Parsed contacts from CSV:', importedContacts.length);
                    if (fileDuplicates > 0) {
                        console.log(`⚠️ Found ${fileDuplicates} duplicate phone numbers within the CSV file.`);
                    }
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
                        const totalDuplicates = fileDuplicates + duplicates;

                        setToast({
                            type: 'success',
                            title: 'Import Complete',
                            message: `We've finished processing your file. Here's a summary of the results:\n\n` +
                                `📦 Total Records: ${importedContacts.length + fileDuplicates}\n` +
                                `───────────────────────\n` +
                                `✅ New Contacts: ${inserted}\n` +
                                `🟡 Duplicates: ${totalDuplicates} (${fileDuplicates} in file, ${duplicates} in system)\n` +
                                `❌ Failed: ${failed}\n\n` +
                                (failed > 0 ? `Please check the server logs for details on the ${failed} failed records.` : `All records were processed successfully!`)
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
        <>
        <div className="p-4 sm:p-8 space-y-6 animate-fade-in">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3 flex-1 xl:flex-nowrap lg:max-w-none">
                    {/* Compact Search Bar */}
                    <div className="relative group w-full sm:w-64">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[var(--color-brand)] transition-colors">
                            <SearchIcon className="w-4 h-4" />
                        </div>
                        <input 
                            type="text" 
                            placeholder="Search contacts..." 
                            value={searchTerm} 
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} 
                            className="pl-9 pr-3 py-2 w-full bg-white border border-[var(--color-brand)] rounded-xl focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] text-sm shadow-sm outline-none transition-all placeholder:text-slate-400" 
                        />


                    </div>

                    {/* Group Filter */}
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <UsersIcon className="w-4 h-4" />
                        </div>
                        <select
                            value={selectedGroupFilter || ''}
                            onChange={(e) => { setSelectedGroupFilter(e.target.value || null); setCurrentPage(1); }}
                            className="pl-9 pr-8 py-2 w-full sm:w-40 bg-white border border-[var(--color-brand)] rounded-xl focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] text-sm shadow-sm outline-none transition-all appearance-none text-slate-600 font-medium cursor-pointer"
                        >
                            <option value="">All Groups</option>
                            {availableGroups.map(g => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-slate-500">
                            <ChevronDownIcon className="w-3 h-3" />
                        </div>
                    </div>

                    {/* Tag Filter */}
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <BadgeIcon className="w-4 h-4" />
                        </div>
                        <select
                            value={selectedTagFilter || ''}
                            onChange={(e) => { setSelectedTagFilter(e.target.value || null); setCurrentPage(1); }}
                            className="pl-9 pr-8 py-2 w-full sm:w-36 bg-white border border-[var(--color-brand)] rounded-xl focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] text-sm shadow-sm outline-none transition-all appearance-none text-slate-600 font-medium cursor-pointer"
                        >
                            <option value="">All Tags</option>
                            {availableTags.map(t => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-slate-500">
                            <ChevronDownIcon className="w-3 h-3" />
                        </div>
                    </div>
                    
                    {/* Proper Date Range Picker UI */}
                    <div className="flex items-center gap-2 p-1.5 bg-[var(--color-brand)]/[0.03] rounded-2xl border border-[var(--color-brand)]/20 shadow-inner">
                        <div className="flex items-center gap-2 bg-white border border-[var(--color-brand)] rounded-xl px-3 py-1.5 shadow-sm group focus-within:ring-2 focus-within:ring-[var(--color-brand)]/20 focus-within:border-[var(--color-brand)] transition-all">


                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-tight">From</span>
                            <input 
                                type="date" 
                                value={startDate} 
                                onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }} 
                                className="bg-transparent border-none text-xs font-bold focus:ring-0 p-0 outline-none w-[110px] text-slate-700 cursor-pointer"
                            />
                        </div>
                        <div className="w-3 h-px bg-[var(--color-brand)]/40"></div>
                        <div className="flex items-center gap-2 bg-white border border-[var(--color-brand)] rounded-xl px-3 py-1.5 shadow-sm group focus-within:ring-2 focus-within:ring-[var(--color-brand)]/20 focus-within:border-[var(--color-brand)] transition-all">


                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-tight">To</span>
                            <input 
                                type="date" 
                                value={endDate} 
                                onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }} 
                                className="bg-transparent border-none text-xs font-bold focus:ring-0 p-0 outline-none w-[110px] text-slate-700 cursor-pointer"
                            />
                        </div>
                    </div>

                    <div className="relative bulk-action-container">
                        <button 
                            onClick={() => setIsBulkDropdownOpen(!isBulkDropdownOpen)} 
                            disabled={contacts.length === 0}
                            className={`px-4 py-2 text-sm font-bold rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all border ${contacts.length > 0 ? 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50' : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'}`}
                        >
                            <span>Bulk Actions {selectedIds.size > 0 && `(${selectedIds.size})`}</span>
                            <ChevronDownIcon className="w-4 h-4" />
                        </button>
                        {isBulkDropdownOpen && (
                            <div className="absolute left-0 top-full mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-2xl z-30 overflow-hidden animate-fade-in py-1">
                                {/* Delete Selection */}
                                <PermissionGate moduleName="Contact+List" requiredAccess={ACCESS_TYPES.READ_WRITE}>
                                    <button 
                                        onClick={handleBulkDelete} 
                                        disabled={selectedIds.size === 0}
                                        className={`w-full text-left px-4 py-2.5 text-sm font-medium flex items-center transition-colors ${selectedIds.size > 0 ? 'text-red-600 hover:bg-red-50' : 'text-slate-300 cursor-not-allowed'}`}
                                    >
                                        <TrashIcon className="w-4 h-4 mr-2" /> Delete Selected ({selectedIds.size})
                                    </button>
                                </PermissionGate>

                                <div className="h-px bg-slate-100 my-1"></div>

                                {/* Delete by Filter (Contextual) */}
                                {(searchTerm || selectedGroupFilter || selectedTagFilter || startDate || endDate) && (
                                    <PermissionGate moduleName="Contact+List" requiredAccess={ACCESS_TYPES.READ_WRITE}>
                                        <button 
                                            onClick={handleDeleteAllFiltered}
                                            className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 font-medium flex items-center transition-colors"
                                        >
                                            <TrashIcon className="w-4 h-4 mr-2" /> 
                                            Delete All Matching Filters ({totalContacts})
                                        </button>
                                    </PermissionGate>
                                )}

                                {/* Clear CRM */}
                                <PermissionGate moduleName="Contact+List" requiredAccess={ACCESS_TYPES.ALL_ACCESS}>
                                    <button 
                                        onClick={handleDeleteEntireCRM}
                                        className="w-full text-left px-4 py-2.5 text-sm text-red-700 hover:bg-red-100 font-bold flex items-center transition-colors"
                                    >
                                        <TrashIcon className="w-4 h-4 mr-2" /> 
                                        Wipe Entire CRM ({totalContacts})
                                    </button>
                                </PermissionGate>

                                <div className="h-px bg-slate-100 my-1"></div>

                                <button 
                                    onClick={async () => {
                                        setIsLoading(true);
                                        try {
                                            // 1. Try to get ALL filtered numbers from server
                                            let numbers = await contactService.getFilteredPhones({
                                                search: searchTerm,
                                                groupId: selectedGroupFilter || undefined,
                                                tag: selectedTagFilter || undefined,
                                                startDate,
                                                endDate
                                            });

                                            // 2. Fallback to visible contacts if server returned nothing but we see contacts
                                            if (numbers.length === 0 && contacts.length > 0) {
                                                numbers = Array.from(new Set(contacts.map(c => c.phone).filter(Boolean)));
                                            }

                                            if (numbers.length === 0) {
                                                setToast({ type: 'warning', title: 'No Numbers', message: 'No phone numbers found to copy.' });
                                                return;
                                            }

                                            // 3. Format as comma-separated string
                                            const copyText = numbers.join(', ');
                                            
                                            // 4. Robust Copy
                                            if (navigator.clipboard && window.isSecureContext) {
                                                await navigator.clipboard.writeText(copyText);
                                            } else {
                                                // Fallback for non-secure contexts or older browsers
                                                const textArea = document.createElement("textarea");
                                                textArea.value = copyText;
                                                document.body.appendChild(textArea);
                                                textArea.focus();
                                                textArea.select();
                                                document.execCommand('copy');
                                                document.body.removeChild(textArea);
                                            }

                                            setToast({ type: 'success', title: 'Copied!', message: `${numbers.length} unique numbers copied to clipboard.` });
                                        } catch (e) {
                                            console.error("Copy failed", e);
                                            setToast({ type: 'error', title: 'Copy Failed', message: 'Could not copy numbers to clipboard.' });
                                        } finally {
                                            setIsLoading(false);
                                            setIsBulkDropdownOpen(false);
                                        }
                                    }}
                                    className="w-full text-left px-4 py-2.5 text-sm text-brand-600 hover:bg-brand-50 font-bold flex items-center transition-colors"
                                >
                                    <PhoneIcon className="w-4 h-4 mr-2" /> 
                                    Copy Filtered Numbers ({totalContacts})
                                </button>
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex flex-wrap gap-2 justify-end items-center">
                    {!canWrite && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 shadow-sm animate-fade-in select-none">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                            Read Only Mode
                        </span>
                    )}
                    <PermissionGate moduleName="Contact+List" requiredAccess={ACCESS_TYPES.READ_WRITE}>
                        <button onClick={() => handleOpenModal()} className="flex items-center space-x-2 bg-[var(--color-brand)] hover:opacity-90 text-white px-5 py-2.5 rounded-xl font-bold shadow-md transition-all transform hover:-translate-y-0.5 text-sm"><PlusIcon /><span>Create Contact</span></button>
                    </PermissionGate>
                    <div className="flex gap-2">
                        {hasAccess('can_unmask_numbers', ACCESS_TYPES.ALL_ACCESS) && (
                            <button onClick={() => setIsNumberMasked(!isNumberMasked)} className="p-2.5 bg-[var(--color-brand)] text-white hover:opacity-90 rounded-xl transition-all shadow-md font-bold" title={isNumberMasked ? "Show Numbers" : "Mask Numbers"}>
                                {isNumberMasked ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                            </button>
                        )}
                        <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileUpload} />
                        <PermissionGate moduleName="Contact+List" requiredAccess={ACCESS_TYPES.READ_WRITE}>
                            <button onClick={() => fileInputRef.current?.click()} className="p-2.5 bg-[var(--color-brand)] text-white hover:opacity-90 rounded-xl transition-all shadow-md font-bold" title="Import Contacts"><UploadIcon className="w-5 h-5" /></button>
                        </PermissionGate>
                        <PermissionGate moduleName="Contact+List" requiredAccess={ACCESS_TYPES.READ}>
                            <button onClick={handleExport} className="p-2.5 bg-[var(--color-brand)] text-white hover:opacity-90 rounded-xl transition-all shadow-md font-bold" title="Export Contacts"><DownloadIcon className="w-5 h-5" /></button>
                        </PermissionGate>
                    </div>
                </div>
            </div>

            {/* Active Filters */}
            {(selectedGroupFilter || selectedTagFilter || startDate || endDate) && (
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Filters:</span>
                    {startDate && (
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold border border-indigo-200">
                            From: {new Date(startDate).toLocaleDateString()}
                            <button onClick={() => { setStartDate(''); setCurrentPage(1); }} className="ml-1 hover:text-indigo-900"><CloseIcon className="w-3 h-3" /></button>
                        </span>
                    )}
                    {endDate && (
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold border border-indigo-200">
                            To: {new Date(endDate).toLocaleDateString()}
                            <button onClick={() => { setEndDate(''); setCurrentPage(1); }} className="ml-1 hover:text-indigo-900"><CloseIcon className="w-3 h-3" /></button>
                        </span>
                    )}

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
                        onClick={() => { setSelectedGroupFilter(null); setSelectedTagFilter(null); setStartDate(''); setEndDate(''); setCurrentPage(1); }}
                        className="text-xs text-slate-500 hover:text-slate-700 font-medium underline"
                    >
                        Clear all
                    </button>

                </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {isLoading ? (<div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>Loading...</div>) : totalContacts === 0 ? (<div className="p-16 text-center"><div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4"><UsersIcon className="w-8 h-8 text-slate-300" /></div><h3 className="text-lg font-bold text-slate-900">No contacts found</h3></div>) : (
                    <>
                        <div className="hidden md:block overflow-x-auto">
                            <table className="min-w-full border-collapse">
                                <thead className="bg-brand-600 text-white shadow-md">
                                    <tr>
                                        <th className="px-6 py-4 text-left w-10 !bg-brand-600 text-white">
                                            <input type="checkbox" className="rounded border-brand-300 text-brand-600 focus:ring-brand-500 h-4 w-4 cursor-pointer" checked={currentEntries.length > 0 && currentEntries.every(c => selectedIds.has(c.id))} onChange={handleSelectAll} />
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Name</th>
                                        <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Phone</th>
                                        <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Email</th>
                                        <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Created</th>
                                        <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Lead Status</th>
                                        <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Tags</th>
                                        <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Groups</th>
                                        <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Pipeline</th>
                                        <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Assigned To</th>
                                        <th className="px-6 py-4 text-right text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white">
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
                                                <td className="px-6 py-4 border-b !border-black">
                                                    <input type="checkbox" className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 h-4 w-4 cursor-pointer" checked={selectedIds.has(contact.id)} onChange={() => handleSelectRow(contact.id)} />
                                                </td>
                                                <td className="px-6 py-4 border-b !border-black">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-full bg-[var(--color-brand)] flex items-center justify-center text-white font-bold text-sm shadow-sm uppercase">
                                                            {(contact.name || '?').charAt(0)}
                                                        </div>
                                                        <div className="text-sm font-bold text-slate-800">{contact.name}</div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 border-b !border-black">
                                                    <div className="flex items-center gap-2">
                                                        <PhoneIcon className="w-4 h-4 text-[var(--color-brand)] opacity-80" />
                                                        <div className="text-xs font-bold text-slate-600 font-mono tracking-wide">{formatPhone(contact.phone)}</div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 border-b !border-black">
                                                    <div className="flex items-center gap-2">
                                                        <GmailIcon className="w-4 h-4 text-[var(--color-brand)] opacity-80" />
                                                        <div className="text-xs font-medium text-slate-600">{contact.email || '-'}</div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 border-b !border-black">
                                                    <div className="text-xs font-bold text-slate-500 whitespace-nowrap">{formatDate(contact.createdAt)}</div>
                                                </td>
                                                <td className="px-6 py-4 border-b !border-black">
                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wide border shadow-sm ${sColor}`}>
                                                        {contact.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 border-b !border-black">
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {(contact.tags || []).map((tag, i) => (
                                                            <button key={i} onClick={() => { setSelectedTagFilter(tag); setCurrentPage(1); }} className="px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all hover:scale-105 shadow-sm bg-brand-50 text-brand-700 border-brand-200">
                                                                {tag}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 border-b !border-black">
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
                                                <td className="px-6 py-4 border-b !border-black min-w-[150px]">
                                                    <PipelineAssignment 
                                                        leadId={undefined} 
                                                        contact={contact} 
                                                        onAssignmentComplete={() => loadContacts()}
                                                    />
                                                </td>
                                                <td className="px-6 py-4 border-b !border-black min-w-[200px]">
                                                    <LeadAssignment 
                                                        leadId={contact.id} 
                                                        contact={contact} 
                                                        showNames={false}
                                                        isContactId={true}
                                                        className="p-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 rounded-xl transition-all duration-300 shadow-sm hover:shadow-md hover:scale-110 active:scale-95 inline-block relative"
                                                    />
                                                </td>
                                                <td className="px-6 py-4 border-b !border-black">
                                                    <div className="flex items-center justify-end space-x-2 transition-opacity">
                                                        <PermissionGate moduleName="Contact+List" requiredAccess={ACCESS_TYPES.READ_WRITE}>
                                                            <button onClick={(e) => { e.stopPropagation(); handleOpenModal(contact); }} className="p-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-200 shadow-sm"><EditIcon className="w-4 h-4" /></button>
                                                        </PermissionGate>
                                                        <PermissionGate moduleName="Contact+List" requiredAccess={ACCESS_TYPES.READ_WRITE}>
                                                            <button onClick={(e) => { e.stopPropagation(); handleDelete(contact.id); }} className="p-2 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors border border-rose-200 shadow-sm"><TrashIcon className="w-4 h-4" /></button>
                                                        </PermissionGate>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="md:hidden grid grid-cols-1 gap-4 p-4 bg-slate-50/50">
    {currentEntries.map((contact) => (
        <div key={contact.id} className={`bg-white p-5 rounded-xl border ${selectedIds.has(contact.id) ? 'border-brand-300 ring-1 ring-brand-200 shadow-md' : 'border-slate-200 shadow-sm'} relative`}>
            <div className="absolute top-5 right-5">
                <input type="checkbox" className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 h-5 w-5" checked={selectedIds.has(contact.id)} onChange={() => handleSelectRow(contact.id)} />
            </div>
            <h3 className="font-bold text-slate-900 text-lg">{contact.name}</h3>
            <p className="text-sm text-slate-500 font-mono">{formatPhone(contact.phone)}</p>
            {contact.email && <p className="text-sm text-slate-500 mb-2">{contact.email}</p>}
            
            <div className="mt-4 pt-3 border-t border-slate-100">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Assigned Staff</label>
                <LeadAssignment 
                    leadId={contact.id} 
                    contact={contact} 
                    showNames={false}
                    isContactId={true}
                    className="p-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 rounded-xl transition-all duration-300 shadow-sm hover:shadow-md active:scale-95 inline-block relative"
                />
            </div>

            <div className="flex justify-end gap-3 pt-3 mt-2 border-t border-slate-100">
                <button onClick={() => handleOpenModal(contact)} className="p-2 bg-slate-50 rounded-lg text-slate-500 hover:text-brand-600 border border-slate-200 hover:border-brand-200">
                    <EditIcon className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(contact.id)} className="p-2 bg-slate-50 rounded-lg text-slate-500 hover:text-red-600 border border-slate-200 hover:border-red-200">
                    <TrashIcon className="w-4 h-4" />
                </button>
            </div>
        </div>
    ))}
</div>
                    </>
                )}
                <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-col xl:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4 text-sm text-slate-500 font-medium order-2 xl:order-1">
                        <span>
                            Showing <span className="font-bold text-slate-700">{totalContacts > 0 ? (currentPage - 1) * entriesPerPage + 1 : 0}</span> to <span className="font-bold text-slate-700">{Math.min(currentPage * entriesPerPage, totalContacts)}</span> of <span className="font-bold text-slate-700">{totalContacts}</span> entries
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
                            disabled={currentPage >= Math.ceil(totalContacts / entriesPerPage) || totalContacts === 0}
                            className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 text-xs font-bold shadow-sm transition-all"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>
        </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity" onClick={() => setIsModalOpen(false)}></div>
                    <div className="relative bg-white w-full sm:w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-slide-up sm:animate-fade-in overflow-hidden">
                        <div className="flex justify-between items-center px-8 py-6 border-b border-slate-100 bg-white z-10 shrink-0"><div><h3 className="text-xl font-extrabold text-slate-900 tracking-tight">{editingContact ? 'Edit Contact' : 'New Lead'}</h3><p className="text-sm text-slate-500 mt-0.5">Fill in the details below to {editingContact ? 'update' : 'add'} a contact.</p></div><button type="button" onClick={() => setIsModalOpen(false)} className="p-2 bg-slate-50 border border-slate-200 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"><CloseIcon className="w-5 h-5" /></button></div>
                        <div className="p-8 overflow-y-auto custom-scrollbar bg-slate-50/50 flex-1 min-h-0">
                            <form id="contact-form" onSubmit={handleSave} className="space-y-8">
                                <div><h4 className="text-xs font-bold text-brand-600 uppercase tracking-wider mb-4 flex items-center gap-2"><BadgeIcon className="w-4 h-4" /> Core Information</h4><div className="grid grid-cols-1 sm:grid-cols-2 gap-5"><div className="sm:col-span-2"><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Full Name</label><input type="text" required className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900 outline-none transition-all font-bold" placeholder="e.g. John Doe" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Phone Number</label>
                                        <div className="flex rounded-xl border border-slate-200 bg-white focus-within:ring-2 focus-within:ring-brand-500/20 focus-within:border-brand-500 transition-all relative">
                                            <div className="relative border-r border-slate-200 bg-slate-50 min-w-[120px] rounded-l-xl">
                                                <button
                                                    type="button"
                                                    className="w-full h-full px-3 py-3 flex items-center justify-between gap-2 text-sm font-bold text-slate-700 outline-none rounded-l-xl hover:bg-slate-100 transition-colors"
                                                    onClick={() => {
                                                        setIsCountryDropdownOpen(!isCountryDropdownOpen);
                                                        setCountrySearchTerm('');
                                                    }}
                                                >
                                                    <span className="truncate">{countries.find(c => c.code === countryCode)?.flag} {countryCode}</span>
                                                    <ChevronDownIcon className="w-3 h-3 text-slate-400 pointer-events-none shrink-0" />
                                                </button>

                                                {isCountryDropdownOpen && (
                                                    <>
                                                        <div className="fixed inset-0 z-40" onClick={() => setIsCountryDropdownOpen(false)}></div>
                                                        <div className="absolute top-full left-0 w-[300px] bg-white border border-slate-200 rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in mt-1 flex flex-col max-h-[300px]">
                                                            <div className="p-3 border-b border-slate-100 sticky top-0 bg-white z-10">
                                                                <div className="relative">
                                                                    <SearchIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                                                    <input
                                                                        type="text"
                                                                        autoFocus
                                                                        placeholder="Search country..."
                                                                        className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                                                                        value={countrySearchTerm}
                                                                        onChange={(e) => setCountrySearchTerm(e.target.value)}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div className="overflow-y-auto custom-scrollbar flex-1">
                                                                {countries
                                                                    .filter(c =>
                                                                        c.name.toLowerCase().includes(countrySearchTerm.toLowerCase()) ||
                                                                        c.code.includes(countrySearchTerm)
                                                                    )
                                                                    .map((c) => (
                                                                        <button
                                                                            key={`${c.code}-${c.name}`}
                                                                            type="button"
                                                                            className={`w-full text-left px-4 py-3 hover:bg-slate-50 text-sm flex items-center gap-3 transition-colors border-b border-slate-50 last:border-0 ${countryCode === c.code ? 'bg-brand-50 text-brand-700' : 'text-slate-700'}`}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setCountryCode(c.code);
                                                                                setIsCountryDropdownOpen(false);
                                                                            }}
                                                                        >
                                                                            <span className="text-xl leading-none">{c.flag}</span>
                                                                            <span className="font-bold min-w-[3rem]">{c.code}</span>
                                                                            <span className="text-slate-600 truncate flex-1">{c.name}</span>
                                                                            {countryCode === c.code && <CheckIcon className="w-4 h-4 text-brand-600 ml-2" />}
                                                                        </button>
                                                                    ))}
                                                                {countries.filter(c => c.name.toLowerCase().includes(countrySearchTerm.toLowerCase()) || c.code.includes(countrySearchTerm)).length === 0 && (
                                                                    <div className="p-8 text-center text-slate-400">
                                                                        <p className="text-sm">No countries found</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                            <input
                                                type="tel"
                                                required
                                                className="w-full px-4 py-3 bg-white text-slate-900 outline-none font-medium placeholder-slate-300 rounded-r-xl"
                                                placeholder="9876543210"
                                                value={localPhone}
                                                maxLength={10}
                                                onChange={e => {
                                                    const val = e.target.value.replace(/\D/g, ''); // Only allow digits
                                                    setLocalPhone(val);
                                                    setFormData({ ...formData, phone: val });
                                                }}
                                            />
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-1 font-medium ml-1">Enter 10 digit mobile number</p>
                                    </div>
                                    <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email Address</label><input type="email" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900 outline-none transition-all font-medium" placeholder="john@example.com" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} /></div></div></div>
                                <div className="h-px bg-slate-200 w-full"></div>
                                
                                <div><h4 className="text-xs font-bold text-brand-600 uppercase tracking-wider mb-4 flex items-center gap-2"><BriefcaseIcon className="w-4 h-4" /> Pipeline Assignment</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Pipeline</label>
                                            <div className="relative">
                                                <select disabled={isPipelineLoading} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900 outline-none transition-all font-medium appearance-none" value={modalPipelineId} onChange={e => { setModalPipelineId(e.target.value); setModalStageId(''); }}>
                                                    <option value="">{isPipelineLoading ? 'Loading...' : 'Select Pipeline...'}</option>
                                                    {modalPipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                </select>
                                                <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-slate-500"><ChevronDownIcon className="w-4 h-4" /></div>
                                            </div>
                                        </div>
                                        {modalPipelineId && (
                                            <div className="animate-in fade-in slide-in-from-top-2">
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Stage</label>
                                                <div className="relative">
                                                    <select className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900 outline-none transition-all font-medium appearance-none" value={modalStageId} onChange={e => setModalStageId(e.target.value)}>
                                                        <option value="">Select Stage...</option>
                                                        {modalStages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                    </select>
                                                    <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-slate-500"><ChevronDownIcon className="w-4 h-4" /></div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="h-px bg-slate-200 w-full"></div>

                                <div><h4 className="text-xs font-bold text-brand-600 uppercase tracking-wider mb-4 flex items-center gap-2"><UsersIcon className="w-4 h-4" /> Organization</h4><div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5"><div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Status</label><div className="relative"><select className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900 outline-none transition-all font-medium appearance-none" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as any })}>{['New', 'Contacted', 'Qualified', 'Converted', 'Lost'].map(s => <option key={s} value={s}>{s}</option>)}</select><div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-slate-500"><ChevronDownIcon className="w-4 h-4" /></div></div></div><div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Source</label><input type="text" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900 outline-none transition-all font-medium" placeholder="e.g. Website, Referral" value={formData.source} onChange={e => setFormData({ ...formData, source: e.target.value })} /></div></div>
                                    <div className="space-y-5">
                                        <div><div className="flex justify-between items-center mb-2"><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Groups</label>{!isCreatingGroup && (<button type="button" onClick={() => { setIsCreatingGroup(true); setNewGroupName(''); }} className="text-xs font-bold text-brand-600 hover:text-brand-800 flex items-center gap-1 hover:bg-brand-50 px-2 py-1 rounded transition-colors"><PlusIcon className="w-3 h-3" /> New Group</button>)}</div>
                                            {!isCreatingGroup ? (<div className="relative mb-3"><select className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900 outline-none transition-all font-medium appearance-none" onChange={handleGroupSelect}><option value="">Select a group to add...</option>{availableGroups.filter(g => !(formData.groupIds || []).includes(g.id)).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select><div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-slate-500"><ChevronDownIcon className="w-4 h-4" /></div></div>) : (<div className="flex gap-2 mb-3 animate-fade-in p-2 bg-brand-50/50 rounded-xl border border-brand-100"><input type="text" autoFocus placeholder="Enter new group name" className="flex-1 px-4 py-2 bg-white border-2 border-brand-500 rounded-lg focus:outline-none text-slate-900 font-medium text-sm" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleCreateGroup())} /><button type="button" onClick={handleCreateGroup} className="px-3 py-2 bg-brand-600 text-white rounded-lg font-bold hover:bg-brand-700 shadow-sm"><CheckIcon className="w-4 h-4" /></button><button type="button" onClick={() => setIsCreatingGroup(false)} className="px-3 py-2 bg-white border border-slate-200 text-slate-500 rounded-lg font-bold hover:bg-slate-50"><CloseIcon className="w-4 h-4" /></button></div>)}
                                            <div className="flex flex-wrap gap-2 min-h-[32px]">{(formData.groupIds || []).map(gid => { const group = availableGroups.find(g => g.id === gid); return group ? (<span key={gid} className="bg-brand-50 text-brand-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-brand-100 flex items-center gap-2 shadow-sm"><UsersIcon className="w-3 h-3 opacity-50" /> {group.name}<button type="button" onClick={() => removeGroup(gid)} className="text-brand-400 hover:text-brand-800 bg-white rounded-full p-0.5"><CloseIcon className="w-3 h-3" /></button></span>) : null; })}</div>
                                        </div>
                                        <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tags</label><div className="relative group"><div className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus-within:ring-2 focus-within:ring-brand-500/20 focus-within:border-brand-500 transition-all flex flex-wrap items-center gap-2 min-h-[50px] cursor-text" onClick={() => document.getElementById('tag-input')?.focus()}>{(formData.tags || []).map((tag, i) => (<span key={i} className="px-2.5 py-1 rounded-lg text-xs font-bold border flex items-center gap-1 shadow-sm transition-colors" style={{ backgroundColor: (tagColorMap[tag] || '#10b981') + '15', color: tagColorMap[tag] || '#10b981', borderColor: (tagColorMap[tag] || '#10b981') + '30' }}><BadgeIcon className="w-3 h-3 opacity-50" />{tag}<button type="button" onClick={(e) => { e.stopPropagation(); removeTag(tag); }} className="hover:text-red-500 ml-1 opacity-60 hover:opacity-100 transition-opacity"><CloseIcon className="w-3 h-3" /></button></span>))}<input id="tag-input" type="text" placeholder={(formData.tags?.length || 0) > 0 ? "" : "Select or create tags..."} className="bg-transparent outline-none text-sm font-medium flex-1 min-w-[100px] placeholder-slate-400" value={tagInput} onChange={handleTagInputChange} onFocus={() => setIsTagDropdownOpen(true)} onBlur={() => setTimeout(() => setIsTagDropdownOpen(false), 200)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput); } if (e.key === 'Backspace' && !tagInput && (formData.tags?.length || 0) > 0) { removeTag(formData.tags![formData.tags!.length - 1]); } }} autoComplete="off" /></div>{isTagDropdownOpen && (tagInput || availableTags.length > 0) && (<div onMouseDown={(e) => e.preventDefault()} className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto custom-scrollbar py-1 animate-fade-in">{availableTags.filter(t => t.toLowerCase().includes(tagInput.toLowerCase()) && !formData.tags?.includes(t)).map(tag => (<button key={tag} type="button" onClick={() => addTag(tag)} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-sm font-medium text-slate-700 flex items-center gap-2 transition-colors"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: tagColorMap[tag] || '#10b981' }}></div> {tag}</button>))}{tagInput.trim() && !availableTags.includes(tagInput.trim()) && !formData.tags?.includes(tagInput.trim()) && (<button type="button" onClick={() => addTag(tagInput)} className="w-full text-left px-4 py-2.5 hover:bg-brand-50 text-sm font-bold text-brand-600 flex items-center gap-2 transition-colors border-t border-slate-100"><PlusIcon className="w-4 h-4" /> Create "{tagInput}"</button>)}</div>)}</div></div>
                                    </div>
                                </div>
                                <div className="h-px bg-slate-200 w-full"></div>
                                <div><div className="flex justify-between items-center mb-4"><h4 className="text-xs font-bold text-brand-600 uppercase tracking-wider flex items-center gap-2"><EditIcon className="w-4 h-4" /> Additional Data</h4>{!isCreatingField && (<button type="button" onClick={() => setIsCreatingField(true)} className="text-xs font-bold text-brand-600 hover:text-brand-800 flex items-center gap-1 hover:bg-brand-50 px-3 py-1.5 rounded-lg transition-all border border-brand-100 shadow-sm"><PlusIcon className="w-3 h-3" /> Add Custom Field</button>)}</div>
                                    {isCreatingField && (<div className="mb-5 p-4 bg-brand-50/50 border border-brand-100 rounded-xl animate-fade-in shadow-sm"><label className="block text-[10px] font-bold text-brand-600 uppercase mb-2">Create New Field</label><div className="flex flex-col sm:flex-row gap-3"><input type="text" placeholder="Field Name (e.g. Birthday)" className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500" value={newFieldName} onChange={e => setNewFieldName(e.target.value)} autoFocus /><select className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-brand-500" value={newFieldType} onChange={e => setNewFieldType(e.target.value)}><option value="text">Text</option><option value="number">Number</option><option value="date">Date</option><option value="url">URL</option></select><div className="flex gap-2"><button type="button" onClick={handleCreateField} className="px-4 py-2 bg-brand-600 text-white rounded-lg font-bold text-xs hover:bg-brand-700 shadow-sm">Save</button><button type="button" onClick={() => setIsCreatingField(false)} className="px-4 py-2 bg-white border border-slate-200 text-slate-500 rounded-lg font-bold text-xs hover:bg-slate-50">Cancel</button></div></div></div>)}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                        {customInputFields.map(field => (
                                            <div key={field.id} className="group/field">
                                                {editingFieldId === field.id ? (
                                                    <div className="flex items-center gap-2 mb-2 animate-fade-in">
                                                        <input type="text" value={tempFieldName} onChange={(e) => setTempFieldName(e.target.value)} className="flex-1 px-2 py-1 text-xs font-bold text-slate-900 border border-brand-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-brand-500" autoFocus onKeyDown={(e) => e.key === 'Enter' && handleUpdateField(field)} />
                                                        <button onClick={() => handleUpdateField(field)} className="text-emerald-600 hover:bg-emerald-50 p-1 rounded transition-colors"><CheckIcon className="w-3 h-3" /></button>
                                                        <button onClick={handleCancelEditField} className="text-slate-400 hover:text-slate-600 hover:bg-slate-50 p-1 rounded transition-colors"><CloseIcon className="w-3 h-3" /></button>
                                                    </div>
                                                ) : (
                                                    <div className="flex justify-between items-center mb-2">
                                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">{field.name}</label>
                                                        <div className="flex items-center gap-1 opacity-0 group-hover/field:opacity-100 transition-opacity">
                                                            <button type="button" onClick={() => handleStartEditField(field)} className="p-1 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors" title="Rename Field"><EditIcon className="w-3 h-3" /></button>
                                                            <button type="button" onClick={() => handleDeleteFieldInline(field.id)} className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete Field Definition"><TrashIcon className="w-3 h-3" /></button>
                                                        </div>
                                                    </div>
                                                )}
                                                <input type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900 outline-none transition-all font-medium" placeholder={field.placeholder} value={formData.customData?.[field.name] || ''} onChange={e => handleCustomFieldChange(field.name, e.target.value)} />
                                            </div>
                                        ))}
                                        {customInputFields.length === 0 && !isCreatingField && (<div className="col-span-2 text-center py-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-sm text-slate-400">No custom fields yet. Click "Add Custom Field" to create one.</div>)}
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div className="px-8 py-5 bg-white border-t border-slate-100 flex justify-end space-x-4 rounded-b-2xl sticky bottom-0 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                            <button onClick={() => setIsModalOpen(false)} className="px-6 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-sm transition-colors">Cancel</button>
                            <button type="submit" form="contact-form" className="px-8 py-3 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 shadow-lg shadow-brand-200 transition-all transform hover:-translate-y-0.5 flex items-center space-x-2"><BadgeIcon className="w-5 h-5" /><span>{editingContact ? 'Update Contact' : 'Save Contact'}</span></button>
                        </div>
                    </div>
                </div>
            )}

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
                <Toast
                    type={toast.type}
                    title={toast.title}
                    message={toast.message}
                    onClose={() => setToast(null)}
                />
            )}
        </>
    );
};

export default ContactList;
