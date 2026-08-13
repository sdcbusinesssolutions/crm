import React, { useState, useEffect, useCallback } from 'react';
import { reminderManager, ReminderConfig } from '../utils/reminderManager';
import { followUpService } from '../services/followUpService';
import { socket } from '../lib/socket';
import { supabase } from '../lib/supabase';

const playNotificationSound = () => {
    try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        const playNote = (frequency: number, startTime: number, duration: number) => {
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();

            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(frequency, startTime);
            
            // Envelope: start loud, fade out
            gainNode.gain.setValueAtTime(0.3, startTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            oscillator.start(startTime);
            oscillator.stop(startTime + duration);
        };

        const now = audioCtx.currentTime;
        // Play a pleasant 3-note ascending melody (C6, E6, G6)
        playNote(1046.50, now, 0.4);         // C6
        playNote(1318.51, now + 0.12, 0.4);  // E6
        playNote(1567.98, now + 0.24, 0.6);  // G6
        
    } catch (e) {
        console.warn("Audio playback not supported or blocked by browser", e);
    }
};

export const ReminderNotification: React.FC = () => {
    const [activeReminders, setActiveReminders] = useState<ReminderConfig[]>([]);
    const [position, setPosition] = useState(() => {
        try {
            const saved = localStorage.getItem('reminder_position');
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (e) {}
        return { x: 0, y: 0 };
    });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [isCollapsed, setIsCollapsed] = useState(false);

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        setIsDragging(true);
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDragging) return;
        setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        setIsDragging(false);
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        
        // Save the new position to localStorage so it persists across reloads
        localStorage.setItem('reminder_position', JSON.stringify(position));
    };

    useEffect(() => {
        // Request desktop notification permission on load
        if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
            Notification.requestPermission();
        }

        const handleReminderFired = (event: Event) => {
            const customEvent = event as CustomEvent<{ reminder: ReminderConfig }>;
            const reminder = customEvent.detail.reminder;
            
            playNotificationSound();
            setIsCollapsed(false); // Auto-expand to show new reminder
            
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

    // Listen for realtime Socket.IO alarms from the backend scheduler
    useEffect(() => {
        const handleSocketAlarm = (data: any) => {
            console.log("Received realtime socket alarm:", data);
            
            playNotificationSound();
            setIsCollapsed(false); // Auto-expand to show new reminder
            
            // Fire desktop notification if on another tab
            if ('Notification' in window && Notification.permission === 'granted') {
                if (document.hidden || !document.hasFocus()) {
                    const notification = new Notification('⏰ Reminder: ' + data.title, {
                        body: `Contact: ${data.name || 'Unknown'} - Due Now`,
                        requireInteraction: true
                    });
                    
                    notification.onclick = () => {
                        window.focus();
                        notification.close();
                    };
                }
            }
            
            // Add to UI
            const newReminder: ReminderConfig = {
                id: `crm_${data.taskId}`,
                title: data.title,
                subtitle: `Contact: ${data.name || 'Unknown'}`,
                scheduledAt: new Date(data.dueDate),
                data: { contactId: data.leadId }
            };
            
            setActiveReminders(prev => {
                if (prev.find(r => r.id === newReminder.id)) return prev;
                return [...prev, newReminder];
            });
        };

        socket.on('task_alarm', handleSocketAlarm);

        // Global Socket Connection for Reminders
        const joinSocketRoom = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            const staffDataStr = localStorage.getItem('staffData');
            let roomToJoin = user?.id;
            
            if (staffDataStr) {
                try {
                    const staffData = JSON.parse(staffDataStr);
                    if (staffData.owner_id) roomToJoin = staffData.owner_id;
                } catch (e) {}
            }

            if (roomToJoin && socket) {
                socket.emit('join_room', roomToJoin);
            }
        };

        if (socket.connected) {
            joinSocketRoom();
        } else {
            socket.on('connect', joinSocketRoom);
        }

        return () => {
            socket.off('task_alarm', handleSocketAlarm);
            socket.off('connect', joinSocketRoom);
        };
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

    const handleDismissAll = async () => {
        const ids = activeReminders.map(r => r.id);
        
        // Remove from local state immediately for snappy UI
        setActiveReminders([]);
        
        // Process them all in the background
        for (const id of ids) {
            reminderManager.dismissReminder(id);
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
                console.error(`Failed to mark task ${id} as completed`, err);
            }
        }
    };

    if (activeReminders.length === 0) return null;

    return (
        <div 
            className="fixed top-20 right-8 z-[100] flex flex-col gap-4 w-[360px] pointer-events-none transition-transform duration-75"
            style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
        >
            <div 
                className="pointer-events-auto bg-white/90 backdrop-blur shadow-lg border border-brand-100 rounded-xl p-3 flex justify-between items-center animate-fade-in cursor-move"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
            >
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-brand-500 rounded-full animate-pulse"></div>
                    <span className="font-bold text-slate-700 text-sm pointer-events-none">{activeReminders.length} Reminder{activeReminders.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        onPointerDown={e => e.stopPropagation()}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        title={isCollapsed ? "Expand" : "Collapse"}
                    >
                        <svg className={`w-5 h-5 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                    </button>
                    <button 
                        onClick={handleDismissAll}
                        onPointerDown={e => e.stopPropagation()}
                        className="text-xs font-semibold text-slate-500 hover:text-red-500 transition-colors bg-slate-100 hover:bg-red-50 px-3 py-1.5 rounded-lg"
                    >
                        Dismiss All
                    </button>
                </div>
            </div>
            
            {/* Scrollable Container */}
            {!isCollapsed && (
            <div 
                className="pointer-events-auto flex flex-col gap-4 max-h-[calc(100vh-160px)] overflow-y-auto pr-1"
                style={{
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#cbd5e1 transparent'
                }}
            >
                {/* Embedded Webkit Scrollbar CSS for Chrome/Safari */}
                <style>{`
                    .pointer-events-auto::-webkit-scrollbar {
                        width: 6px;
                    }
                    .pointer-events-auto::-webkit-scrollbar-track {
                        background: transparent;
                    }
                    .pointer-events-auto::-webkit-scrollbar-thumb {
                        background-color: #cbd5e1;
                        border-radius: 20px;
                    }
                `}</style>
                
                {activeReminders.map(reminder => (
                    <div key={reminder.id} className="bg-white rounded-xl shadow-2xl border border-brand-200 overflow-hidden animate-slide-in-right flex-shrink-0">
                        <div 
                            className="bg-brand-50 px-4 py-3 flex items-center justify-between border-b border-brand-100 cursor-move"
                            onPointerDown={handlePointerDown}
                            onPointerMove={handlePointerMove}
                            onPointerUp={handlePointerUp}
                        >
                            <div className="flex items-center gap-2 pointer-events-none">
                                <span className="text-xl">⏰</span>
                                <span className="font-bold text-brand-900 text-sm">Reminder</span>
                            </div>
                            <button 
                                onClick={() => handleDismiss(reminder.id)}
                                onPointerDown={e => e.stopPropagation()}
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
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            )}
        </div>
    );
};

export default ReminderNotification;
