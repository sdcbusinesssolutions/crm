import React, { useState, useEffect, useRef } from 'react';
import { FollowUp } from '../../services/followUpService';
import { contactService } from '../../services/contactService';
import { dripCampaignService, DripCampaign } from '../../services/dripCampaignService';
import { supabase } from '../../lib/supabase';

interface FollowUpFormProps {
    initialData?: Partial<FollowUp>;
    onSave: (data: any) => Promise<void>;
    onCancel: () => void;
    onNavigate?: (item: string, extraData?: any) => void;
}

const FORM_STORAGE_KEY = 'follow_up_form_draft';

const FollowUpForm: React.FC<FollowUpFormProps> = ({ initialData, onSave, onCancel, onNavigate }) => {

    // Helper to format date for datetime-local input (Local Time)

    const formatDateForInput = (dateStr?: string) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return '';

        // Get local components
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');

        return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    const [formData, setFormData] = useState<Partial<FollowUp>>({
        status: 'PENDING',
        recurrence_rule: null,
        contact_id: '',
        ...initialData,
        // Ensure uppercase for dropdown matching
        type: (initialData?.type?.toUpperCase() as any) || 'CALL',
        priority: (initialData?.priority?.toUpperCase() as any) || 'MEDIUM',
        title: initialData?.title || '',
        description: initialData?.description || '',
        scheduled_at: formatDateForInput(initialData?.scheduled_at)
    });

    // Recurrence State
    const [recurrence, setRecurrence] = useState<{
        enabled: boolean;
        frequency: 'daily' | 'weekly' | 'monthly';
        interval: number;
        end_date: string;
    }>({
        enabled: false,
        frequency: 'daily',
        interval: 1,
        end_date: ''
    });

    // Search & Templates State
    const [contactSearch, setContactSearch] = useState('');
    const [contacts, setContacts] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    const [templates, setTemplates] = useState<any[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState('');

    // Drip Selection
    const [activeCampaigns, setActiveCampaigns] = useState<DripCampaign[]>([]);
    const [selectedCampaignId, setSelectedCampaignId] = useState('');
    const [isLooping, setIsLooping] = useState(false);
    const [notificationRules, setNotificationRules] = useState<any[]>([
        { phone: '', value: 24, unit: 'HOURS' }
    ]);
    const [savedWithDrip, setSavedWithDrip] = useState(false);
    const [selectedContacts, setSelectedContacts] = useState<any[]>([]);
    const [isBulkCreating, setIsBulkCreating] = useState(false);

    // --- Persistence Helper ---
    const [draftRestored, setDraftRestored] = useState(false);

    // --- Contact Helper Functions ---
    const addContact = (contact: any) => {
        // De-duplicate by phone or ID
        if (!selectedContacts.find(sc => (contact.id && sc.id === contact.id) || (contact.phone && sc.phone === contact.phone))) {
            setSelectedContacts(prev => [...prev, contact]);
        }
    };

    // --- Master Initialization & Persistence Effect ---
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        let isEditing = !!initialData?.id;

        // 1. If Editing, always trust initialData
        if (isEditing) {
            setFormData(prev => ({
                ...prev,
                ...initialData,
                type: (initialData?.type?.toUpperCase() as any) || 'CALL',
                priority: (initialData?.priority?.toUpperCase() as any) || 'MEDIUM',
                scheduled_at: formatDateForInput(initialData?.scheduled_at)
            }));

            if (initialData?.recurrence_rule) {
                setRecurrence({ enabled: true, ...initialData.recurrence_rule });
            }
        }
        // 2. If New Task, try to restore draft
        else {
            const saved = sessionStorage.getItem(FORM_STORAGE_KEY);
            if (saved) {
                try {
                    const state = JSON.parse(saved);
                    if (state.formData) setFormData(state.formData);
                    if (state.selectedContacts) setSelectedContacts(state.selectedContacts);
                    if (state.selectedCampaignId) setSelectedCampaignId(state.selectedCampaignId);
                    if (state.isLooping !== undefined) setIsLooping(state.isLooping);
                    if (state.notificationRules) setNotificationRules(state.notificationRules);
                    setDraftRestored(true);
                    // Hide notification after 3 seconds
                    setTimeout(() => setDraftRestored(false), 3000);
                } catch (e) {
                    console.error("Failed to restore draft", e);
                }
            } else if (initialData && Object.keys(initialData).length > 0) {
                // Initial setup for new task if no draft
                setFormData(prev => ({
                    ...prev,
                    ...initialData,
                    type: (initialData.type?.toUpperCase() as any) || 'CALL',
                    priority: (initialData.priority?.toUpperCase() as any) || 'MEDIUM',
                    scheduled_at: formatDateForInput(initialData.scheduled_at)
                }));
            }
        }

        loadTemplates();
        loadCampaigns();

        // One-time pre-fill for contact search
        if (initialData?.contacts) {
            const contact = Array.isArray(initialData.contacts) ? initialData.contacts[0] : initialData.contacts;
            if (contact) {
                const { name, phone } = contact;
                setContactSearch(name && name !== '~' ? `${name} (${phone || ''})` : (phone || ''));
            }
        }

        // Delay sets state isReady to true to ensure it happens in next tick
        const timer = setTimeout(() => setIsReady(true), 50);
        return () => clearTimeout(timer);
    }, [initialData?.id]);

    // Persistence Auto-Save Effect
    useEffect(() => {
        // CRITICAL: Don't clobber the storage on mount before restoration happens
        if (!isReady) return;

        if (!initialData?.id && !savedWithDrip) {
            const state = {
                formData,
                selectedContacts,
                selectedCampaignId,
                isLooping,
                notificationRules
            };
            sessionStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(state));
        }
    }, [formData, selectedContacts, selectedCampaignId, isLooping, notificationRules, isReady]);

    const clearDraft = () => sessionStorage.removeItem(FORM_STORAGE_KEY);

    const handleAddNumbers = () => {
        const value = contactSearch.trim();
        if (!value) return;

        // Split by commas, spaces, or newlines
        const parts = value.split(/[,\n\t\s]+/).filter(Boolean);
        let addedCount = 0;

        parts.forEach(p => {
            const clean = p.replace(/[^0-9+]/g, '');
            // Simple validation: at least 8 digits
            if (clean.length >= 8) {
                addContact({
                    id: `temp_${Date.now()}_${Math.random()}`,
                    name: clean,
                    phone: clean,
                    is_new: true // Flag for bulk create later
                });
                addedCount++;
            }
        });

        if (addedCount > 0) {
            setContactSearch('');
            setShowDropdown(false);
            // Expert Suggestion: Auto-switch to WhatsApp for bulk lists
            if (addedCount > 1 || selectedContacts.length > 1) {
                setFormData(prev => ({ ...prev, type: 'WHATSAPP' }));
            }
        }
    };


    // Handle Click Outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Debounced Search Effect
    useEffect(() => {
        const timeoutId = setTimeout(async () => {
            if (contactSearch.length > 2 && !formData.contact_id) {
                setIsSearching(true);
                try {
                    const results = await contactService.getContactsPaginated(1, 5, contactSearch);
                    setContacts(results.data);
                    setShowDropdown(true);
                } catch (error) {
                    console.error("Failed to search contacts", error);
                } finally {
                    setIsSearching(false);
                }
            } else if (contactSearch.length <= 2) {
                setContacts([]);
                setShowDropdown(false);
            }
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [contactSearch]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',') {
            // If there's a selected option in a dropdown, handle via click
            // Otherwise, it's a number add request
            if (contacts.length === 0 || contactSearch.includes(',')) {
                e.preventDefault();
                handleAddNumbers();
            }
        }
    };

    const loadCampaigns = async () => {
        try {
            const all = await dripCampaignService.getCampaigns();
            const manual = all.filter(c => c.status === 'ACTIVE' || c.status === 'DRAFT');
            setActiveCampaigns(manual);
            // Auto-select first campaign if none currently selected and not editing
            if (manual.length > 0 && !selectedCampaignId && !initialData?.id) {
                setSelectedCampaignId(manual[0].id);
            }
        } catch (e) {
            console.error('Failed to load campaigns', e);
        }
    };

    const loadTemplates = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            const res = await fetch('/api/whatsapp/templates', {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
            if (res.ok) {
                const json = await res.json();
                setTemplates(json.data || []);
            }
        } catch (e) {
            console.error('Failed to load templates', e);
        }
    };

    // Auto-update description when template changes
    useEffect(() => {
        if (formData.type === 'WHATSAPP' && selectedTemplateId) {
            const tpl = templates.find(t => t.id === selectedTemplateId);
            if (tpl) {
                setFormData(prev => ({
                    ...prev,
                    description: `Action: Send WhatsApp Template '${tpl.name}'`
                }));
            }
        }
    }, [selectedTemplateId, formData.type]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (selectedContacts.length === 0) {
            alert("Please select at least one contact.");
            return;
        }

        setIsBulkCreating(true);

        // 1. Bulk Create any NEW contacts (those added by number)
        const newContacts = selectedContacts.filter(c => c.is_new);
        const existingContacts = selectedContacts.filter(c => !c.is_new);

        let allContactIds = existingContacts.map(c => c.id);

        if (newContacts.length > 0) {
            try {
                const bulkRes = await contactService.bulkCreateContacts(newContacts.map(c => ({
                    name: c.name,
                    phone: c.phone,
                    source: 'Follow-up Form (Direct)'
                })));

                if (bulkRes && bulkRes.data) {
                    // Update the selectedContacts list with real ones for the next step (enrollment)
                    const createdWithIds = bulkRes.data.map((c: any) => ({ ...c, is_new: false }));
                    allContactIds = [...allContactIds, ...createdWithIds.map((c: any) => c.id)];

                    // IMPORTANT: We need the full contact objects for enrollment below
                    // if they are enrolling in a drip, the service expects contact IDs 
                    // which we now have.
                }
            } catch (err: any) {
                console.error("Bulk create failed", err);
                alert(`Error creating new contacts: ${err.message}`);
                setIsBulkCreating(false);
                return;
            }
        }

        // Convert local time back to ISO UTC string for backend
        let isoScheduledAt = formData.scheduled_at;
        if (formData.scheduled_at) {
            const dateObj = new Date(formData.scheduled_at); // Treats as local
            if (!isNaN(dateObj.getTime())) {
                isoScheduledAt = dateObj.toISOString();
            }
        }

        const dataToSave = {
            ...formData,
            scheduled_at: isoScheduledAt, // Send ISO string
            recurrence_rule: recurrence.enabled ? {
                frequency: recurrence.frequency,
                interval: recurrence.interval,
                end_date: recurrence.end_date
            } : null
        };

        // 2. Handle Drip Enrollment
        let dripEnrolled = false;
        if (selectedCampaignId && allContactIds.length > 0) {
            try {
                await dripCampaignService.enrollContacts(
                    selectedCampaignId,
                    allContactIds,
                    formData.scheduled_at,
                    notificationRules.filter(r => r.phone && r.value),
                    isLooping
                );
                dripEnrolled = true;
            } catch (e) {
                console.error('Failed to auto-enroll in drip', e);
            }
        }

        // 3. Save the Follow-Up Task(s)
        await onSave({
            ...dataToSave,
            contact_ids: allContactIds
        });

        clearDraft();
        setIsBulkCreating(false);

        // 4. Show success banner
        if (dripEnrolled) {
            setSavedWithDrip(true);
        }
    };

    // ✅ Success banner after save with drip enrolled
    if (savedWithDrip) {
        const enrolledCampaign = activeCampaigns.find(c => c.id === selectedCampaignId);
        return (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center space-y-6">
                {/* Success Icon */}
                <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center shadow-lg">
                    <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                </div>

                <div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Follow-Up Saved! 🎉</h2>
                    <p className="text-slate-700 text-sm">
                        Your follow-up has been created and the contact has been enrolled in
                    </p>
                    <p className="text-purple-700 font-bold text-lg mt-1">
                        📣 {enrolledCampaign?.name || 'Nurture Sequence'}
                    </p>
                    <p className="text-slate-600 text-xs mt-2">The sequence started running immediately.</p>
                </div>

                <div className="flex gap-3 flex-wrap justify-center">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-6 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-all shadow-sm"
                    >
                        ← Back to Follow-Ups
                    </button>
                    <button
                        type="button"
                        onClick={() => onNavigate && onNavigate('Drip Campaigns')}
                        className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-xl font-bold hover:from-purple-700 hover:to-purple-600 shadow-lg shadow-purple-200 hover:shadow-purple-300 transform active:scale-[0.98] transition-all flex items-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                        View Nurture sequences →
                    </button>
                </div>
            </div>
        );
    }
    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden bg-slate-50/50">
            <div className="flex-1 overflow-y-auto custom-scrollbar pt-6 px-4 md:px-6 w-full pb-20">

                {/* Main Tip Widget */}
                <div className="w-full max-w-4xl mx-auto mb-6 relative group overflow-hidden bg-white hover:bg-slate-50 border-2 border-[#00684A] shadow-md hover:shadow-lg rounded-2xl p-4 flex items-center gap-4 transition-all duration-500 transform hover:-translate-y-1">
                    {/* Background animated shine */}
                    <div className="absolute inset-0 -translate-x-full group-hover:animate-shimmer bg-gradient-to-r from-transparent via-white/40 to-transparent z-0"></div>

                    <div className="relative z-10 w-12 h-12 rounded-full bg-[#00684A]/10 flex items-center justify-center shrink-0 border border-[#00684A]/20 shadow-inner group-hover:scale-110 transition-transform duration-300">
                        <span className="absolute inset-0 rounded-full animate-ping opacity-20 bg-[#00684A]"></span>
                        <svg className="w-6 h-6 text-[#00684A]" fill="currentColor" viewBox="0 0 20 20"><path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM9 11v4l-2-2m6-2v-4a2 2 0 10-4 0v4m6-2v2a2 2 0 11-4 0v-2h4z" /></svg>
                    </div>

                    <div className="relative z-10">
                        <h4 className="text-[10px] font-black tracking-widest uppercase text-[#00684A] mb-0.5 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#00684A] animate-pulse"></span> SYSTEM TIP
                        </h4>
                        <p className="text-sm font-medium text-slate-700 leading-relaxed">
                            Follow-ups are <span className="font-bold text-[#00684A]">personal reminders</span>. Use Card 3 (Automate) for <span className="font-bold border-b-2 border-dashed border-[#00684A]/30 text-[#00684A]">automated messaging sequences</span>.
                        </p>
                    </div>
                </div>

                {/* Draft Status Indicator */}
                {draftRestored && (
                    <div className="w-full max-w-4xl mx-auto mb-6 flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl animate-fade-in-up">
                        <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <span className="text-xs font-black text-emerald-800 uppercase tracking-widest">Draft Restored Successfully!</span>
                        <div className="ml-auto w-1 h-1 rounded-full bg-emerald-400 animate-pulse"></div>
                    </div>
                )}

                {/* 3 Column Grid */}
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 w-full max-w-[1600px] mx-auto items-stretch pb-6">

                    {/* Step 1 Task Details */}
                    <div className="xl:col-span-5 relative h-full">
                        <div className="animate-fade-in w-full bg-white p-5 md:p-6 rounded-2xl border-2 border-[#00684A] shadow-sm h-full flex flex-col space-y-4 relative overflow-hidden">
                            <span className="absolute max-md:-top-4 max-md:-right-4 -top-6 -right-6 w-24 h-24 bg-[#00684A]/10 rounded-full -z-10 transition-transform duration-500"></span>
                            <div className="absolute top-4 right-4 text-[11px] font-black tracking-widest uppercase bg-[#00684A]/20 text-[#00684A] px-3 py-1 rounded-full shadow-sm">Card 1</div>
                            <div className="flex items-center gap-3 mb-3 pb-3 border-b border-slate-100 relative">
                                <div className="w-10 h-10 rounded-full bg-[#00684A]/10 flex items-center justify-center text-[#00684A] border border-[#00684A]/20">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-slate-800 tracking-tight">Task Details</h3>
                                    <p className="text-xs text-slate-700 font-medium">Who are you contacting and why?</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="relative">
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 ml-1">Contact <span className="text-red-500">*</span></label>
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        {selectedContacts.map(c => (
                                            <span key={c.id} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#00684A]/10 text-[#00684A] text-xs font-bold border border-[#00684A]/20 shadow-sm animate-fade-in">
                                                {c.name || 'Unknown'} <span className="text-[#00684A]/70 font-mono text-[10px]">({c.phone})</span>
                                                <button type="button" onClick={() => setSelectedContacts(prev => prev.filter(sc => sc.id !== c.id))} className="hover:text-red-500 hover:bg-red-50 text-[#00684A]/60 rounded-full p-0.5 ml-1 transition-colors">
                                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                    <div className="relative group">
                                        <input
                                            type="text"
                                            value={contactSearch}
                                            onChange={(e) => {
                                                setContactSearch(e.target.value);
                                            }}
                                            onKeyDown={handleKeyDown}
                                            onFocus={() => {
                                                if (contacts.length > 0) setShowDropdown(true);
                                            }}
                                            placeholder="Search name/phone or enter number(s)..."
                                            className="block w-full rounded-full border-2 border-slate-200 shadow-sm focus:border-[#00684A] focus:ring-[#00684A]/30 focus:ring-4 text-sm py-2 px-4 transition-all hover:border-[#00684A] bg-white text-slate-800 font-medium placeholder-slate-400"
                                        />
                                        {contactSearch.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={handleAddNumbers}
                                                className="absolute right-2 top-1.5 px-3 py-1 bg-[#00684A] text-white text-[10px] font-bold rounded-full hover:bg-[#00682a] shadow-sm transform active:scale-95 transition-all z-10"
                                            >
                                                Add Number
                                            </button>
                                        )}
                                        {isSearching && (
                                            <div className="absolute right-12 top-3">
                                                <svg className="animate-spin h-5 w-5 text-brand-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                            </div>
                                        )}
                                    </div>

                                    <p className="text-[10px] text-slate-500 mt-2 ml-2 italic">
                                        Tip: Paste comma-separated numbers (e.g. 9988776655, 1122334455) to bulk add.
                                    </p>

                                    {showDropdown && contacts.length > 0 && (
                                        <div className="absolute z-50 w-full bg-white border border-slate-100 rounded-xl shadow-2xl mt-2 max-h-60 overflow-y-auto custom-scrollbar animate-fade-in">
                                            {contacts.map(c => (
                                                <div
                                                    key={c.id}
                                                    onClick={() => {
                                                        addContact(c);
                                                        setContactSearch('');
                                                        setShowDropdown(false);
                                                    }}
                                                    className="p-3 hover:bg-[#00684A]/10 cursor-pointer border-b border-slate-50 last:border-0 group transition-colors"
                                                >
                                                    <div className="font-bold text-slate-800 group-hover:text-[#00684A]">{c.name || 'Unknown User'}</div>
                                                    <div className="text-xs text-slate-700 font-mono group-hover:text-[#00684A]">{c.phone}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {contactSearch.length > 2 && contacts.length === 0 && !isSearching && selectedContacts.length === 0 && (
                                        <div className="text-xs text-red-500 mt-1.5 font-bold ml-1 flex items-center gap-1">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                            Contact not found. Please add them first.
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 ml-1">Title <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        placeholder="e.g. Initial Consultation..."
                                        className="block w-full rounded-full border border-slate-300 shadow-sm focus:border-[#00684A] focus:ring-[#00684A]/30 focus:ring-4 text-sm py-2 px-4 transition-all hover:border-[#00684A] bg-white text-slate-800 font-medium placeholder-slate-400"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 ml-1">Type</label>
                                    <div className="relative">
                                        <select
                                            value={formData.type}
                                            onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                                            className="block w-full rounded-full border border-slate-300 shadow-sm focus:border-[#00684A] focus:ring-[#00684A]/30 focus:ring-4 text-sm py-2 px-4 transition-all hover:border-[#00684A] bg-white text-slate-800 font-medium placeholder-slate-400 appearance-none cursor-pointer"
                                        >
                                            <option value="CALL">📞 phone Call</option>
                                            <option value="EMAIL">✉️ Email</option>
                                            <option value="WHATSAPP">💬 WhatsApp</option>
                                            <option value="MEETING">🤝 Meeting</option>
                                            <option value="TASK">📋 Todo Task</option>
                                        </select>
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-700">
                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 ml-1">Priority</label>
                                    <div className="relative">
                                        <select
                                            value={formData.priority}
                                            onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                                            className="block w-full rounded-full border border-slate-300 shadow-sm focus:border-[#00684A] focus:ring-[#00684A]/30 focus:ring-4 text-sm py-2 px-4 transition-all hover:border-[#00684A] bg-white text-slate-800 font-medium placeholder-slate-400 appearance-none cursor-pointer"
                                        >
                                            <option value="LOW">🟢 Low</option>
                                            <option value="MEDIUM">🟡 Medium</option>
                                            <option value="HIGH">🔴 High</option>
                                        </select>
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-700">
                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {formData.type === 'WHATSAPP' && (
                                <div className="bg-[#00684A]/10/50 p-5 rounded-xl border border-[#00684A]/20 shadow-inner">
                                    <label className="block text-xs font-black text-[#00684A] mb-2 uppercase tracking-wide flex items-center gap-1.5">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                                        Recommended WhatsApp Template
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={selectedTemplateId}
                                            onChange={(e) => setSelectedTemplateId(e.target.value)}
                                            className="block w-full rounded-xl border-brand-200 shadow-sm focus:border-[#00684A] focus:ring-[#00684A]/30 focus:ring-4 sm:text-sm py-2 px-3 bg-white text-brand-900 appearance-none"
                                        >
                                            <option value="">-- Auto-populate description with a template? --</option>
                                            {templates.map(t => (
                                                <option key={t.id} value={t.id}>{t.name} ({t.status})</option>
                                            ))}
                                        </select>
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-brand-500">
                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="pt-2 flex-1 flex flex-col">
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 ml-1">Detailed Notes</label>
                                <textarea
                                    style={{ flex: 1 }}
                                    rows={4}
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="block w-full rounded-2xl border border-slate-300 shadow-sm focus:border-[#00684A] focus:ring-[#00684A]/30 focus:ring-4 text-sm py-3 px-4 transition-all hover:border-[#00684A] bg-white text-slate-800 font-medium placeholder-slate-400 resize-y leading-relaxed"
                                    placeholder="Add all the context about why you are following up..."
                                />
                            </div>
                        </div>
                    </div>

                    {/* Step 2 Schedule */}
                    <div className="xl:col-span-3 relative h-full">
                        <div className="animate-fade-in w-full bg-white p-5 md:p-6 rounded-2xl border-2 border-blue-500 shadow-sm h-full flex flex-col space-y-4 relative overflow-hidden">
                            <span className="absolute max-md:-top-4 max-md:-right-4 -top-6 -right-6 w-24 h-24 bg-blue-50 rounded-full -z-10 transition-transform duration-500"></span>
                            <div className="absolute top-4 right-4 text-[11px] font-black tracking-widest uppercase bg-blue-100 text-blue-700 px-3 py-1 rounded-full shadow-sm">Card 2</div>
                            <div className="flex items-center gap-3 mb-1 pb-3 border-b border-slate-100">
                                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-slate-800 tracking-tight">Schedule</h3>
                                    <p className="text-xs text-slate-700 font-medium">When should this happen?</p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 ml-1">
                                    {selectedCampaignId ? 'Sequence Deadline' : 'Task Date & Time'} <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type="datetime-local"
                                        required
                                        value={formData.scheduled_at}
                                        onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
                                        className="block w-full rounded-full border border-slate-300 shadow-sm focus:border-[#00684A] focus:ring-[#00684A]/30 focus:ring-4 text-sm py-2 px-4 transition-all hover:border-[#00684A] bg-white text-slate-800 font-medium placeholder-slate-400 cursor-pointer [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:p-1 [&::-webkit-calendar-picker-indicator]:opacity-60 hover:[&::-webkit-calendar-picker-indicator]:opacity-100"
                                    />

                                </div>
                                {selectedCampaignId && (
                                    <p className="text-[11px] text-purple-600 mt-2 font-bold ml-1 flex items-center gap-1.5 bg-purple-50 p-2 rounded-lg border border-purple-100">
                                        <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" /></svg>
                                        Sequence loops stop on this date/time.
                                    </p>
                                )}
                            </div>

                            <div className={`border p-5 rounded-2xl transition-all duration-300 mt-4 ${recurrence.enabled ? 'bg-blue-50/50 border-blue-200 ring-1 ring-blue-200 shadow-sm' : 'bg-slate-50/50 border-slate-200 hover:border-slate-300'}`}>
                                <div className="flex items-start gap-3 mb-1">
                                    <div className="relative flex items-center mt-1">
                                        <input
                                            type="checkbox"
                                            checked={recurrence.enabled}
                                            onChange={(e) => setRecurrence({ ...recurrence, enabled: e.target.checked })}
                                            id="recurrence-check"
                                            className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-[#00684A]/30 focus:ring-4 transition-all cursor-pointer shadow-sm"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label htmlFor="recurrence-check" className="text-sm font-bold text-slate-800 cursor-pointer select-none block">Recurring Task?</label>
                                        <p className="text-[11px] text-slate-700 mt-0.5 leading-snug">Auto-recreates on completion.</p>
                                    </div>
                                </div>

                                {recurrence.enabled && (
                                    <div className="space-y-4 animate-fade-in pl-1 mt-5 border-t border-blue-100 pt-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-700 mb-1.5 block">Frequency</label>
                                                <div className="relative">
                                                    <select
                                                        value={recurrence.frequency}
                                                        onChange={(e) => setRecurrence({ ...recurrence, frequency: e.target.value as any })}
                                                        className="block w-full rounded-full border border-slate-300 shadow-sm focus:border-[#00684A] focus:ring-[#00684A]/30 focus:ring-4 text-sm py-2 px-4 transition-all hover:border-[#00684A] bg-white text-slate-800 font-medium placeholder-slate-400 appearance-none cursor-pointer"
                                                    >
                                                        <option value="daily">Daily</option>
                                                        <option value="weekly">Weekly</option>
                                                        <option value="monthly">Monthly</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-700 mb-1.5 block">Repeat Every</label>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        value={recurrence.interval}
                                                        onChange={(e) => setRecurrence({ ...recurrence, interval: parseInt(e.target.value) })}
                                                        className="block w-20 rounded-full border border-slate-300 shadow-sm focus:border-[#00684A] focus:ring-[#00684A]/30 focus:ring-4 text-sm py-1.5 px-3 transition-all hover:border-[#00684A] bg-white text-slate-800 font-bold text-center appearance-none"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-700 mb-1.5 block">End Date (Optional)</label>
                                            <input
                                                type="date"
                                                value={recurrence.end_date}
                                                onChange={(e) => setRecurrence({ ...recurrence, end_date: e.target.value })}
                                                className="block w-full rounded-full border border-slate-300 shadow-sm focus:border-[#00684A] focus:ring-[#00684A]/30 focus:ring-4 text-sm py-2 px-4 transition-all hover:border-[#00684A] bg-white text-slate-800 font-medium placeholder-slate-400"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Theme Automation graphic to fill white space */}
                            <div className="flex-1 mt-6 pt-6 flex flex-col items-center justify-center text-center opacity-80 hover:opacity-100 transition-opacity bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl group/clock">
                                <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center mb-3 text-[#00684A] border border-slate-100 relative group-hover/clock:shadow-md transition-all">
                                    <div className="absolute inset-0 rounded-full border-2 border-[#00684A]/20 border-t-[#00684A] animate-spin"></div>
                                    <svg className="w-8 h-8 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </div>
                                <h4 className="text-[11px] font-black text-[#00684A] tracking-widest uppercase mb-1">Schedule Sync</h4>
                                <p className="text-xs text-slate-700 px-4 font-medium leading-relaxed max-w-[220px]">Tasks execute with precision up to <span className="text-slate-700 font-bold">±60 secs</span> of scheduled time.</p>
                            </div>
                        </div>
                    </div>

                    {/* Step 3 Automate */}
                    <div className="xl:col-span-4 relative h-full">
                        <div className="animate-fade-in w-full bg-white p-5 md:p-6 rounded-2xl border-2 border-purple-500 shadow-sm h-full flex flex-col space-y-4 relative overflow-hidden">
                            <span className="absolute max-md:-top-4 max-md:-right-4 -top-6 -right-6 w-24 h-24 bg-purple-100 rounded-full -z-10 transition-transform duration-500"></span>
                            <div className="absolute top-4 right-4 text-[11px] font-black tracking-widest uppercase bg-purple-200 text-purple-800 px-3 py-1 rounded-full shadow-sm z-10">Card 3</div>

                            <div className="flex items-center gap-3 mb-5">
                                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 border border-purple-200">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-purple-900 tracking-tight">Automate</h3>
                                    <p className="text-xs text-purple-600 font-medium">Start a Nurture Sequence</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex gap-2 items-center">
                                    <div className="flex-1 flex gap-2">
                                        <div className="relative flex-1">
                                            <select
                                                value={selectedCampaignId}
                                                onChange={(e) => setSelectedCampaignId(e.target.value)}
                                                className="block w-full rounded-full border border-slate-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 text-sm py-2 px-4 transition-all hover:border-[#00684A] bg-white text-slate-800 font-medium placeholder-slate-400 appearance-none cursor-pointer"
                                            >
                                                <option value="">-- No Sequence selected --</option>
                                                {activeCampaigns.map(c => (
                                                    <option key={c.id} value={c.id}>
                                                        {c.name} {c.status === 'DRAFT' ? '[DRAFT]' : '✓'}
                                                    </option>
                                                ))}
                                            </select>
                                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-purple-500">
                                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                            </div>
                                        </div>

                                        {selectedCampaignId && (
                                            <button
                                                type="button"
                                                title="Edit selected Sequence"
                                                onClick={() => {
                                                    // Explicitly save draft before navigating
                                                    const state = {
                                                        formData,
                                                        selectedContacts,
                                                        selectedCampaignId,
                                                        isLooping,
                                                        notificationRules
                                                    };
                                                    sessionStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(state));
                                                    // Pass the ID as a second argument (casting onNavigate if needed or handling in App)
                                                    if (onNavigate) {
                                                        onNavigate('EDIT_DRIP', selectedCampaignId);
                                                    }
                                                }}
                                                className="shrink-0 flex items-center justify-center p-3 bg-white border border-purple-200 text-purple-600 rounded-xl hover:bg-purple-50 hover:border-purple-300 shadow-sm active:scale-95 transition-all w-12 h-12"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        title="Create a new Sequence"
                                        onClick={() => {
                                            // Explicitly save draft before navigating
                                            const state = {
                                                formData,
                                                selectedContacts,
                                                selectedCampaignId,
                                                isLooping,
                                                notificationRules
                                            };
                                            sessionStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(state));
                                            onNavigate && onNavigate('CREATE_DRIP');
                                        }}
                                        className="shrink-0 flex items-center justify-center p-3 bg-white border border-purple-200 text-purple-600 rounded-xl hover:bg-purple-50 hover:border-purple-300 shadow-sm active:scale-95 transition-all w-12 h-12"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                    </button>
                                </div>

                                {activeCampaigns.length === 0 && (
                                    <p className="text-xs text-purple-600 bg-white border border-purple-100 rounded-xl p-3 flex items-center gap-2">
                                        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        No sequences yet. Create one by clicking the + icon.
                                    </p>
                                )}

                                <div className="flex items-start gap-3 p-3.5 bg-white/60 rounded-xl border border-purple-100 shadow-sm">
                                    <input
                                        type="checkbox"
                                        checked={isLooping}
                                        onChange={(e) => setIsLooping(e.target.checked)}
                                        className="mt-0.5 h-5 w-5 text-purple-600 rounded border-purple-300 focus:ring-purple-500 transition-all cursor-pointer shadow-sm"
                                    />
                                    <div>
                                        <span className="text-sm font-black text-purple-900 block mb-0.5 tracking-tight">Loop continuously?</span>
                                        <p className="text-[11px] text-purple-600/80 leading-relaxed font-medium">
                                            Wait & repeat from Day 1 until deadline date.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Optimization: Cleaner sequence view when none selected */}
                            {!selectedCampaignId && (
                                <div className="flex-1 mt-6 pt-10 flex flex-col items-center justify-center text-center opacity-90 transition-opacity bg-slate-50/50 border-2 border-dashed border-purple-200 rounded-3xl group/drip shadow-inner">
                                    <div className="w-16 h-16 rounded-3xl bg-white shadow-xl flex items-center justify-center mb-4 text-purple-600 border border-purple-50 relative group-hover/drip:scale-110 transition-transform duration-500">
                                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-purple-500 rounded-full border-2 border-white flex items-center justify-center shadow-lg">
                                            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                                        </div>
                                        <svg className="w-8 h-8 opacity-90" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                    </div>
                                    <h4 className="text-[10px] font-black text-purple-900 tracking-[0.2em] uppercase mb-2">Ready for Automation</h4>
                                    <p className="text-xs text-slate-500 px-8 font-medium leading-relaxed max-w-[240px]">
                                        Connect a <span className="text-purple-700 font-bold">Nurture Sequence</span> to automate your follow-up outreach.
                                    </p>
                                </div>
                            )}
                        </div>

                        {selectedCampaignId && (
                            <div className="mt-5 border-t border-purple-200/60 pt-5">
                                <div className="flex justify-between items-center mb-4">
                                    <label className="text-xs font-black text-purple-900 uppercase tracking-widest flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                        </svg>
                                        Alerts
                                    </label>

                                    <button
                                        type="button"
                                        onClick={() => setNotificationRules([...notificationRules, { phone: '', value: 1, unit: 'HOURS' }])}
                                        className="text-xs bg-white text-purple-700 px-3 py-1.5 rounded-lg hover:bg-purple-50 font-bold border border-purple-200 transition-all flex items-center gap-1 shadow-sm"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                        Add
                                    </button>
                                </div>

                                {notificationRules.length === 0 && (
                                    <div className="text-[11px] text-purple-500/70 font-medium italic text-center py-4 bg-white/50 rounded-xl border border-dashed border-purple-200">
                                        No alerts set.
                                    </div>
                                )}

                                <div className="space-y-3">
                                    {notificationRules.map((rule, i) => (
                                        <div key={i} className="relative bg-white p-3.5 rounded-xl border border-purple-100 shadow-sm group overflow-visible">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const newRules = notificationRules.filter((_, idx) => idx !== i);
                                                    setNotificationRules(newRules);
                                                }}
                                                className="absolute -top-2 -right-2 bg-white text-slate-600 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-full shadow border border-slate-200 transition-all z-10 opacity-0 group-hover:opacity-100"
                                                title="Remove Rule"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>

                                            <div className="space-y-3">
                                                <div className="flex bg-slate-50 border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 ring-purple-500/20 focus-within:border-purple-300 transition-all">
                                                    <div className="bg-slate-100 px-3 flex items-center border-r border-slate-200 text-slate-700">
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                                    </div>
                                                    <input
                                                        type="text"
                                                        placeholder="Alert WhatsApp no."
                                                        value={rule.phone}
                                                        onChange={(e) => {
                                                            const newRules = [...notificationRules];
                                                            newRules[i].phone = e.target.value;
                                                            setNotificationRules(newRules);
                                                        }}
                                                        className="w-full border-0 focus:ring-0 text-sm py-2 px-3 bg-transparent font-medium"
                                                    />
                                                </div>

                                                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 ring-purple-500/20 focus-within:border-purple-300 transition-all">
                                                    <div className="bg-slate-100 px-3 flex items-center border-r border-slate-200 text-slate-700">
                                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                    </div>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={rule.value}
                                                        onChange={(e) => {
                                                            const newRules = [...notificationRules];
                                                            newRules[i].value = parseInt(e.target.value) || 1;
                                                            setNotificationRules(newRules);
                                                        }}
                                                        className="w-16 border-0 focus:ring-0 text-sm py-2 bg-transparent font-black"
                                                    />
                                                    <select
                                                        value={rule.unit}
                                                        onChange={(e) => {
                                                            const newRules = [...notificationRules];
                                                            newRules[i].unit = e.target.value;
                                                            setNotificationRules(newRules);
                                                        }}
                                                        className="flex-1 border-0 focus:ring-0 text-[11px] py-2 bg-transparent font-bold cursor-pointer"
                                                    >
                                                        <option value="MINUTES">MINS</option>
                                                        <option value="HOURS">HOURS</option>
                                                        <option value="DAYS">DAYS</option>
                                                    </select>
                                                    <span className="text-[10px] pr-3 font-bold text-slate-400">BEFORE</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="bg-white p-4 border-t border-slate-200 mt-auto sticky bottom-0 z-40 rounded-t-2xl flex flex-col md:flex-row justify-between items-center gap-4 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]">
                <p className="text-xs text-slate-700 font-medium w-full md:w-auto text-center md:text-left">
                    {selectedCampaignId ? (
                        <span className="flex items-center justify-center md:justify-start gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
                            Sequence starts immediately on save.
                        </span>
                    ) : 'Ready to schedule?'}
                </p>
                <div className="flex gap-3 w-full md:w-auto">
                    <button
                        type="button"
                        onClick={() => {
                            clearDraft();
                            onCancel();
                        }}
                        className="flex-1 md:flex-none px-6 py-3 text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-xl font-bold transition-all shadow-sm"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isBulkCreating}
                        className={`flex-1 md:flex-none px-8 py-3 ${isBulkCreating ? 'bg-slate-400' : 'bg-[#00684A] hover:bg-[#004e38] shadow-lg shadow-[#00684A]/30 hover:shadow-[#00684A]/40'} text-white rounded-xl font-bold transform active:scale-[0.98] transition-all flex items-center justify-center gap-2 border ${isBulkCreating ? 'border-slate-300' : 'border-[#00684A]'}`}
                    >
                        <svg className={`w-5 h-5 ${isBulkCreating ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        {isBulkCreating ? 'Syncing Contacts...' : 'Save Task'}
                    </button>
                </div>
            </div>
        </form>
    );
};

export default FollowUpForm;
