import React, { useState, useEffect, useRef } from 'react';
import { FollowUp } from '../../services/followUpService';
import { contactService } from '../../services/contactService';
import { dripCampaignService, DripCampaign } from '../../services/dripCampaignService';
import { supabase } from '../../lib/supabase';

interface FollowUpFormProps {
    initialData?: Partial<FollowUp>;
    onSave: (data: Partial<FollowUp>) => Promise<void>;
    onCancel: () => void;
}

const FollowUpForm: React.FC<FollowUpFormProps> = ({ initialData, onSave, onCancel }) => {
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

    useEffect(() => {
        // Sync formData with initialData when it changes
        if (initialData) {
            setFormData(prev => ({
                ...prev,
                ...initialData,
                type: (initialData.type?.toUpperCase() as any) || 'CALL',
                priority: (initialData.priority?.toUpperCase() as any) || 'MEDIUM',
                scheduled_at: formatDateForInput(initialData.scheduled_at)
            }));
        }

        if (initialData?.recurrence_rule) {
            setRecurrence({
                enabled: true,
                ...initialData.recurrence_rule
            });
        }
        loadTemplates();
        loadCampaigns();

        // Pre-fill contact search if editing
        if (initialData?.contacts) {
            // Handle both array and object structure for contacts
            const contact = Array.isArray(initialData.contacts) ? initialData.contacts[0] : initialData.contacts;

            if (contact) {
                const { name, phone } = contact;
                if (name && name !== '~' && name !== 'Unknown') {
                    setContactSearch(`${name} (${phone || 'No Phone'})`);
                } else {
                    setContactSearch(phone || name || '');
                }
            }
        } else if (!initialData?.id) {
            // Reset if adding new
            setContactSearch('');
        }

        // Pre-fill drip campaign if active
        // Handle both array (one-to-many) and object (single relation) structures
        let contactData = initialData?.contacts as any;
        if (Array.isArray(contactData)) contactData = contactData[0];

        if (contactData?.drip_enrollments && Array.isArray(contactData.drip_enrollments)) {
            // Check for any active-like status
            const active = contactData.drip_enrollments.find((e: any) => ['ACTIVE', 'PAUSED', 'PROCESSING'].includes(e.status));

            if (active && active.drip_campaign_id) {
                setSelectedCampaignId(active.drip_campaign_id);

                // Restore settings from the active enrollment
                if (active.stop_at) {
                    // Convert UTC stop_at to local datetime-local string for the input
                    const d = new Date(active.stop_at);
                    const localStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
                    setFormData(prev => ({ ...prev, scheduled_at: localStr }));
                }

                if (active.is_looping !== undefined) setIsLooping(!!active.is_looping);

                if (active.notification_rules && Array.isArray(active.notification_rules)) {
                    setNotificationRules(active.notification_rules);
                }
            }
        }
    }, [initialData]);

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

    const loadCampaigns = async () => {
        try {
            const all = await dripCampaignService.getCampaigns();
            const manual = all.filter(c => c.status === 'ACTIVE' || c.status === 'DRAFT');
            setActiveCampaigns(manual);
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

        if (!formData.contact_id) {
            alert("Please select a valid contact from the list.");
            return;
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

        // 1. Handle Drip Enrollment FIRST to avoid race condition with onSave refresh
        if (selectedCampaignId && formData.contact_id) {
            try {
                // Pass scheduled_at as the "Stop At" date for the drip
                await dripCampaignService.enrollContacts(
                    selectedCampaignId,
                    [formData.contact_id],
                    formData.scheduled_at,
                    notificationRules.filter(r => r.phone && r.value),
                    isLooping
                );
            } catch (e) {
                console.error('Failed to auto-enroll in drip', e);
                // We alert but proceed to save the task so user doesn't lose task data
                alert('Warning: Failed to update Drip Sequence settings. Task will still be saved.');
            }
        }

        // 2. Save the Follow-Up Task (Triggers parent refresh)
        await onSave(dataToSave);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6 px-1">
            {/* Tip */}
            <div className="bg-blue-50/50 border-l-4 border-blue-500 rounded-r-xl p-4 flex gap-3 shadow-sm">
                <div className="text-blue-500 shrink-0 mt-0.5">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                </div>
                <p className="text-sm text-blue-900 font-medium leading-relaxed">
                    <strong>Tip:</strong> Follow-ups are personal reminders. Use <strong>Drip Campaigns</strong> for automated messaging sequences.
                </p>
            </div>

            {/* Contact & Title */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="relative" ref={searchRef}>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 ml-1">Contact <span className="text-red-500">*</span></label>
                    <div className="relative group">
                        <input
                            type="text"
                            value={contactSearch}
                            onChange={(e) => {
                                setContactSearch(e.target.value);
                                if (formData.contact_id) setFormData({ ...formData, contact_id: '' });
                            }}
                            onFocus={() => {
                                if (contacts.length > 0) setShowDropdown(true);
                            }}
                            placeholder="Search name or phone..."
                            className="block w-full rounded-xl border-slate-200 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm py-2.5 px-3 transition-all hover:border-brand-300 bg-slate-50 focus:bg-white"
                        />
                        {isSearching && (
                            <div className="absolute right-3 top-2.5">
                                <svg className="animate-spin h-5 w-5 text-brand-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            </div>
                        )}
                    </div>

                    {showDropdown && contacts.length > 0 && (
                        <div className="absolute z-50 w-full bg-white border border-slate-100 rounded-xl shadow-2xl mt-2 max-h-60 overflow-y-auto custom-scrollbar animate-fade-in">
                            {contacts.map(c => (
                                <div
                                    key={c.id}
                                    onClick={() => {
                                        setFormData({ ...formData, contact_id: c.id });
                                        setContactSearch(`${c.name || 'Unknown'} (${c.phone})`);
                                        setShowDropdown(false);
                                    }}
                                    className="p-3 hover:bg-brand-50 cursor-pointer border-b border-slate-50 last:border-0 group transition-colors"
                                >
                                    <div className="font-bold text-slate-800 group-hover:text-brand-700">{c.name || 'Unknown User'}</div>
                                    <div className="text-xs text-slate-500 font-mono group-hover:text-brand-600">{c.phone}</div>
                                </div>
                            ))}
                        </div>
                    )}
                    {contactSearch.length > 2 && contacts.length === 0 && !isSearching && !formData.contact_id && (
                        <div className="text-xs text-red-500 mt-1 font-bold ml-1">
                            Contact not found. Please add them to Contacts first.
                        </div>
                    )}
                </div>

                <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 ml-1">Title</label>
                    <input
                        type="text"
                        required
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="e.g. Account Review..."
                        className="block w-full rounded-xl border-slate-200 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm py-2.5 px-3 transition-all hover:border-brand-300 bg-slate-50 focus:bg-white"
                    />
                </div>
            </div>

            {/* Type & Priority */}
            <div className="grid grid-cols-2 gap-6">
                <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 ml-1">Type</label>
                    <select
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                        className="block w-full rounded-xl border-slate-200 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm py-2.5 px-3 bg-slate-50 focus:bg-white"
                    >
                        <option value="CALL">Call</option>
                        <option value="EMAIL">Email</option>
                        <option value="WHATSAPP">WhatsApp</option>
                        <option value="MEETING">Meeting</option>
                        <option value="TASK">Task</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 ml-1">Priority</label>
                    <select
                        value={formData.priority}
                        onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                        className="block w-full rounded-xl border-slate-200 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm py-2.5 px-3 bg-slate-50 focus:bg-white"
                    >
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                    </select>
                </div>
            </div>

            {/* Template Selector */}
            {formData.type === 'WHATSAPP' && (
                <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/60 shadow-inner">
                    <label className="block text-xs font-black text-slate-400 mb-2 uppercase tracking-wide">Recommended Template</label>
                    <div className="relative">
                        <select
                            value={selectedTemplateId}
                            onChange={(e) => setSelectedTemplateId(e.target.value)}
                            className="block w-full rounded-xl border-slate-200 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm py-2.5 px-3 bg-white"
                        >
                            <option value="">-- No Template --</option>
                            {templates.map(t => (
                                <option key={t.id} value={t.id}>{t.name} ({t.status})</option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2 font-medium ml-1">
                        Selecting this populates the description so you don't forget.
                    </p>
                </div>
            )}

            {/* Drip Campaign Selector */}
            <div className="bg-gradient-to-br from-purple-50 to-white border border-purple-100 rounded-2xl p-6 shadow-sm ring-1 ring-purple-100/50">
                <label className="flex items-center gap-2 text-sm font-bold text-purple-800 mb-4 uppercase tracking-wide">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                    Start a Nurture Sequence? (Optional)
                </label>

                <div className="space-y-4">
                    <select
                        value={selectedCampaignId}
                        onChange={(e) => setSelectedCampaignId(e.target.value)}
                        className="block w-full rounded-xl border-purple-200 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm py-3 px-3 bg-white text-purple-900 font-medium"
                    >
                        <option value="">-- Do Not Start Sequence --</option>
                        {activeCampaigns.map(c => (
                            <option key={c.id} value={c.id}>
                                {c.name} ({c.trigger_type}) {c.status === 'DRAFT' ? '[DRAFT]' : ''}
                            </option>
                        ))}
                    </select>

                    <div className="flex items-start gap-3 p-3 bg-white/60 rounded-xl border border-purple-100">
                        <input
                            type="checkbox"
                            checked={isLooping}
                            onChange={(e) => setIsLooping(e.target.checked)}
                            className="mt-1 h-5 w-5 text-purple-600 rounded border-purple-300 focus:ring-purple-500 transition-all cursor-pointer"
                        />
                        <div>
                            <span className="text-sm font-bold text-slate-700 block mb-0.5">Loop this sequence?</span>
                            <p className="text-xs text-slate-500 leading-snug">
                                Automatically restart from Day 1 after finishing, until the Deadline/Scheduled Date is reached.
                            </p>
                        </div>
                    </div>

                    <p className="text-xs text-purple-600 font-medium italic pl-1 border-l-2 border-purple-300">
                        Sequence starts running <strong>immediately</strong> upon saving.
                    </p>
                </div>

                {/* Notification Rules UI */}
                {selectedCampaignId && (
                    <div className="mt-6 bg-white p-5 rounded-2xl border border-purple-100 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-purple-400 to-purple-600"></div>
                        <div className="flex justify-between items-center mb-4 pl-2">
                            <label className="text-xs font-black text-slate-700 uppercase tracking-wide flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                </svg>
                                Owner Notifications
                            </label>

                            <button
                                type="button"
                                onClick={() => setNotificationRules([...notificationRules, { phone: '', value: 1, unit: 'HOURS' }])}
                                className="text-xs bg-purple-50 text-purple-700 px-3 py-1.5 rounded-lg hover:bg-purple-100 font-bold border border-purple-200 transition-all flex items-center gap-1 hover:shadow-sm"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Add Rule
                            </button>
                        </div>

                        {notificationRules.length === 0 && (
                            <div className="text-xs text-slate-400 italic text-center py-6 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 mx-2">
                                No notifications configured. You won't be alerted.
                            </div>
                        )}

                        <div className="space-y-4 px-1">
                            {notificationRules.map((rule, i) => (
                                <div key={i} className="relative bg-slate-50 p-4 rounded-2xl border border-slate-200 hover:border-purple-300 transition-all hover:shadow-md shadow-sm group/rule overflow-visible">
                                    {/* Remove Button (Top Right Absolute) */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const newRules = notificationRules.filter((_, idx) => idx !== i);
                                            setNotificationRules(newRules);
                                        }}
                                        className="absolute -top-2 -right-2 bg-white text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-full shadow-sm border border-slate-200 transition-all z-10 opacity-0 group-hover/rule:opacity-100"
                                        title="Remove Rule"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>

                                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
                                        {/* Number Input (Larger Share - 7/12) */}
                                        <div className="sm:col-span-7">
                                            <label className="text-[10px] uppercase text-slate-500 font-bold mb-1.5 block pl-1 tracking-wider">WhatsApp Number</label>
                                            <div className="relative group/input w-full">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <svg className="h-4 w-4 text-slate-400 group-focus-within/input:text-purple-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                                    </svg>
                                                </div>
                                                <input
                                                    type="text"
                                                    placeholder="e.g. 919876543210"
                                                    value={rule.phone}
                                                    onChange={(e) => {
                                                        const newRules = [...notificationRules];
                                                        newRules[i].phone = e.target.value;
                                                        setNotificationRules(newRules);
                                                    }}
                                                    className="block w-full rounded-xl border-slate-200 shadow-sm focus:border-purple-500 focus:ring-purple-500 text-sm py-2.5 pl-10 pr-3 bg-white transition-all hover:border-purple-200 font-medium text-slate-700 tracking-wide placeholder:text-slate-300"
                                                />
                                            </div>
                                            <p className="text-[10px] text-slate-400 mt-1 pl-1">With country code (no +)</p>
                                        </div>

                                        {/* Time Input (Smaller Share - 5/12) */}
                                        <div className="sm:col-span-5">
                                            <label className="text-[10px] uppercase text-slate-500 font-bold mb-1.5 block pl-1 tracking-wider">Trigger Time</label>
                                            <div className="flex items-center w-full gap-2">
                                                <div className="flex items-center shadow-sm rounded-xl overflow-hidden border border-slate-200 focus-within:ring-2 focus-within:ring-purple-500 focus-within:border-purple-500 transition-all w-full bg-white">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={rule.value}
                                                        onChange={(e) => {
                                                            const newRules = [...notificationRules];
                                                            newRules[i].value = parseInt(e.target.value) || 0;
                                                            setNotificationRules(newRules);
                                                        }}
                                                        className="w-full min-w-[3rem] px-2 py-2.5 text-sm border-0 focus:ring-0 bg-transparent text-center font-bold text-slate-700"
                                                    />
                                                    <div className="h-6 w-px bg-slate-200 shrink-0"></div>
                                                    <select
                                                        value={rule.unit}
                                                        onChange={(e) => {
                                                            const newRules = [...notificationRules];
                                                            newRules[i].unit = e.target.value;
                                                            setNotificationRules(newRules);
                                                        }}
                                                        className="text-sm border-0 px-2 py-2.5 bg-transparent hover:bg-slate-50 cursor-pointer focus:ring-0 text-slate-600 font-bold w-full text-center"
                                                    >
                                                        <option value="MINUTES">Mins</option>
                                                        <option value="HOURS">Hours</option>
                                                        <option value="DAYS">Days</option>
                                                    </select>
                                                </div>
                                                <span className="text-[9px] uppercase text-slate-400 font-bold shrink-0 self-center leading-tight">Before<br />Due</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Date & Time */}
            <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 ml-1">
                    {selectedCampaignId ? 'Stop Nurturing At (Deadline)' : 'Task Date & Time'}
                </label>
                <div className="relative">
                    <input
                        type="datetime-local"
                        required
                        value={formData.scheduled_at}
                        onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
                        className="block w-full rounded-xl border-slate-200 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm py-2.5 px-3 transition-all hover:border-brand-300 font-mono text-slate-700 bg-slate-50 focus:bg-white"
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                </div>
                {selectedCampaignId && (
                    <p className="text-xs text-slate-500 mt-2 font-medium ml-1 flex items-center gap-1">
                        <svg className="w-3 h-3 text-brand-500" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" /></svg>
                        Sequence loops until this date.
                    </p>
                )}
            </div>

            <div className={`border p-5 rounded-2xl transition-all duration-300 ${recurrence.enabled ? 'bg-brand-50 border-brand-200 ring-1 ring-brand-200 shadow-sm' : 'bg-slate-50/50 border-slate-200 hover:border-slate-300'}`}>
                <div className="flex items-center gap-3 mb-4">
                    <div className="relative flex items-center">
                        <input
                            type="checkbox"
                            checked={recurrence.enabled}
                            onChange={(e) => setRecurrence({ ...recurrence, enabled: e.target.checked })}
                            id="recurrence-check"
                            className="w-5 h-5 text-brand-600 rounded border-slate-300 focus:ring-brand-500 transition-all cursor-pointer"
                        />
                    </div>
                    <div>
                        <label htmlFor="recurrence-check" className="text-sm font-bold text-slate-800 cursor-pointer select-none">Make this a Recurring Task?</label>
                        <p className="text-xs text-slate-500 mt-0.5">Automated task creation based on schedule.</p>
                    </div>
                </div>

                {recurrence.enabled && (
                    <div className="grid grid-cols-2 gap-4 animate-fade-in pl-1">
                        <div>
                            <label className="text-xs font-bold uppercase text-slate-500 mb-1.5 block">Frequency</label>
                            <select
                                value={recurrence.frequency}
                                onChange={(e) => setRecurrence({ ...recurrence, frequency: e.target.value as any })}
                                className="block w-full rounded-xl border-slate-200 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm py-2 px-3 bg-white"
                            >
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                                <option value="monthly">Monthly</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase text-slate-500 mb-1.5 block">Every (Interval)</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    min={1}
                                    value={recurrence.interval}
                                    onChange={(e) => setRecurrence({ ...recurrence, interval: parseInt(e.target.value) })}
                                    className="block w-20 rounded-xl border-slate-200 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm py-2 px-3 bg-white"
                                />
                                <span className="text-xs font-bold text-slate-600 uppercase">
                                    {recurrence.frequency === 'daily' ? 'Days' : recurrence.frequency === 'weekly' ? 'Weeks' : 'Months'}
                                </span>
                            </div>
                        </div>
                        <div className="col-span-2">
                            <label className="text-xs font-bold uppercase text-slate-500 mb-1.5 block">End Date (Optional)</label>
                            <input
                                type="date"
                                value={recurrence.end_date}
                                onChange={(e) => setRecurrence({ ...recurrence, end_date: e.target.value })}
                                className="block w-full rounded-xl border-slate-200 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm py-2 px-3 bg-white"
                            />
                        </div>
                    </div>
                )}
            </div>

            <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 ml-1">Description</label>
                <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="block w-full rounded-xl border-slate-200 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm py-2.5 px-3 transition-all hover:border-brand-300 bg-slate-50 focus:bg-white resize-y"
                    placeholder="Add notes about this follow-up..."
                />
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-6 py-2.5 text-slate-600 hover:bg-slate-100/80 rounded-xl font-bold border border-transparent hover:border-slate-200 transition-all"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    className="px-6 py-2.5 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 shadow-lg shadow-brand-200 hover:shadow-brand-300 transform active:scale-[0.98] transition-all flex items-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Save Follow-Up
                </button>
            </div>
        </form>
    );
};

export default FollowUpForm;
