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
    const [initialModalTab, setInitialModalTab] = useState<string>('opportunity');

    useEffect(() => {
        const syncFollowUps = async () => {
            try {
                const [tasks, pipelineTasks] = await Promise.all([
                    followUpService.getFollowUps({ status: 'PENDING' }),
                    getTasks()
                ]);
                
                tasks.forEach(task => {
                    if (task.scheduled_at) {
                        const isQuickAlarm = task.title && task.title.startsWith('[QUICK_ALARM]');
                        
                        const subtitleParts = [];
                        if (task.description) subtitleParts.push(`📝 ${task.description}`);
                        
                        const contactName = task.contacts?.name || (task.contacts as any)?.whatsapp_name || 'Unknown';
                        const contactPhone = task.contacts?.phone ? ` (${task.contacts.phone})` : '';
                        const pipelineName = (task.contacts as any)?.pipelines?.name || 'No Pipeline';
                        const leadIdSnippet = task.contact_id ? ` [ID: ${task.contact_id.substring(0,6)}]` : '';
                        
                        if (isQuickAlarm && task.contacts?.phone) {
                            subtitleParts.push(`📞 ${task.contacts.phone}`);
                        } else if (!isQuickAlarm) {
                            subtitleParts.push(`👤 Contact: ${contactName}${contactPhone}${leadIdSnippet}`);
                        }
                        subtitleParts.push(`📊 Pipeline: ${pipelineName}`);
                        
                        const finalSubtitle = subtitleParts.join('\n');

                        reminderManager.addReminder({
                            id: task.id,
                            title: task.title,
                            subtitle: finalSubtitle,
                            scheduledAt: new Date(task.scheduled_at),
                            data: { contactId: task.contact_id, description: task.description },
                            onAction: (data) => {
                                if (data.contactId) {
                                    window.dispatchEvent(new CustomEvent('open-contact-modal', { 
                                        detail: { contactId: data.contactId, initialTab: 'follow-up' } 
                                    }));
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
                        const pipelineName = t.leads?.pipelines?.name || 'No Pipeline';
                        const leadIdSnippet = t.lead_id ? ` [ID: ${t.lead_id.substring(0,6)}]` : '';
                        
                        const subtitleParts = [];
                        if (t.description) subtitleParts.push(`📝 ${t.description}`);
                        subtitleParts.push(`👤 CRM Lead: ${contactName}${contactPhone}${leadIdSnippet}`);
                        subtitleParts.push(`📊 Pipeline: ${pipelineName}`);
                        
                        const scheduledTime = new Date(new Date(t.due_date).getTime() - 15 * 60000);
                        
                        reminderManager.addReminder({
                            id: `crm_${t.id}`,
                            title: `[CRM Task] ${t.title}`,
                            subtitle: subtitleParts.join('\n'),
                            scheduledAt: scheduledTime,
                            data: { contactId: t.lead_id, description: t.description },
                            onAction: (data) => {
                                if (data.contactId) {
                                    window.dispatchEvent(new CustomEvent('open-contact-modal', { 
                                        detail: { contactId: data.contactId, initialTab: 'follow-up' } 
                                    }));
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
                                const pipelineName = (contactData as any)?.pipelines?.name || 'No Pipeline';
                                const leadIdSnippet = task.contact_id ? ` [ID: ${task.contact_id.substring(0,6)}]` : '';
                                
                                const isQuickAlarm = task.title && task.title.startsWith('[QUICK_ALARM]');
                                const subtitleParts = [];
                                if (task.description) subtitleParts.push(`📝 ${task.description}`);
                                
                                if (isQuickAlarm && contactPhone) {
                                    subtitleParts.push(`📞 ${contactPhone}`);
                                } else if (!isQuickAlarm) {
                                    subtitleParts.push(`👤 Contact: ${contactName}${phoneStr}${leadIdSnippet}`);
                                }
                                subtitleParts.push(`📊 Pipeline: ${pipelineName}`);
                                
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
                                const pipelineName = fullTask.leads?.pipelines?.name || 'No Pipeline';
                                const leadIdSnippet = fullTask.lead_id ? ` [ID: ${fullTask.lead_id.substring(0,6)}]` : '';
                                
                                const subtitleParts = [];
                                if (fullTask.description) subtitleParts.push(`📝 ${fullTask.description}`);
                                subtitleParts.push(`👤 CRM Lead: ${contactName}${contactPhone}${leadIdSnippet}`);
                                subtitleParts.push(`📊 Pipeline: ${pipelineName}`);
                                
                                // Schedule 15 minutes before due date as per UI
                                const scheduledTime = new Date(new Date(t.due_date).getTime() - 15 * 60000);
                                
                                reminderManager.addReminder({
                                    id: `crm_${t.id}`,
                                    title: `[CRM Task] ${t.title}`,
                                    subtitle: subtitleParts.join('\n'),
                                    scheduledAt: scheduledTime,
                                    data: { contactId: t.lead_id, description: t.description },
                                    onAction: (data) => {
                                        if (data.contactId) {
                                            window.dispatchEvent(new CustomEvent('open-contact-modal', { 
                                                detail: { contactId: data.contactId, initialTab: 'follow-up' } 
                                            }));
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
            const customEvent = e as CustomEvent<{ contactId: string, initialTab?: string }>;
            if (customEvent.detail?.contactId) {
                setSelectedLeadId(customEvent.detail.contactId);
                // The actual tab opening logic is handled in LeadEditModal if we pass a prop
                // But since FollowUpGlobalSync maintains the modal, we need to pass initialTab
                setInitialModalTab(customEvent.detail.initialTab || 'opportunity');
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
            initialTab={initialModalTab}
        />
    );
};

export default FollowUpGlobalSync;
