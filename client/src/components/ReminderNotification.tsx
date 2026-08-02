import React, { useState, useEffect, useCallback } from 'react';
import { reminderManager, ReminderConfig } from '../utils/reminderManager';
import { followUpService } from '../services/followUpService';

export const ReminderNotification: React.FC = () => {
    const [activeReminders, setActiveReminders] = useState<ReminderConfig[]>([]);
    const [currentPage, setCurrentPage] = useState(0);

    useEffect(() => {
        // Request desktop notification permission on load
        if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
            Notification.requestPermission();
        }

        const handleReminderFired = (event: Event) => {
            const customEvent = event as CustomEvent<{ reminder: ReminderConfig }>;
            const reminder = customEvent.detail.reminder;
            
            // Fire desktop notification if user is on another tab
            if ('Notification' in window && Notification.permission === 'granted') {
                if (document.hidden || !document.hasFocus()) {
                    const notification = new Notification('⏰ ' + reminder.title, {
                        body: reminder.subtitle || 'You have a new reminder in your CRM',
                        requireInteraction: true
                    });
                    
                    notification.onclick = () => {
                        window.focus();
                        notification.close();
                    };
                }
            }
            
            setActiveReminders(prev => {
                if (prev.find(r => r.id === reminder.id)) return prev;
                return [...prev, reminder];
            });
        };

        window.addEventListener('reminder-fired', handleReminderFired);
        return () => window.removeEventListener('reminder-fired', handleReminderFired);
    }, []);

    const handleDismiss = async (id: string) => {
        reminderManager.dismissReminder(id);
        setActiveReminders(prev => prev.filter(r => r.id !== id));
        
        // Mark as completed in the database so it doesn't come back on refresh
        try {
            if (id.startsWith('crm_')) {
                const taskId = id.replace('crm_', '');
                await fetch(`/api/tasks/${taskId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify({ is_completed: true })
                });
            } else {
                await followUpService.updateFollowUp(id, { status: 'COMPLETED' });
            }
        } catch (err) {
            console.error('Failed to mark task as completed', err);
        }
    };

    const handleAction = (reminder: ReminderConfig) => {
        if (reminder.onAction) {
            reminder.onAction(reminder.data);
        }
        if (reminder.data?.contactId) {
            window.dispatchEvent(new CustomEvent('open-contact-modal', { detail: { contactId: reminder.data.contactId } }));
        }
        handleDismiss(reminder.id);
    };

    const handleSnooze = (reminder: ReminderConfig) => {
        handleDismiss(reminder.id);
        // Re-add it 10 minutes from now. (10 mins + 15 min offset for the manager)
        reminderManager.addReminder({
            ...reminder,
            scheduledAt: new Date(Date.now() + 25 * 60 * 1000),
            persistLocally: true // Ensure snoozed items persist
        });
    };

    if (activeReminders.length === 0) return null;

    const MAX_VISIBLE = 3;
    const totalPages = Math.ceil(activeReminders.length / MAX_VISIBLE);
    
    // Ensure currentPage is valid if items are removed
    let safePage = currentPage;
    if (safePage >= totalPages) {
        safePage = Math.max(0, totalPages - 1);
        if (currentPage !== safePage) {
            setCurrentPage(safePage);
        }
    }

    const visibleReminders = activeReminders.slice(
        safePage * MAX_VISIBLE,
        (safePage + 1) * MAX_VISIBLE
    );

    return (
        <div className="fixed top-20 right-8 z-[100] flex flex-col gap-4 w-[360px] pointer-events-none">
            {visibleReminders.map(reminder => (
                <div key={reminder.id} className="pointer-events-auto bg-white rounded-xl shadow-2xl border border-brand-200 overflow-hidden animate-slide-in-right">
                    <div className="bg-brand-50 px-4 py-3 flex items-center justify-between border-b border-brand-100">
                        <div className="flex items-center gap-2">
                            <span className="text-xl">⏰</span>
                            <span className="font-bold text-brand-900 text-sm">Reminder</span>
                        </div>
                        <button 
                            onClick={() => handleDismiss(reminder.id)}
                            className="text-brand-400 hover:text-slate-600 transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <div className="p-4">
                        <h3 className="font-bold text-slate-800 mb-1">{reminder.title}</h3>
                        {reminder.subtitle && (
                            <p className="text-sm text-slate-500 mb-4 whitespace-pre-line">{reminder.subtitle}</p>
                        )}
                        <div className="flex gap-2 mt-4">
                            <button
                                onClick={() => handleAction(reminder)}
                                className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                            >
                                View Details
                            </button>
                            <button
                                onClick={() => handleSnooze(reminder)}
                                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                            >
                                Snooze (10m)
                            </button>
                        </div>
                    </div>
                </div>
            ))}
            
            {totalPages > 1 && (
                <div className="pointer-events-auto bg-slate-800 text-white text-sm font-medium py-2 px-4 rounded-xl shadow-lg flex items-center justify-between animate-fade-in">
                    <button 
                        onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                        disabled={safePage === 0}
                        className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-semibold"
                    >
                        ← Prev
                    </button>
                    <div className="flex flex-col items-center">
                        <span className="text-slate-300 font-bold">
                            {safePage + 1} / {totalPages}
                        </span>
                        <span className="text-xs text-brand-400">
                            {activeReminders.length} total
                        </span>
                    </div>
                    <button 
                        onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={safePage === totalPages - 1}
                        className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-semibold"
                    >
                        Next →
                    </button>
                </div>
            )}
        </div>
    );
};

export default ReminderNotification;
