import React, { useState, useEffect, useMemo } from 'react';
import { Contact, ContactGroup, InputField } from '../types';
import { contactService } from '../services/contactService';
import { contactGroupService } from '../services/contactGroupService';
import { inputFieldService } from '../services/inputFieldService';
import { tagService, Tag } from '../services/tagService';
import {
    CloseIcon, BadgeIcon, ChevronDownIcon, UsersIcon, CheckIcon, PlusIcon,
    SearchIcon, EditIcon, TrashIcon
} from './icons';
import { countries } from '../utils/countries';

interface ContactEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    contact: Contact | null; // null means creating a new contact
    onSave: () => void; // Callback to refresh parent data
    initialPhoneNumber?: string;
    initialName?: string;
}

const ContactEditModal: React.FC<ContactEditModalProps> = ({ isOpen, onClose, contact, onSave, initialPhoneNumber, initialName }) => {
    // Metadata State
    const [availableGroups, setAvailableGroups] = useState<ContactGroup[]>([]);
    const [allTags, setAllTags] = useState<Tag[]>([]);
    const [customInputFields, setCustomInputFields] = useState<InputField[]>([]);
    const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);

    // Form State
    const [formData, setFormData] = useState<Partial<Contact>>({
        name: '', phone: '', email: '', status: 'New', tags: [], source: 'Manual', groupIds: [], customData: {}
    });

    // Country & Phone State
    const [countryCode, setCountryCode] = useState('+91');
    const [localPhone, setLocalPhone] = useState('');
    const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
    const [countrySearchTerm, setCountrySearchTerm] = useState('');

    // Tag State
    const [tagInput, setTagInput] = useState('');
    const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);

    // Group Creation State
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');

    // Field Creation/Edit State
    const [isCreatingField, setIsCreatingField] = useState(false);
    const [newFieldName, setNewFieldName] = useState('');
    const [newFieldType, setNewFieldType] = useState('text');
    const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
    const [tempFieldName, setTempFieldName] = useState('');

    // Derived State
    const tagColorMap = useMemo(() => {
        return allTags.reduce((acc, tag) => {
            acc[tag.name] = tag.color || '#10b981';
            return acc;
        }, {} as Record<string, string>);
    }, [allTags]);

    const availableTags = useMemo(() => {
        return allTags.map(t => t.name).sort();
    }, [allTags]);

    // Cleanup on unmount/close
    useEffect(() => {
        if (!isOpen) {
            setIsCountryDropdownOpen(false);
            setIsTagDropdownOpen(false);
            setIsCreatingGroup(false);
            setIsCreatingField(false);
        }
    }, [isOpen]);

    // Load Metadata & Initialize Form
    useEffect(() => {
        if (isOpen) {
            loadMetadata();
            initializeForm();
        }
    }, [isOpen, contact, initialPhoneNumber]);

    const loadMetadata = async () => {
        setIsLoadingMetadata(true);
        try {
            const [groups, inputs, tags] = await Promise.all([
                contactGroupService.getGroups(),
                inputFieldService.getInputs(),
                tagService.getTags()
            ]);
            setAvailableGroups(groups || []);
            setCustomInputFields(inputs || []);
            setAllTags(tags || []);
        } catch (err) {
            console.error("Failed to load contact metadata", err);
        } finally {
            setIsLoadingMetadata(false);
        }
    };

    const initializeForm = () => {
        if (contact) {
            setFormData({ ...contact });
            parsePhone(contact.phone);
        } else {
            setFormData({
                name: (initialName && initialName !== '~') ? initialName : '',
                phone: '', email: '', status: 'New', tags: [], source: 'Manual', groupIds: [], customData: {}
            });
            if (initialPhoneNumber) {
                parsePhone(initialPhoneNumber);
            } else {
                setCountryCode('+91');
                setLocalPhone('');
            }
        }
        setTagInput('');
    };
    const parsePhone = (phone: string) => {
        if (!phone) {
            setCountryCode('+91');
            setLocalPhone('');
            return;
        }

        const cleanPhone = phone.replace(/\D/g, '');
        const sortedCodes = [...countries].sort((a, b) => b.code.length - a.code.length);
        let matched = false;

        for (const c of sortedCodes) {
            const cleanCode = c.code.replace(/\D/g, '');
            if (cleanPhone.startsWith(cleanCode)) {
                setCountryCode(c.code);
                setLocalPhone(cleanPhone.substring(cleanCode.length));
                matched = true;
                break;
            }
        }

        if (!matched) {
            setLocalPhone(cleanPhone);
            // Default to +91 or keep existing country code if we want persistence, 
            // but resetting to +91 is safer if we can't detect
            if (!countryCode) setCountryCode('+91');
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate Phone
        if (localPhone.length < 4) { // Basic length check, exact 10 might be too strict for international
            alert('Please enter a valid mobile number.');
            return;
        }

        const fullPhone = `${countryCode.replace('+', '')}${localPhone}`;
        let finalTags = [...(formData.tags || [])];

        // Auto-add pending tag input
        if (tagInput.trim()) {
            const newTag = tagInput.trim();
            if (!finalTags.includes(newTag)) {
                finalTags.push(newTag);
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
            id: contact ? contact.id : `cnt-${Date.now()}`,
            name: formData.name || 'Unknown',
            phone: fullPhone,
            email: formData.email || '',
            status: (formData.status as any) || 'New',
            tags: finalTags,
            source: formData.source || 'Manual',
            createdAt: contact ? contact.createdAt : new Date().toLocaleDateString(),
            groupIds: formData.groupIds || [],
            customData: formData.customData || {}
        };

        try {
            await contactService.saveContact(newContact);
            onSave();
            onClose();
        } catch (error) {
            console.error("Failed to save contact", error);
            alert("Failed to save contact. Please try again.");
        }
    };

    // --- Tag Logic ---
    const addTag = async (tag: string) => {
        const trimmed = tag.trim();
        if (!trimmed) return;

        if (!allTags.some(t => t.name === trimmed)) {
            try {
                const savedTag = await tagService.saveTag({ name: trimmed, color: '#10b981' });
                setAllTags(prev => [...prev, savedTag]);
            } catch (err) {
                console.error("Failed to create new tag", err);
            }
        }

        const newTags = [...(formData.tags || [])];
        if (!newTags.includes(trimmed)) {
            setFormData(prev => ({ ...prev, tags: [...newTags, trimmed] }));
        }
        setTagInput('');
        setIsTagDropdownOpen(false);
    };

    const removeTag = (t: string) => {
        setFormData(prev => ({ ...prev, tags: (prev.tags || []).filter(tag => tag !== t) }));
    };

    // --- Group Logic ---
    const handleCreateGroup = async () => {
        if (!newGroupName.trim()) return;
        const newGroup = {
            id: `grp-${Date.now()}`,
            name: newGroupName.trim(),
            description: '',
            contactCount: 0,
            createdAt: new Date().toLocaleDateString(),
            status: 'Active' as const
        };

        try {
            const savedGroup = await contactGroupService.saveGroup(newGroup);
            const finalGroup = savedGroup || newGroup;
            setAvailableGroups(prev => [...prev, finalGroup]);
            setFormData(prev => ({ ...prev, groupIds: [...(prev.groupIds || []), finalGroup.id] }));
        } catch (e) {
            console.error("Create group error", e);
        }
        setIsCreatingGroup(false);
        setNewGroupName('');
    };

    const handleGroupSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        if (val && !(formData.groupIds || []).includes(val)) {
            setFormData(prev => ({ ...prev, groupIds: [...(prev.groupIds || []), val] }));
        }
        e.target.value = '';
    };

    const removeGroup = (gid: string) => {
        setFormData(prev => ({ ...prev, groupIds: (prev.groupIds || []).filter(id => id !== gid) }));
    };

    // --- Custom Field Logic ---
    const handleCustomFieldChange = (name: string, val: string) => {
        setFormData(prev => ({
            ...prev,
            customData: { ...(prev.customData || {}), [name]: val }
        }));
    };

    const handleCreateField = async () => {
        if (!newFieldName.trim()) return;
        const tempField: InputField = {
            id: `inp-${Date.now()}`,
            name: newFieldName.trim(),
            type: newFieldType as any,
            placeholder: `Enter ${newFieldName}`
        };

        try {
            const savedField = await inputFieldService.saveInput(tempField);
            setCustomInputFields(prev => [...prev, savedField || tempField]);
        } catch (e) {
            console.error("Create field error", e);
            setCustomInputFields(prev => [...prev, tempField]);
        }
        setIsCreatingField(false);
        setNewFieldName('');
    };

    const handleUpdateField = async (field: InputField) => {
        if (!tempFieldName.trim()) return;
        const newName = tempFieldName.trim();
        const updatedFieldData = { ...field, name: newName };

        await inputFieldService.saveInput(updatedFieldData);
        const updatedFields = await inputFieldService.getInputs();
        setCustomInputFields(updatedFields);

        // Migrate data in form
        if (field.name !== newName) {
            setFormData(prev => {
                const newData = { ...(prev.customData || {}) };
                if (newData[field.name] !== undefined) {
                    newData[newName] = newData[field.name];
                    delete newData[field.name];
                }
                return { ...prev, customData: newData };
            });
        }
        setEditingFieldId(null);
    };

    const handleDeleteFieldInline = async (id: string) => {
        if (window.confirm("Delete field?")) {
            await inputFieldService.deleteInput(id);
            setCustomInputFields(prev => prev.filter(f => f.id !== id));
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity" onClick={onClose}></div>
            <div className="relative bg-white w-full sm:w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-slide-up sm:animate-fade-in">
                <div className="flex justify-between items-center px-8 py-6 border-b border-slate-100 bg-white rounded-t-2xl sticky top-0 z-10">
                    <div>
                        <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">{contact ? 'Edit Contact' : (initialName || initialPhoneNumber) ? 'Add Contact' : 'New Contact'}</h3>
                        <p className="text-sm text-slate-500 mt-0.5">Fill in the details below to {contact ? 'update' : 'add'} a contact.</p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-slate-50 border border-slate-200 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-8 overflow-y-auto custom-scrollbar bg-slate-50/50">
                    <form id="contact-form" onSubmit={handleSave} className="space-y-8">
                        <div>
                            <h4 className="text-xs font-bold text-brand-600 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <BadgeIcon className="w-4 h-4" /> Core Information
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div className="sm:col-span-2">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Full Name</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900 outline-none transition-all font-bold"
                                        placeholder="e.g. John Doe"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
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
                                            maxLength={15}
                                            onChange={e => {
                                                const val = e.target.value.replace(/\D/g, ''); // Only allow digits
                                                setLocalPhone(val);
                                                setFormData({ ...formData, phone: val });
                                            }}
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1 font-medium ml-1">Enter mobile number (without country code)</p>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email Address</label>
                                    <input type="email" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900 outline-none transition-all font-medium" placeholder="john@example.com" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                                </div>
                            </div>
                        </div>
                        <div className="h-px bg-slate-200 w-full"></div>
                        <div>
                            <h4 className="text-xs font-bold text-brand-600 uppercase tracking-wider mb-4 flex items-center gap-2"><UsersIcon className="w-4 h-4" /> Organization</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Status</label>
                                    <div className="relative">
                                        <select className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900 outline-none transition-all font-medium appearance-none" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as any })}>
                                            {['New', 'Contacted', 'Qualified', 'Converted', 'Lost'].map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                        <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-slate-500"><ChevronDownIcon className="w-4 h-4" /></div>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Source</label>
                                    <input type="text" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900 outline-none transition-all font-medium" placeholder="e.g. Website, Referral" value={formData.source} onChange={e => setFormData({ ...formData, source: e.target.value })} />
                                </div>
                            </div>
                            <div className="space-y-5">
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Groups</label>
                                        {!isCreatingGroup && (
                                            <button type="button" onClick={() => { setIsCreatingGroup(true); setNewGroupName(''); }} className="text-xs font-bold text-brand-600 hover:text-brand-800 flex items-center gap-1 hover:bg-brand-50 px-2 py-1 rounded transition-colors">
                                                <PlusIcon className="w-3 h-3" /> New Group
                                            </button>
                                        )}
                                    </div>
                                    {!isCreatingGroup ? (
                                        <div className="relative mb-3">
                                            <select className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900 outline-none transition-all font-medium appearance-none" onChange={handleGroupSelect}>
                                                <option value="">Select a group to add...</option>
                                                {availableGroups.filter(g => !(formData.groupIds || []).includes(g.id)).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                            </select>
                                            <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-slate-500"><ChevronDownIcon className="w-4 h-4" /></div>
                                        </div>
                                    ) : (
                                        <div className="flex gap-2 mb-3 animate-fade-in p-2 bg-brand-50/50 rounded-xl border border-brand-100">
                                            <input type="text" autoFocus placeholder="Enter new group name" className="flex-1 px-4 py-2 bg-white border-2 border-brand-500 rounded-lg focus:outline-none text-slate-900 font-medium text-sm" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleCreateGroup())} />
                                            <button type="button" onClick={handleCreateGroup} className="px-3 py-2 bg-brand-600 text-white rounded-lg font-bold hover:bg-brand-700 shadow-sm"><CheckIcon className="w-4 h-4" /></button>
                                            <button type="button" onClick={() => setIsCreatingGroup(false)} className="px-3 py-2 bg-white border border-slate-200 text-slate-500 rounded-lg font-bold hover:bg-slate-50"><CloseIcon className="w-4 h-4" /></button>
                                        </div>
                                    )}
                                    <div className="flex flex-wrap gap-2 min-h-[32px]">
                                        {(formData.groupIds || []).map(gid => {
                                            const group = availableGroups.find(g => g.id === gid);
                                            return group ? (
                                                <span key={gid} className="bg-brand-50 text-brand-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-brand-100 flex items-center gap-2 shadow-sm">
                                                    <UsersIcon className="w-3 h-3 opacity-50" /> {group.name}
                                                    <button type="button" onClick={() => removeGroup(gid)} className="text-brand-400 hover:text-brand-800 bg-white rounded-full p-0.5"><CloseIcon className="w-3 h-3" /></button>
                                                </span>
                                            ) : null;
                                        })}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tags</label>
                                    <div className="relative group">
                                        <div className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus-within:ring-2 focus-within:ring-brand-500/20 focus-within:border-brand-500 transition-all flex flex-wrap items-center gap-2 min-h-[50px] cursor-text" onClick={() => document.getElementById('tag-input-modal')?.focus()}>
                                            {(formData.tags || []).map((tag, i) => (
                                                <span key={i} className="px-2.5 py-1 rounded-lg text-xs font-bold border flex items-center gap-1 shadow-sm transition-colors" style={{ backgroundColor: (tagColorMap[tag] || '#10b981') + '15', color: tagColorMap[tag] || '#10b981', borderColor: (tagColorMap[tag] || '#10b981') + '30' }}>
                                                    <BadgeIcon className="w-3 h-3 opacity-50" />{tag}
                                                    <button type="button" onClick={(e) => { e.stopPropagation(); removeTag(tag); }} className="hover:text-red-500 ml-1 opacity-60 hover:opacity-100 transition-opacity"><CloseIcon className="w-3 h-3" /></button>
                                                </span>
                                            ))}
                                            <input
                                                id="tag-input-modal"
                                                type="text"
                                                placeholder={(formData.tags?.length || 0) > 0 ? "" : "Select or create tags..."}
                                                className="bg-transparent outline-none text-sm font-medium flex-1 min-w-[100px] placeholder-slate-400"
                                                value={tagInput}
                                                onChange={(e) => setTagInput(e.target.value)}
                                                onFocus={() => setIsTagDropdownOpen(true)}
                                                onBlur={() => setTimeout(() => setIsTagDropdownOpen(false), 200)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput); }
                                                    if (e.key === 'Backspace' && !tagInput && (formData.tags?.length || 0) > 0) {
                                                        removeTag(formData.tags![formData.tags!.length - 1]);
                                                    }
                                                }}
                                                autoComplete="off"
                                            />
                                        </div>
                                        {isTagDropdownOpen && (tagInput || availableTags.length > 0) && (
                                            <div onMouseDown={(e) => e.preventDefault()} className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto custom-scrollbar py-1 animate-fade-in">
                                                {availableTags.filter(t => t.toLowerCase().includes(tagInput.toLowerCase()) && !formData.tags?.includes(t)).map(tag => (
                                                    <button key={tag} type="button" onClick={() => addTag(tag)} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-sm font-medium text-slate-700 flex items-center gap-2 transition-colors">
                                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tagColorMap[tag] || '#10b981' }}></div> {tag}
                                                    </button>
                                                ))}
                                                {tagInput.trim() && !availableTags.includes(tagInput.trim()) && !formData.tags?.includes(tagInput.trim()) && (
                                                    <button type="button" onClick={() => addTag(tagInput)} className="w-full text-left px-4 py-2.5 hover:bg-brand-50 text-sm font-bold text-brand-600 flex items-center gap-2 transition-colors border-t border-slate-100">
                                                        <PlusIcon className="w-4 h-4" /> Create "{tagInput}"
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="h-px bg-slate-200 w-full"></div>
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="text-xs font-bold text-brand-600 uppercase tracking-wider flex items-center gap-2"><EditIcon className="w-4 h-4" /> Additional Data</h4>
                                {!isCreatingField && (
                                    <button type="button" onClick={() => setIsCreatingField(true)} className="text-xs font-bold text-brand-600 hover:text-brand-800 flex items-center gap-1 hover:bg-brand-50 px-3 py-1.5 rounded-lg transition-all border border-brand-100 shadow-sm">
                                        <PlusIcon className="w-3 h-3" /> Add Custom Field
                                    </button>
                                )}
                            </div>
                            {isCreatingField && (
                                <div className="mb-5 p-4 bg-brand-50/50 border border-brand-100 rounded-xl animate-fade-in shadow-sm">
                                    <label className="block text-[10px] font-bold text-brand-600 uppercase mb-2">Create New Field</label>
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <input type="text" placeholder="Field Name (e.g. Birthday)" className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500" value={newFieldName} onChange={e => setNewFieldName(e.target.value)} autoFocus />
                                        <select className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-brand-500" value={newFieldType} onChange={e => setNewFieldType(e.target.value)}>
                                            <option value="text">Text</option>
                                            <option value="number">Number</option>
                                            <option value="date">Date</option>
                                            <option value="url">URL</option>
                                        </select>
                                        <div className="flex gap-2">
                                            <button type="button" onClick={handleCreateField} className="px-4 py-2 bg-brand-600 text-white rounded-lg font-bold text-xs hover:bg-brand-700 shadow-sm">Save</button>
                                            <button type="button" onClick={() => setIsCreatingField(false)} className="px-4 py-2 bg-white border border-slate-200 text-slate-500 rounded-lg font-bold text-xs hover:bg-slate-50">Cancel</button>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                {customInputFields.map(field => (
                                    <div key={field.id} className="group/field">
                                        {editingFieldId === field.id ? (
                                            <div className="flex items-center gap-2 mb-2 animate-fade-in">
                                                <input type="text" value={tempFieldName} onChange={(e) => setTempFieldName(e.target.value)} className="flex-1 px-2 py-1 text-xs font-bold text-slate-900 border border-brand-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-brand-500" autoFocus onKeyDown={(e) => e.key === 'Enter' && handleUpdateField(field)} />
                                                <button onClick={() => handleUpdateField(field)} className="text-emerald-600 hover:bg-emerald-50 p-1 rounded transition-colors"><CheckIcon className="w-3 h-3" /></button>
                                                <button onClick={() => setEditingFieldId(null)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-50 p-1 rounded transition-colors"><CloseIcon className="w-3 h-3" /></button>
                                            </div>
                                        ) : (
                                            <div className="flex justify-between items-center mb-2">
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">{field.name}</label>
                                                <div className="flex items-center gap-1 opacity-0 group-hover/field:opacity-100 transition-opacity">
                                                    <button type="button" onClick={() => { setEditingFieldId(field.id); setTempFieldName(field.name); }} className="p-1 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors" title="Rename Field"><EditIcon className="w-3 h-3" /></button>
                                                    <button type="button" onClick={() => handleDeleteFieldInline(field.id)} className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete Field Definition"><TrashIcon className="w-3 h-3" /></button>
                                                </div>
                                            </div>
                                        )}
                                        <input
                                            type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900 outline-none transition-all font-medium"
                                            placeholder={field.placeholder}
                                            value={formData.customData?.[field.name] || ''}
                                            onChange={e => handleCustomFieldChange(field.name, e.target.value)}
                                        />
                                    </div>
                                ))}
                                {customInputFields.length === 0 && !isCreatingField && (
                                    <div className="col-span-2 text-center py-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-sm text-slate-400">No custom fields yet. Click "Add Custom Field" to create one.</div>
                                )}
                            </div>
                        </div>
                    </form>
                </div>
                <div className="px-8 py-5 bg-white border-t border-slate-100 flex justify-end space-x-4 rounded-b-2xl sticky bottom-0 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                    <button onClick={onClose} className="px-6 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-sm transition-colors">Cancel</button>
                    <button type="submit" form="contact-form" className="px-8 py-3 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 shadow-lg shadow-brand-200 transition-all transform hover:-translate-y-0.5 flex items-center space-x-2">
                        <BadgeIcon className="w-5 h-5" /><span>{contact ? 'Update Contact' : 'Save Contact'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ContactEditModal;
