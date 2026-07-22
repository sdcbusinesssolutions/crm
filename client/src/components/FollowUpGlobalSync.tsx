import React, { useEffect, useState } from 'react';
import { followUpService } from '../services/followUpService';
import { getLead } from '../services/lead-management-api';
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
                const tasks = await followUpService.getFollowUps({ status: 'PENDING' });
                
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
            } catch (err) {
                console.error("Failed to sync follow-ups", err);
            }
        };

        // Fetch on mount
        syncFollowUps();

        // WebSocket (Supabase Realtime) Subscription
        const channel = supabase
            .channel('public:follow_ups')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'follow_ups' },
                (payload) => {
                    console.log('Realtime Follow-up Update received!', payload);
                    
                    if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                        const task = payload.new as any;
                        if (task.status === 'PENDING' && task.scheduled_at) {
                            // Fetch full task details (including joined contacts) to avoid relying on a new backend route
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
                            }).catch(() => {
                                // Fallback if fetch fails
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
                                        } else {
                                            alert("No Lead record found for this contact in the CRM. Please create a Lead first to view details.");
                                        }
                                    }
                                });
                            });
                        } else if (task.status !== 'PENDING') {
                            // If it was marked completed/cancelled, remove the reminder
                            reminderManager.removeReminder(task.id);
                        }
                    } else if (payload.eventType === 'DELETE') {
                        const oldTask = payload.old as any;
                        reminderManager.removeReminder(oldTask.id);
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
            supabase.removeChannel(channel);
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
