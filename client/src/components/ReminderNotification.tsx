import React, { useState, useEffect, useCallback } from 'react';
import { reminderManager, ReminderConfig } from '../utils/reminderManager';

export const ReminderNotification: React.FC = () => {
    const [activeReminders, setActiveReminders] = useState<ReminderConfig[]>([]);

    useEffect(() => {
        const handleReminderFired = (event: Event) => {
            const customEvent = event as CustomEvent<{ reminder: ReminderConfig }>;
            const reminder = customEvent.detail.reminder;
            
            setActiveReminders(prev => {
                if (prev.find(r => r.id === reminder.id)) return prev;
                return [...prev, reminder];
            });
        };

        window.addEventListener('reminder-fired', handleReminderFired);
        return () => window.removeEventListener('reminder-fired', handleReminderFired);
    }, []);

    const handleDismiss = (id: string) => {
        reminderManager.dismissReminder(id);
        setActiveReminders(prev => prev.filter(r => r.id !== id));
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

    return (
        <div className="fixed top-20 right-8 z-[100] flex flex-col gap-4 w-[360px] pointer-events-none">
            {activeReminders.map(reminder => (
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
                            <p className="text-sm text-slate-500 mb-4">{reminder.subtitle}</p>
                        )}
                        <div className="flex gap-2 mt-4">
                            {reminder.onAction && (
                                <button 
                                    onClick={() => handleAction(reminder)}
                                    className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-bold py-2 px-4 rounded-lg text-sm transition-colors shadow-sm"
                                >
                                    View / Action
                                </button>
                            )}
                            <button 
                                onClick={() => handleSnooze(reminder)}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg text-sm transition-colors"
                            >
                                Snooze (10m)
                            </button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ReminderNotification;
