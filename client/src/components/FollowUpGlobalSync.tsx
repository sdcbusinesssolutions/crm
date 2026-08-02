import React, { useEffect, useState } from 'react';
import { followUpService } from '../services/followUpService';
import { getLead, getTasks } from '../services/lead-management-api';
import { contactService } from '../services/contactService';
import { reminderManager } from '../utils/reminderManager';
import LeadEditModal from './LeadEditModal';
import { supabase } from '../lib/supabase';

export const FollowUpGlobalSync: React.FC = () => {
    const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
    const [isLeadEditModalOpen, setIsLeadEditModalOpen] = useState(false);

    useEffect(() => {
        const syncFollowUps = async () => {
            try {
                const [tasks, pipelineTasks] = await Promise.all([
                    followUpService.getFollowUps({ status: 'PENDING' }),
                    getTasks()
                ]);
                
                tasks.forEach(task => {
                    if (task.scheduled_at) {
                        const contactPhone = task.contacts?.phone ? ` (${task.contacts.phone})` : '';
                        const contactName = task.contacts?.name || 'Unknown';
                        const isQuickAlarm = task.title && task.title.startsWith('[QUICK_ALARM]');
                        
                        const subtitleParts = [];
                        if (task.description) subtitleParts.push(`📝 ${task.description}`);
                        
                        if (isQuickAlarm && task.contacts?.phone) {
                            subtitleParts.push(`📞 ${task.contacts.phone}`);
                        } else if (!isQuickAlarm) {
                            subtitleParts.push(`👤 Contact: ${contactName}${contactPhone}`);
                        }
                        
                        const finalSubtitle = subtitleParts.join('\n');

                        reminderManager.addReminder({
                            id: task.id,
                            title: task.title,
                            subtitle: finalSubtitle,
                            scheduledAt: new Date(task.scheduled_at),
                            data: { contactId: task.contact_id, description: task.description },
                            onAction: (data) => {
                                if (data.contactId) {
                                    setSelectedLeadId(data.contactId);
                                    setIsLeadEditModalOpen(true);
                                } else {
                                    alert("No Lead record found for this contact in the CRM. Please create a Lead first to view details.");
                                }
                            }
                        });
                    }
                });

                // Sync CRM Tasks with enable_popup
                pipelineTasks.forEach((t: any) => {
                    if (!t.is_completed && t.due_date && t.metadata?.enable_popup === true) {
                        const contactPhone = t.leads?.phone ? ` (${t.leads.phone})` : '';
                        const contactName = t.leads?.name || 'Unknown';
                        
                        const subtitleParts = [];
                        if (t.description) subtitleParts.push(`📝 ${t.description}`);
                        subtitleParts.push(`👤 CRM Lead: ${contactName}${contactPhone}`);
                        if (t.leads?.pipelines && t.leads.pipelines.length > 0) {
                            subtitleParts.push(`💼 Pipeline: ${t.leads.pipelines[0].name}`);
                        }
                        
                        reminderManager.addReminder({
                            id: `crm_${t.id}`,
                            title: `[CRM Task] ${t.title}`,
                            subtitle: subtitleParts.join('\n'),
                            scheduledAt: new Date(t.due_date),
                            data: { contactId: t.lead_id, description: t.description },
                            onAction: (data) => {
                                if (data.contactId) {
                                    setSelectedLeadId(data.contactId);
                                    setIsLeadEditModalOpen(true);
                                }
                            }
                        });
                    }
                });
            } catch (err) {
                console.error("Failed to sync follow-ups", err);
            }
        };

        // Fetch on mount
        syncFollowUps();

        // WebSocket (Supabase Realtime) Subscription for Follow-ups
        const followUpsChannel = supabase
            .channel('public:follow_ups')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'follow_ups' },
                (payload) => {
                    if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                        const task = payload.new as any;
                        if (task.status === 'PENDING' && task.scheduled_at) {
                            followUpService.getFollowUps({ status: 'PENDING' }).then((tasks) => {
                                const fullTask = tasks.find(t => t.id === task.id);
                                const contactData = fullTask?.contacts;
                                const contactName = contactData?.name || (contactData as any)?.whatsapp_name || 'Unknown';
                                const contactPhone = contactData?.phone || '';
                                const phoneStr = contactPhone ? ` (${contactPhone})` : '';
                                
                                const isQuickAlarm = task.title && task.title.startsWith('[QUICK_ALARM]');
                                const subtitleParts = [];
                                if (task.description) subtitleParts.push(`📝 ${task.description}`);
                                
                                if (isQuickAlarm && contactPhone) {
                                    subtitleParts.push(`📞 ${contactPhone}`);
                                } else if (!isQuickAlarm) {
                                    subtitleParts.push(`👤 Contact: ${contactName}${phoneStr}`);
                                }
                                
                                reminderManager.addReminder({
                                    id: task.id,
                                    title: task.title,
                                    subtitle: subtitleParts.join('\n'), 
                                    scheduledAt: new Date(task.scheduled_at),
                                    data: { contactId: task.contact_id, description: task.description },
                                    onAction: (data) => {
                                        if (data.contactId) {
                                            setSelectedLeadId(data.contactId);
                                            setIsLeadEditModalOpen(true);
                                        }
                                    }
                                });
                            }).catch(() => {
                                reminderManager.addReminder({
                                    id: task.id,
                                    title: task.title,
                                    subtitle: task.description ? `📝 ${task.description}` : `👤 Contact ID: ${task.contact_id}`, 
                                    scheduledAt: new Date(task.scheduled_at),
                                    data: { contactId: task.contact_id, description: task.description },
                                    onAction: (data) => {
                                        if (data.contactId) {
                                            setSelectedLeadId(data.contactId);
                                            setIsLeadEditModalOpen(true);
                                        }
                                    }
                                });
                            });
                        } else if (task.status !== 'PENDING') {
                            reminderManager.removeReminder(task.id);
                        }
                    } else if (payload.eventType === 'DELETE') {
                        const oldTask = payload.old as any;
                        reminderManager.removeReminder(oldTask.id);
                    }
                }
            )
            .subscribe();

        // WebSocket Subscription for CRM Tasks
        const tasksChannel = supabase
            .channel('public:tasks')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'tasks' },
                (payload) => {
                    if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                        const t = payload.new as any;
                        if (!t.is_completed && t.due_date && t.metadata?.enable_popup === true) {
                            getTasks().then(pipelineTasks => {
                                const fullTask = pipelineTasks.find(pt => pt.id === t.id);
                                if (!fullTask) return;
                                
                                const contactPhone = fullTask.leads?.phone ? ` (${fullTask.leads.phone})` : '';
                                const contactName = fullTask.leads?.name || 'Unknown';
                                
                                const subtitleParts = [];
                                if (fullTask.description) subtitleParts.push(`📝 ${fullTask.description}`);
                                subtitleParts.push(`👤 CRM Lead: ${contactName}${contactPhone}`);
                                
                                reminderManager.addReminder({
                                    id: `crm_${t.id}`,
                                    title: `[CRM Task] ${t.title}`,
                                    subtitle: subtitleParts.join('\n'),
                                    scheduledAt: new Date(t.due_date),
                                    data: { contactId: t.lead_id, description: t.description },
                                    onAction: (data) => {
                                        if (data.contactId) {
                                            setSelectedLeadId(data.contactId);
                                            setIsLeadEditModalOpen(true);
                                        }
                                    }
                                });
                            });
                        } else {
                            // If completed, or enable_popup is false, remove the reminder
                            reminderManager.removeReminder(`crm_${t.id}`);
                        }
                    } else if (payload.eventType === 'DELETE') {
                        const oldTask = payload.old as any;
                        reminderManager.removeReminder(`crm_${oldTask.id}`);
                    }
                }
            )
            .subscribe();

        const handleOpenModal = (e: Event) => {
            const customEvent = e as CustomEvent<{ contactId: string }>;
            if (customEvent.detail?.contactId) {
                setSelectedLeadId(customEvent.detail.contactId);
                setIsLeadEditModalOpen(true);
            }
        };
        window.addEventListener('open-contact-modal', handleOpenModal);

        return () => {
            supabase.removeChannel(followUpsChannel);
            supabase.removeChannel(tasksChannel);
            window.removeEventListener('open-contact-modal', handleOpenModal);
        };
    }, []);

    return (
        <LeadEditModal 
            isOpen={isLeadEditModalOpen}
            onClose={() => setIsLeadEditModalOpen(false)}
            leadId={selectedLeadId}
        />
    );
};

export default FollowUpGlobalSync;
