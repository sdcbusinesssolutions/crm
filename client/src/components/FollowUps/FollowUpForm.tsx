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
    const [formData, setFormData] = useState<Partial<FollowUp>>({
        title: '',
        description: '',
        scheduled_at: '',
        status: 'PENDING',
        priority: 'MEDIUM',
        type: 'CALL',
        recurrence_rule: null,
        contact_id: '',
        ...initialData
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
    const [isLooping, setIsLooping] = useState(false); // New state
    const [notificationRules, setNotificationRules] = useState<any[]>([
        { phone: '', value: 24, unit: 'HOURS' }
    ]);

    useEffect(() => {
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
            setContactSearch(initialData.contacts.name || initialData.contacts.phone);
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
        }, 300); // 300ms debounce

        return () => clearTimeout(timeoutId);
    }, [contactSearch]);

    const loadCampaigns = async () => {
        try {
            const all = await dripCampaignService.getCampaigns();
            // Filter to only MANUAL trigger campaigns or those suitable for manual enrollment
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

        const dataToSave = {
            ...formData,
            recurrence_rule: recurrence.enabled ? {
                frequency: recurrence.frequency,
                interval: recurrence.interval,
                end_date: recurrence.end_date
            } : null
        };
        await onSave(dataToSave);

        // Auto-Enroll logic
        if (selectedCampaignId && formData.contact_id) {
            try {
                // Pass scheduled_at as the "Stop At" date for the drip
                await dripCampaignService.enrollContacts(
                    selectedCampaignId,
                    [formData.contact_id],
                    formData.scheduled_at,
                    notificationRules.filter(r => r.phone && r.value),
                    isLooping // <--- Pass new param
                );
            } catch (e) {
                console.error('Failed to auto-enroll in drip', e);
                alert('Follow-up saved, but failed to start Drip Sequence.');
            }
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-700 mb-4">
                <p><strong>Tip:</strong> Follow-ups are reminders for YOU. For automated messages, use Drip Campaigns.</p>
            </div>

            <div className="relative" ref={searchRef}>
                <label className="block text-sm font-medium mb-1">Contact <span className="text-red-500">*</span></label>
                <div className="relative">
                    <input
                        type="text"
                        value={contactSearch}
                        onChange={(e) => {
                            setContactSearch(e.target.value);
                            // Reset contact ID if user types to force re-selection
                            if (formData.contact_id) setFormData({ ...formData, contact_id: '' });
                        }}
                        onFocus={() => {
                            if (contacts.length > 0) setShowDropdown(true);
                        }}
                        placeholder="Search name or phone..."
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 pr-10"
                    />
                    {isSearching && (
                        <div className="absolute right-3 top-2.5">
                            <svg className="animate-spin h-5 w-5 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        </div>
                    )}
                </div>

                {showDropdown && contacts.length > 0 && (
                    <div className="absolute z-50 w-full bg-white border rounded-lg shadow-xl mt-1 max-h-60 overflow-y-auto">
                        {contacts.map(c => (
                            <div
                                key={c.id}
                                onClick={() => {
                                    setFormData({ ...formData, contact_id: c.id });
                                    setContactSearch(`${c.name || 'Unknown'} (${c.phone})`);
                                    setShowDropdown(false);
                                }}
                                className="p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0"
                            >
                                <div className="font-medium text-slate-800">{c.name || 'Unknown User'}</div>
                                <div className="text-xs text-slate-500">{c.phone}</div>
                            </div>
                        ))}
                    </div>
                )}
                {contactSearch.length > 2 && contacts.length === 0 && !isSearching && !formData.contact_id && (
                    <div className="text-xs text-red-500 mt-1">
                        Contact not found. Please add them to Contacts first.
                    </div>
                )}
            </div>

            <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. Weekly Accountability Call"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500"
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium mb-1">Type</label>
                    <select
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500"
                    >
                        <option value="CALL">Call</option>
                        <option value="EMAIL">Email</option>
                        <option value="WHATSAPP">WhatsApp</option>
                        <option value="MEETING">Meeting</option>
                        <option value="TASK">Task</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Priority</label>
                    <select
                        value={formData.priority}
                        onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500"
                    >
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                    </select>
                </div>
            </div>

            {/* Template Selector (Only for WhatsApp) */}
            {formData.type === 'WHATSAPP' && (
                <div className="bg-slate-50 p-3 rounded border border-slate-200">
                    <label className="block text-xs font-bold text-slate-600 mb-1">RECOMMENDED TEMPLATE (OPTIONAL)</label>
                    <select
                        value={selectedTemplateId}
                        onChange={(e) => setSelectedTemplateId(e.target.value)}
                        className="w-full text-sm border-slate-300 rounded"
                    >
                        <option value="">-- No Template --</option>
                        {templates.map(t => (
                            <option key={t.id} value={t.id}>{t.name} ({t.status})</option>
                        ))}
                    </select>
                    <p className="text-[10px] text-slate-500 mt-1">Selecting this will update the task description so you remember which template to send.</p>
                </div>
            )}

            {/* Drip Campaign Selector (New Feature) */}
            <div className={`p-4 rounded-lg border border-purple-200 bg-purple-50`}>
                <label className="block text-sm font-bold text-purple-800 mb-1">
                    START A NURTURE SEQUENCE? (OPTIONAL)
                </label>

                <select
                    value={selectedCampaignId}
                    onChange={(e) => setSelectedCampaignId(e.target.value)}
                    className="w-full text-sm border-purple-300 rounded focus:ring-purple-500 bg-white"
                >
                    <option value="">-- Do Not Start Sequence --</option>
                    {activeCampaigns.map(c => (
                        <option key={c.id} value={c.id}>
                            {c.name} ({c.trigger_type}) {c.status === 'DRAFT' ? '[DRAFT]' : ''}
                        </option>
                    ))}
                </select>
                <div className="flex items-start gap-2 mt-3 p-2 bg-white rounded border border-purple-100">
                    <input
                        type="checkbox"
                        checked={isLooping}
                        onChange={(e) => setIsLooping(e.target.checked)}
                        className="mt-1 w-4 h-4 text-purple-600 rounded focus:ring-purple-500 border-purple-300"
                    />
                    <div>
                        <span className="text-sm font-bold text-slate-700 block">Loop this sequence?</span>
                        <p className="text-xs text-slate-500 leading-tight">
                            If checked, the sequence will <strong>restart from Day 1</strong> automatically after finishing, until the Scheduled Date is reached.
                        </p>
                    </div>
                </div>
                <p className="text-xs text-purple-600 mt-2">
                    If selected, this sequence will start running <strong>immediately</strong> for the contact.
                    Great for keeping them warm until the follow-up date.
                </p>

                {/* Notification Rules UI */}
                {selectedCampaignId && (
                    <div className="mt-4 bg-white p-3 rounded border border-purple-100">
                        <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Owner Notifications</label>
                        {notificationRules.map((rule, i) => (
                            <div key={i} className="flex gap-2 mb-2 items-center">
                                <input
                                    type="text"
                                    placeholder="Phone (e.g. 919999...)"
                                    value={rule.phone}
                                    onChange={(e) => {
                                        const newRules = [...notificationRules];
                                        newRules[i].phone = e.target.value;
                                        setNotificationRules(newRules);
                                    }}
                                    className="w-32 px-2 py-1 text-sm border rounded"
                                />
                                <span className="text-xs text-slate-400">Notify</span>
                                <input
                                    type="number"
                                    value={rule.value}
                                    onChange={(e) => {
                                        const newRules = [...notificationRules];
                                        newRules[i].value = parseInt(e.target.value);
                                        setNotificationRules(newRules);
                                    }}
                                    className="w-16 px-2 py-1 text-sm border rounded"
                                />
                                <select
                                    value={rule.unit}
                                    onChange={(e) => {
                                        const newRules = [...notificationRules];
                                        newRules[i].unit = e.target.value;
                                        setNotificationRules(newRules);
                                    }}
                                    className="text-sm border rounded px-1 py-1"
                                >
                                    <option value="MINUTES">Minutes</option>
                                    <option value="HOURS">Hours</option>
                                    <option value="DAYS">Days</option>
                                </select>
                                <span className="text-xs text-slate-400">Before</span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const newRules = notificationRules.filter((_, idx) => idx !== i);
                                        setNotificationRules(newRules);
                                    }}
                                    className="text-red-400 hover:text-red-600 font-bold px-2"
                                >
                                    &times;
                                </button>
                            </div>
                        ))}
                        <button
                            type="button"
                            onClick={() => setNotificationRules([...notificationRules, { phone: '', value: 1, unit: 'HOURS' }])}
                            className="text-xs text-brand-600 hover:underline font-medium flex items-center gap-1"
                        >
                            + Add Notification Rule
                        </button>
                    </div>
                )}
            </div>



            <div>
                <label className="block text-sm font-medium mb-1">
                    {selectedCampaignId ? 'Stop Nurturing At (Deadline)' : 'Task Date & Time'}
                </label>
                <input
                    type="datetime-local"
                    required
                    value={formData.scheduled_at}
                    onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500"
                />
                {selectedCampaignId && (
                    <p className="text-xs text-slate-500 mt-1">
                        The automated sequence will run/loop until this date and time. Then it stops so you can take over.
                    </p>
                )}
            </div>

            {/* Recurrence Section */}
            <div className={`border p-4 rounded-lg transition-colors ${recurrence.enabled ? 'bg-brand-50 border-brand-200' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center gap-2 mb-2">
                    <input
                        type="checkbox"
                        checked={recurrence.enabled}
                        onChange={(e) => setRecurrence({ ...recurrence, enabled: e.target.checked })}
                        id="recurrence-check"
                        className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
                    />
                    <div>
                        <label htmlFor="recurrence-check" className="text-sm font-bold text-slate-800">Recurring Follow-up?</label>
                        <p className="text-xs text-slate-500">Enable this to repeat this task automatically.</p>
                    </div>
                </div>

                {recurrence.enabled && (
                    <div className="grid grid-cols-2 gap-3 mt-3 animate-fade-in">
                        <div>
                            <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Frequency</label>
                            <select
                                value={recurrence.frequency}
                                onChange={(e) => setRecurrence({ ...recurrence, frequency: e.target.value as any })}
                                className="w-full px-2 py-1.5 text-sm border rounded bg-white focus:ring-1 focus:ring-brand-500"
                            >
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                                <option value="monthly">Monthly</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Every (Interval)</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    min={1}
                                    value={recurrence.interval}
                                    onChange={(e) => setRecurrence({ ...recurrence, interval: parseInt(e.target.value) })}
                                    className="w-20 px-2 py-1.5 text-sm border rounded bg-white focus:ring-1 focus:ring-brand-500"
                                />
                                <span className="text-xs text-slate-600">
                                    {recurrence.frequency === 'daily' ? 'Days' : recurrence.frequency === 'weekly' ? 'Weeks' : 'Months'}
                                </span>
                            </div>
                        </div>
                        <div className="col-span-2">
                            <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">End Date (Optional)</label>
                            <input
                                type="date"
                                value={recurrence.end_date}
                                onChange={(e) => setRecurrence({ ...recurrence, end_date: e.target.value })}
                                className="w-full px-2 py-1.5 text-sm border rounded bg-white focus:ring-1 focus:ring-brand-500"
                            />
                        </div>
                    </div>
                )}
            </div>

            <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500"
                    placeholder="Add notes about this follow-up..."
                />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 shadow-md"
                >
                    Save Follow-Up
                </button>
            </div>
        </form>
    );
};

export default FollowUpForm;
