import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import Toast from './Toast';
import PhoneInputWithCountry from './PhoneInputWithCountry';
import { usePermissions, ACCESS_TYPES } from '../modules/teamStaff/hooks/usePermissions';
import {
    getNotes, createNote, deleteNote,
    getTasks, createTask, updateTask, deleteTask,
    getAppointments, createAppointment, deleteAppointment,
    getCallLogs, createCallLog, deleteCallLog,
    updateLead,
    getPipelines,
    getPipelineStages,
    getLeads,
    getLead
} from '../services/lead-management-api';
import { followUpService } from '../services/followUpService';
import { reminderManager } from '../utils/reminderManager';
import { Lead, Pipeline, PipelineStage } from '../types/lead-management';
import { TrashIcon } from './icons';

interface LeadEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    leadId?: string | null;
    leadData?: Partial<Lead> | null;
    onUpdate?: () => void;
    initialTab?: string;
}

const LeadEditModal: React.FC<LeadEditModalProps> = ({ isOpen, onClose, leadId, leadData, onUpdate, initialTab }) => {
    const parseDate = (d?: string) => {
        if (!d) return new Date();
        return new Date(d.endsWith('Z') ? d : d + 'Z');
    };

    const { hasAccess } = usePermissions();
    const canWrite = hasAccess('Pipelines', ACCESS_TYPES.READ_WRITE);

    const [editingLead, setEditingLead] = useState<Partial<Lead>>({});
    const [leadLoading, setLeadLoading] = useState(false);
    const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info' | 'warning', title: string, message: string } | null>(null);

    const [activeTab, setActiveTab] = useState(initialTab || 'opportunity');
    const [notes, setNotes] = useState<any[]>([]);
    const [tasks, setTasks] = useState<any[]>([]);
    const [appointments, setAppointments] = useState<any[]>([]);
    const [callLogs, setCallLogs] = useState<any[]>([]);
    const [newNote, setNewNote] = useState({ title: '', content: '', tags: '' });
    const [newTask, setNewTask] = useState({ title: '', description: '', due_date: '' });
    const [enablePopup, setEnablePopup] = useState(false);
    const [newAppointment, setNewAppointment] = useState({ title: '', start_time: '', end_time: '', description: '' });
    const [newCallLog, setNewCallLog] = useState({ call_type: 'outbound', duration: 0, notes: '', called_at: '' });

    const [showLocalReminder, setShowLocalReminder] = useState(false);
    const [localReminderTime, setLocalReminderTime] = useState('');
    const [localReminderMessage, setLocalReminderMessage] = useState('');

    const [pipelines, setPipelines] = useState<Pipeline[]>([]);
    const [stages, setStages] = useState<PipelineStage[]>([]);

    useEffect(() => {
        if (isOpen) {
            setActiveTab('opportunity');
            loadPipelines();
            if (leadData) {
                setEditingLead(leadData);
                if (leadData.pipeline_id) {
                    loadStages(leadData.pipeline_id);
                }
            } else if (leadId) {
                loadLeadData(leadId);
            }

            if (leadId || leadData?.id) {
                const idToLoad = leadId || leadData?.id;
                if (idToLoad) {
                    loadRelatedData(idToLoad);
                }
            }
            
            // Auto-fill current time (IST/local) for all date pickers
            const getLocalDatetimeLocal = () => {
                const d = new Date();
                d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
                return d.toISOString().slice(0, 16);
            };
            const nowStr = getLocalDatetimeLocal();
            
            setNewTask(prev => ({ ...prev, due_date: nowStr }));
            setNewAppointment(prev => ({ ...prev, start_time: nowStr, end_time: nowStr }));
            setNewCallLog(prev => ({ ...prev, called_at: nowStr }));

        } else {
            setEditingLead({});
            setNotes([]);
            setTasks([]);
            setAppointments([]);
            setCallLogs([]);
            setNewNote({ title: '', content: '', tags: '' });
            setNewTask({ title: '', description: '', due_date: '' });
            setNewAppointment({ title: '', start_time: '', end_time: '', description: '' });
            setNewCallLog({ call_type: 'outbound', duration: 0, notes: '', called_at: '' });
        }
    }, [isOpen, leadId, leadData]);

    useEffect(() => {
        if (editingLead.pipeline_id) {
            loadStages(editingLead.pipeline_id);
        } else {
            setStages([]);
        }
    }, [editingLead.pipeline_id]);

    const loadPipelines = async () => {
        try {
            const data = await getPipelines();
            setPipelines(data);
        } catch (e) {
            console.error("Error loading pipelines", e);
        }
    };

    const loadStages = async (pipelineId: string) => {
        try {
            const data = await getPipelineStages(pipelineId);
            setStages(data);
        } catch (e) {
            console.error("Error loading stages", e);
        }
    };

    const loadLeadData = async (id: string) => {
        try {
            setLeadLoading(true);
            const response = await getLead(id);
            if (response) {
                setEditingLead(response);
            }
        } catch (e) {
            console.error("Error loading lead", e);
        } finally {
            setLeadLoading(false);
        }
    };

    const loadRelatedData = async (id: string) => {
        try {
            const [fetchedNotes, fetchedTasks, fetchedAppointments, fetchedCallLogs] = await Promise.all([
                getNotes(id),
                getTasks(id),
                getAppointments(id),
                getCallLogs(id)
            ]);
            setNotes(fetchedNotes);
            setTasks(fetchedTasks);
            setAppointments(fetchedAppointments);
            setCallLogs(fetchedCallLogs);
        } catch (e) {
            console.error("Error fetching lead related details", e);
        }
    };

    useEffect(() => {
        if (isOpen && initialTab) {
            setActiveTab(initialTab);
        }
    }, [isOpen, initialTab]);

    const handleSaveLead = async () => {
        if (!canWrite) {
            setToast({ type: 'error', title: 'Permission Denied', message: 'You do not have permission to edit leads.' });
            return;
        }
        if (!editingLead.id) return;
        setLeadLoading(true);
        try {
            // Strip out virtual fields and read-only fields before sending updates
            const { id, created_at, updated_at, count, pipelines, ...cleanUpdates } = editingLead;
            await updateLead(editingLead.id, cleanUpdates);
            setToast({ type: 'success', title: 'Success', message: 'Lead updated successfully.' });
            if (onUpdate) onUpdate();
            onClose();
        } catch (error) {
            console.error('Failed to update lead', error);
            setToast({ type: 'error', title: 'Error', message: 'Failed to update lead.' });
        } finally {
            setLeadLoading(false);
        }
    };

    const handleAddNote = async () => {
        if (!canWrite) return;
        if (!editingLead.id || !newNote.title || !newNote.content) return;
        try {
            await createNote({
                lead_id: editingLead.id,
                title: newNote.title,
                content: newNote.content,
                tags: newNote.tags.split(',').map(t => t.trim()).filter(Boolean)
            });
            const updatedNotes = await getNotes(editingLead.id);
            setNotes(updatedNotes);
            setNewNote({ title: '', content: '', tags: '' });
            setToast({ type: 'success', title: 'Note Added', message: 'Note added successfully.' });
        } catch (e) {
            console.error(e);
            setToast({ type: 'error', title: 'Error', message: 'Failed to add note.' });
        }
    };

    const handleDeleteNote = async (noteId: string) => {
        if (!canWrite) return;
        try {
            await deleteNote(noteId);
            setNotes(notes.filter(n => n.id !== noteId));
            setToast({ type: 'success', title: 'Note Deleted', message: 'Note deleted successfully.' });
        } catch (e) {
            console.error(e);
            setToast({ type: 'error', title: 'Error', message: 'Failed to delete note.' });
        }
    };

    const handleAddFollowUp = async () => {
        if (!canWrite) return;
        if (!editingLead.id || !newTask.title) return;
        try {
            await createTask({
                lead_id: editingLead.id,
                title: newTask.title,
                description: newTask.description,
                due_date: newTask.due_date ? new Date(`${newTask.due_date}+05:30`).toISOString() : null,
                enable_popup: enablePopup
            });

            const updatedTasks = await getTasks(editingLead.id);
            setTasks(updatedTasks);
            
            const getLocalDatetimeLocal = () => {
                const d = new Date();
                d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
                return d.toISOString().slice(0, 16);
            };
            setNewTask({ title: '', description: '', due_date: getLocalDatetimeLocal() });
            
            setEnablePopup(false);
            setToast({ type: 'success', title: 'Task Added', message: 'Follow-up task added successfully.' });
        } catch (e) {
            console.error(e);
            setToast({ type: 'error', title: 'Error', message: 'Failed to add task.' });
        }
    };

    const handleAddAppointment = async () => {
        if (!canWrite) return;
        if (!editingLead.id || !newAppointment.title || !newAppointment.start_time) return;
        try {
            await createAppointment({
                lead_id: editingLead.id,
                title: newAppointment.title,
                start_time: new Date(`${newAppointment.start_time}+05:30`).toISOString(),
                end_time: newAppointment.end_time ? new Date(`${newAppointment.end_time}+05:30`).toISOString() : null,
                description: newAppointment.description
            });
            const updatedAppointments = await getAppointments(editingLead.id);
            setAppointments(updatedAppointments);
            
            const getLocalDatetimeLocal = () => {
                const d = new Date();
                d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
                return d.toISOString().slice(0, 16);
            };
            setNewAppointment({ title: '', start_time: getLocalDatetimeLocal(), end_time: getLocalDatetimeLocal(), description: '' });
            
            setToast({ type: 'success', title: 'Appointment Scheduled', message: 'Appointment added successfully.' });
        } catch (e) {
            console.error(e);
            setToast({ type: 'error', title: 'Error', message: 'Failed to schedule appointment.' });
        }
    };

    const handleAddCallLog = async () => {
        if (!canWrite) return;
        if (!editingLead.id || !newCallLog.called_at) return;
        try {
            await createCallLog({
                lead_id: editingLead.id,
                call_type: newCallLog.call_type as 'inbound' | 'outbound' | 'missed',
                duration: newCallLog.duration,
                notes: newCallLog.notes,
                called_at: newCallLog.called_at
            });
            const updatedCallLogs = await getCallLogs(editingLead.id);
            setCallLogs(updatedCallLogs);
            
            const getLocalDatetimeLocal = () => {
                const d = new Date();
                d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
                return d.toISOString().slice(0, 16);
            };
            setNewCallLog({ call_type: 'outbound', duration: 0, notes: '', called_at: getLocalDatetimeLocal() });
            
            setToast({ type: 'success', title: 'Call Logged', message: 'Call log added successfully.' });
        } catch (e) {
            console.error(e);
            setToast({ type: 'error', title: 'Error', message: 'Failed to log call.' });
        }
    };

    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title={`Contact Info (Edit) | Contact Type: ${editingLead.type || 'Lead'}`}
                size="3xl"
                scrollable={true}
                footer={
                    <div className="flex flex-col w-full gap-2">
                        {showLocalReminder && (
                            <div className="flex flex-col gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg w-full mb-2">
                                <h4 className="font-bold text-sm text-blue-800">Set Custom Reminder</h4>
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <input
                                        type="text"
                                        placeholder="e.g. Call back regarding pricing"
                                        className="flex-1 px-3 py-2 text-sm border rounded bg-white text-black"
                                        value={localReminderMessage}
                                        onChange={e => setLocalReminderMessage(e.target.value)}
                                    />
                                    <input
                                        type="datetime-local"
                                        className="px-3 py-2 text-sm border rounded bg-white text-black"
                                        value={localReminderTime}
                                        onChange={e => setLocalReminderTime(e.target.value)}
                                    />
                                    <button
                                        onClick={async () => {
                                            if (!localReminderTime || !localReminderMessage) {
                                                setToast({ type: 'error', title: 'Error', message: 'Please enter message and time.' });
                                                return;
                                            }
                                            try {
                                                const targetTime = new Date(localReminderTime).getTime();
                                                await createTask({
                                                    lead_id: editingLead.id,
                                                    title: `[QUICK_ALARM] Reminder: ${editingLead.name || 'Contact'}`,
                                                    description: localReminderMessage,
                                                    due_date: new Date(targetTime).toISOString(),
                                                    enable_popup: true
                                                });
                                                
                                                // Refresh tasks list if we are on the Follow-up tab
                                                if (editingLead.id) {
                                                    const updatedTasks = await getTasks(editingLead.id);
                                                    setTasks(updatedTasks);
                                                }
                                                setShowLocalReminder(false);
                                                setLocalReminderMessage('');
                                                setLocalReminderTime('');
                                                setToast({ type: 'success', title: 'Reminder Set', message: 'reminder scheduled!' });
                                            } catch (err) {
                                                console.error('Failed to create quick alarm', err);
                                                setToast({ type: 'error', title: 'Error', message: 'Failed to save reminder' });
                                            }
                                        }}
                                        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700"
                                    >Save</button>
                                </div>
                            </div>
                        )}
                        <div className="flex justify-between w-full">
                            <button
                                onClick={() => {
                                    if (!showLocalReminder) {
                                        const d = new Date();
                                        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
                                        setLocalReminderTime(d.toISOString().slice(0, 16));
                                    }
                                    setShowLocalReminder(!showLocalReminder);
                                }}
                                className="px-4 py-2 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg font-bold transition-all flex items-center gap-2"
                            >
                                <span>⏰</span> Custom Reminder
                            </button>

                            <div className="flex gap-2">
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2 text-[var(--color-text)] opacity-70 hover:opacity-100 hover:bg-[var(--color-bg)] rounded-lg transition-all"
                                >
                                    Cancel
                                </button>
                                {canWrite && (
                                    <button
                                        onClick={handleSaveLead}
                                        disabled={leadLoading}
                                        className="px-4 py-2 bg-[var(--color-brand)] text-white rounded-lg font-bold hover:opacity-90 transition-opacity"
                                    >
                                        {leadLoading ? 'Saving...' : 'UPDATE'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                }
            >
                <div className="flex flex-col h-full">
                    {/* Tabs */}
                    <div className="sticky top-0 z-10 bg-[var(--color-surface)] pb-4 mb-4 border-b border-[var(--color-border)]">
                        <div className="flex gap-2 overflow-x-auto no-scrollbar">
                            {['Opportunity', 'Additional Info', 'Call Logs', 'Follow-up', 'Notes', 'Appointments'].map(tab => {
                                const tabKey = tab.toLowerCase().replace(' ', '_').replace('-', '_');
                                const isActive = activeTab === tabKey || (tabKey === 'follow_up' && activeTab === 'follow_up');
                                return (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tabKey === 'follow_up' ? 'follow_up' : tabKey)}
                                        className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors ${isActive ? 'bg-[var(--color-brand)] text-white' : 'bg-transparent text-[var(--color-text)] hover:bg-[var(--color-bg)]'}`}
                                    >
                                        {tab}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                        {activeTab === 'opportunity' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold mb-1 text-[var(--color-text)]">Opportunity Name</label>
                                    <input
                                        type="text"
                                        value={editingLead.name || ''}
                                        onChange={(e) => setEditingLead({ ...editingLead, name: e.target.value })}
                                        className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-1 text-[var(--color-text)]">Contact Name <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        value={editingLead.name || ''}
                                        onChange={(e) => setEditingLead({ ...editingLead, name: e.target.value })}
                                        className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-1 text-[var(--color-text)]">Email</label>
                                    <input
                                        type="email"
                                        value={editingLead.email || ''}
                                        onChange={(e) => setEditingLead({ ...editingLead, email: e.target.value })}
                                        className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-1 text-[var(--color-text)]">Phone</label>
                                    <PhoneInputWithCountry
                                        value={editingLead.phone || ''}
                                        onChange={(val) => setEditingLead({ ...editingLead, phone: val })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-1 text-[var(--color-text)]">City</label>
                                    <input
                                        type="text"
                                        value={editingLead.custom_data?.city || ''}
                                        onChange={(e) => setEditingLead({ ...editingLead, custom_data: { ...editingLead.custom_data, city: e.target.value } })}
                                        className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-1 text-[var(--color-text)]">Pipeline <span className="text-red-500">*</span></label>
                                    <select
                                        value={editingLead.pipeline_id || ''}
                                        onChange={(e) => setEditingLead({ ...editingLead, pipeline_id: e.target.value })}
                                        className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                    >
                                        <option value="">Select Pipeline</option>
                                        {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-1 text-[var(--color-text)]">Stage <span className="text-red-500">*</span></label>
                                    <select
                                        value={editingLead.stage_id || ''}
                                        onChange={(e) => setEditingLead({ ...editingLead, stage_id: e.target.value })}
                                        className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                    >
                                        <option value="">Select Stage</option>
                                        {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-1 text-[var(--color-text)]">Created At</label>
                                    <input
                                        type="text"
                                        disabled
                                        value={editingLead.created_at ? parseDate(editingLead.created_at).toLocaleString() : ''}
                                        className="w-full border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] opacity-60 rounded-lg px-3 py-2 text-sm outline-none cursor-not-allowed"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-1 text-[var(--color-text)]">Tags</label>
                                    <input
                                        type="text"
                                        placeholder="Add tags separated by comma"
                                        value={editingLead.tags?.join(', ') || ''}
                                        onChange={(e) => setEditingLead({ ...editingLead, tags: e.target.value.split(',').map(t => t.trim()) })}
                                        className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-1 text-[var(--color-text)]">Type</label>
                                    <select
                                        value={editingLead.type || 'Lead'}
                                        onChange={(e) => setEditingLead({ ...editingLead, type: e.target.value })}
                                        className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                    >
                                        <option value="Lead">Lead</option>
                                        <option value="Customer">Customer</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-1 text-[var(--color-text)]">Lead Value</label>
                                    <input
                                        type="number"
                                        value={editingLead.estimated_value || ''}
                                        onChange={(e) => setEditingLead({ ...editingLead, estimated_value: parseFloat(e.target.value) })}
                                        className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-1 text-[var(--color-text)]">Status</label>
                                    <select
                                        value={editingLead.status || 'active'}
                                        onChange={(e) => setEditingLead({ ...editingLead, status: e.target.value })}
                                        className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                    >
                                        <option value="active">Active</option>
                                        <option value="Hot">Hot</option>
                                        <option value="Warm">Warm</option>
                                        <option value="Cold">Cold</option>
                                        <option value="Won">Won</option>
                                        <option value="Lost">Lost</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {activeTab === 'additional_info' && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold mb-1 text-[var(--color-text)]">Company</label>
                                        <input
                                            type="text"
                                            value={editingLead.company || ''}
                                            onChange={(e) => setEditingLead({ ...editingLead, company: e.target.value })}
                                            className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold mb-1 text-[var(--color-text)]">Source</label>
                                        <input
                                            type="text"
                                            value={editingLead.source || ''}
                                            onChange={(e) => setEditingLead({ ...editingLead, source: e.target.value as any })}
                                            className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <h3 className="font-bold text-[var(--color-text)] mt-4 mb-2">Custom Fields</h3>
                                    {editingLead.custom_fields && Object.keys(editingLead.custom_fields).length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {Object.entries(editingLead.custom_fields).map(([key, val]) => (
                                                <div key={key}>
                                                    <label className="block text-xs font-bold mb-1 text-[var(--color-text)] opacity-70 capitalize">{key.replace(/_/g, ' ')}</label>
                                                    <input
                                                        type="text"
                                                        value={String(val)}
                                                        disabled
                                                        className="w-full border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] opacity-60 rounded-lg px-3 py-2 text-sm outline-none cursor-not-allowed"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-[var(--color-text)] opacity-50">No custom fields data.</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'call_logs' && (
                            <div className="space-y-4">
                                {canWrite && (
                                    <div className="bg-[var(--color-bg)] p-4 rounded-xl border border-[var(--color-border)] space-y-3">
                                        <h3 className="font-bold text-[var(--color-text)]">Log a Call</h3>
                                        <div className="grid grid-cols-3 gap-3">
                                            <div>
                                                <label className="block text-xs font-bold mb-1 text-[var(--color-text)] opacity-70">Type</label>
                                                <select
                                                    value={newCallLog.call_type}
                                                    onChange={(e) => setNewCallLog({ ...newCallLog, call_type: e.target.value })}
                                                    className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                                >
                                                    <option value="outbound">Outbound</option>
                                                    <option value="inbound">Inbound</option>
                                                    <option value="missed">Missed</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold mb-1 text-[var(--color-text)] opacity-70">Duration (mins)</label>
                                                <input
                                                    type="number"
                                                    value={newCallLog.duration}
                                                    onChange={(e) => setNewCallLog({ ...newCallLog, duration: parseInt(e.target.value) || 0 })}
                                                    className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold mb-1 text-[var(--color-text)] opacity-70">Time</label>
                                                <input
                                                    type="datetime-local"
                                                    value={newCallLog.called_at}
                                                    onChange={(e) => setNewCallLog({ ...newCallLog, called_at: e.target.value })}
                                                    className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                                />
                                            </div>
                                        </div>
                                        <textarea
                                            placeholder="Call notes..."
                                            value={newCallLog.notes}
                                            onChange={(e) => setNewCallLog({ ...newCallLog, notes: e.target.value })}
                                            className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none h-16 resize-none"
                                        />
                                        <button
                                            onClick={handleAddCallLog}
                                            className="px-4 py-2 bg-[var(--color-brand)] text-white rounded-lg font-bold hover:opacity-90 transition-opacity float-right"
                                        >
                                            Log Call
                                        </button>
                                        <div className="clear-both"></div>
                                    </div>
                                )}
                                <div className="space-y-3">
                                    <h3 className="font-bold text-[var(--color-text)]">Recent Calls</h3>
                                    {callLogs.length === 0 && <p className="text-sm text-[var(--color-text)] opacity-50">No call logs found.</p>}
                                    {callLogs.map(log => (
                                        <div key={log.id} className="p-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-sm">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${log.call_type === 'inbound' ? 'bg-green-100 text-green-700' :
                                                    log.call_type === 'outbound' ? 'bg-blue-100 text-blue-700' :
                                                        'bg-red-100 text-red-700'
                                                    }`}>
                                                    {log.call_type.toUpperCase()}
                                                </span>
                                                <span className="text-xs text-[var(--color-text)] opacity-50">
                                                    {new Date(log.called_at.endsWith('Z') ? log.called_at : log.called_at + 'Z').toLocaleString()} ({log.duration} mins)
                                                </span>
                                            </div>
                                            <p className="text-sm text-[var(--color-text)] opacity-80">{log.notes}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'follow_up' && (
                            <div className="space-y-4">
                                {canWrite && (
                                    <div className="bg-[var(--color-bg)] p-4 rounded-xl border border-[var(--color-border)] space-y-3">
                                        <h3 className="font-bold text-[var(--color-text)]">Add Follow-up Task</h3>
                                        <input
                                            type="text"
                                            placeholder="Follow-up Title"
                                            value={newTask.title}
                                            onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                                            className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                        />
                                        <textarea
                                            placeholder="Description"
                                            value={newTask.description}
                                            onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                                            className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none h-20 resize-none"
                                        />
                                        <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
                                            <div className="flex items-center mt-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                                                <input
                                                    type="checkbox"
                                                    id="enablePopup"
                                                    className="w-4 h-4 text-blue-600 bg-white border-blue-300 rounded focus:ring-blue-500 focus:ring-2"
                                                    checked={enablePopup}
                                                    onChange={(e) => setEnablePopup(e.target.checked)}
                                                />
                                                <label htmlFor="enablePopup" className="ml-2 text-sm font-medium text-blue-900 cursor-pointer flex-1">
                                                    Enable Popup Alarm (5 mins before)
                                                </label>
                                            </div>
                                            <div className="flex gap-2 items-center w-full sm:w-auto">
                                                <input
                                                    type="datetime-local"
                                                    value={newTask.due_date}
                                                    onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                                                    className="flex-1 sm:w-48 border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                                />
                                                <button
                                                    onClick={handleAddFollowUp}
                                                    className="px-6 py-2 bg-[var(--color-brand)] text-white rounded-lg font-bold hover:opacity-90 transition-opacity"
                                                >
                                                    ADD
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div className="space-y-3">
                                    <h3 className="font-bold text-[var(--color-text)]">Tasks</h3>
                                    {tasks.length === 0 && <p className="text-sm text-[var(--color-text)] opacity-50">No tasks found.</p>}
                                    {[...tasks].sort((a, b) => new Date((b.created_at || '').endsWith('Z') ? b.created_at : b.created_at + 'Z').getTime() - new Date((a.created_at || '').endsWith('Z') ? a.created_at : a.created_at + 'Z').getTime()).map(task => (
                                        <div key={task.id} className="p-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-sm flex items-start gap-3">
                                            <input
                                                type="checkbox"
                                                checked={task.is_completed}
                                                readOnly
                                                className="mt-1 rounded text-[var(--color-brand)] focus:ring-[var(--color-brand)]"
                                            />
                                            <div className="flex-1">
                                                <div className="flex justify-between">
                                                    <h4 className={`font-bold text-sm ${task.is_completed ? 'line-through opacity-50' : ''} text-[var(--color-text)]`}>{task.title}</h4>
                                                    <span className="text-xs text-[var(--color-text)] opacity-50 whitespace-nowrap ml-4">{task.due_date ? new Date(task.due_date.endsWith('Z') ? task.due_date : task.due_date + 'Z').toLocaleString() : 'No date'}</span>
                                                </div>
                                                <p className={`text-xs mt-1 ${task.is_completed ? 'opacity-30' : 'opacity-70'} text-[var(--color-text)]`}>{task.description}</p>
                                                
                                                <div className="flex items-center gap-1.5 mt-2">
                                                    <div className="flex items-center gap-1 px-2 py-0.5 bg-slate-100 rounded text-[10px] text-slate-500 font-medium border border-slate-200">
                                                        <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                        </svg>
                                                        <span>{task.created_by_name || 'System'} on {task.created_at ? parseDate(task.created_at).toLocaleString() : ''}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'notes' && (
                            <div className="space-y-4">
                                {canWrite && (
                                    <div className="bg-[var(--color-bg)] p-4 rounded-xl border border-[var(--color-border)] space-y-3">
                                        <h3 className="font-bold text-[var(--color-text)]">Add Note</h3>
                                        <input
                                            type="text"
                                            placeholder="Note Title"
                                            value={newNote.title}
                                            onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                                            className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                        />
                                        <textarea
                                            placeholder="Type your note here..."
                                            value={newNote.content}
                                            onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
                                            className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none h-24 resize-none"
                                        />
                                        <div className="flex gap-2 items-center">
                                            <input
                                                type="text"
                                                placeholder="Tags (comma separated)"
                                                value={newNote.tags}
                                                onChange={(e) => setNewNote({ ...newNote, tags: e.target.value })}
                                                className="flex-1 border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                            />
                                            <button
                                                onClick={handleAddNote}
                                                className="px-6 py-2 bg-[var(--color-brand)] text-white rounded-lg font-bold hover:opacity-90 transition-opacity"
                                            >
                                                SAVE
                                            </button>
                                        </div>
                                    </div>
                                )}
                                <div className="space-y-3 mt-4">
                                    {notes.map(note => (
                                        <div key={note.id} className="p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-sm relative group">
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="font-bold text-[var(--color-text)]">{note.title}</h4>
                                                <span className="text-xs text-[var(--color-text)] opacity-50">
                                                    {new Date(note.created_at.endsWith('Z') ? note.created_at : note.created_at + 'Z').toLocaleString()}
                                                </span>
                                            </div>
                                            <p className="text-sm text-[var(--color-text)] opacity-80 whitespace-pre-wrap">{note.content}</p>
                                            {note.tags && note.tags.length > 0 && (
                                                <div className="flex gap-1 mt-3 flex-wrap">
                                                    {note.tags.map((tag: string, i: number) => (
                                                        <span key={i} className="px-2 py-1 bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-xs text-[var(--color-text)] opacity-70">
                                                            #{tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                            {canWrite && (
                                                <button
                                                    onClick={() => handleDeleteNote(note.id)}
                                                    className="absolute top-2 right-2 p-1.5 bg-red-50 text-red-500 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100"
                                                >
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    {notes.length === 0 && <p className="text-center text-sm text-[var(--color-text)] opacity-50 py-8">No notes yet.</p>}
                                </div>
                            </div>
                        )}

                        {activeTab === 'appointments' && (
                            <div className="space-y-4">
                                {canWrite && (
                                    <div className="bg-[var(--color-bg)] p-4 rounded-xl border border-[var(--color-border)] space-y-3">
                                        <h3 className="font-bold text-[var(--color-text)]">Schedule Appointment</h3>
                                        <input
                                            type="text"
                                            placeholder="Title"
                                            value={newAppointment.title}
                                            onChange={(e) => setNewAppointment({ ...newAppointment, title: e.target.value })}
                                            className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                        />
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-bold mb-1 text-[var(--color-text)] opacity-70">Start Time</label>
                                                <input
                                                    type="datetime-local"
                                                    value={newAppointment.start_time}
                                                    onChange={(e) => setNewAppointment({ ...newAppointment, start_time: e.target.value })}
                                                    className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold mb-1 text-[var(--color-text)] opacity-70">End Time</label>
                                                <input
                                                    type="datetime-local"
                                                    value={newAppointment.end_time}
                                                    onChange={(e) => setNewAppointment({ ...newAppointment, end_time: e.target.value })}
                                                    className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                                />
                                            </div>
                                        </div>
                                        <textarea
                                            placeholder="Description"
                                            value={newAppointment.description}
                                            onChange={(e) => setNewAppointment({ ...newAppointment, description: e.target.value })}
                                            className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none h-20 resize-none"
                                        />
                                        <button
                                            onClick={handleAddAppointment}
                                            className="px-4 py-2 bg-[var(--color-brand)] text-white rounded-lg font-bold hover:opacity-90 transition-opacity float-right"
                                        >
                                            Schedule
                                        </button>
                                        <div className="clear-both"></div>
                                    </div>
                                )}
                                <div className="space-y-3">
                                    <h3 className="font-bold text-[var(--color-text)]">Upcoming Appointments</h3>
                                    {appointments.length === 0 && <p className="text-sm text-[var(--color-text)] opacity-50">No appointments found.</p>}
                                    {appointments.map(apt => (
                                        <div key={apt.id} className="p-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-sm">
                                            <div className="flex justify-between">
                                                <h4 className="font-bold text-sm text-[var(--color-text)]">{apt.title}</h4>
                                                <span className="text-xs text-[var(--color-text)] opacity-50">
                                                    {new Date(apt.start_time.endsWith('Z') ? apt.start_time : apt.start_time + 'Z').toLocaleString()}
                                                </span>
                                            </div>
                                            <p className="text-xs text-[var(--color-text)] opacity-70 mt-1">{apt.description}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </Modal>
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

export default LeadEditModal;
