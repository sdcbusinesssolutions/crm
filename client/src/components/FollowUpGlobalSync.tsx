import React, { useEffect, useState } from 'react';
import { followUpService } from '../services/followUpService';
import { getLead } from '../services/lead-management-api';
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
                        reminderManager.addReminder({
                            id: task.id,
                            title: task.title,
                            subtitle: task.description ? `📝 ${task.description}\n👤 Contact: ${task.contacts?.name || 'Unknown'}${contactPhone}` : `👤 Contact: ${task.contacts?.name || 'Unknown'}${contactPhone}`,
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
                            // Fetch contact name for realtime event
                            getLead(task.contact_id).then(leadData => {
                                const contactName = (leadData as any)?.contacts?.name || (leadData as any)?.contacts?.whatsapp_name || leadData?.name || 'Unknown';
                                const contactPhone = (leadData as any)?.contacts?.phone || leadData?.phone || '';
                                const phoneStr = contactPhone ? ` (${contactPhone})` : '';
                                reminderManager.addReminder({
                                    id: task.id,
                                    title: task.title,
                                    subtitle: task.description ? `📝 ${task.description}\n👤 Contact: ${contactName}${phoneStr}` : `👤 Contact: ${contactName}${phoneStr}`, 
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
