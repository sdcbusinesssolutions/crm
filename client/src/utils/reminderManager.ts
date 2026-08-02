export interface ReminderConfig {
    id: string;
    title: string;
    subtitle?: string;
    scheduledAt: Date;
    data?: any; // any extra data needed
    onAction?: (data?: any) => void;
    persistLocally?: boolean;
}

type ReminderEventData = {
    reminder: ReminderConfig;
};

class ReminderManager {
    private timeouts: Map<string, NodeJS.Timeout> = new Map();
    private pendingReminders: Map<string, ReminderConfig> = new Map();
    private dismissedIds: Set<string> = new Set();
    private pollingInterval: NodeJS.Timeout | null = null;
    
    // We want to trigger it 15 minutes before the actual time, as requested
    private ADVANCE_NOTICE_MS = 15 * 60 * 1000;

    constructor() {
        this.loadFromStorage();
        this.startPolling();
    }

    private startPolling() {
        if (this.pollingInterval) clearInterval(this.pollingInterval);
        this.pollingInterval = setInterval(() => {
            this.checkReminders();
        }, 5000); // Check every 5 seconds for robustness
    }

    private checkReminders() {
        const now = Date.now();
        for (const [id, config] of this.pendingReminders.entries()) {
            const advanceNotice = (config.title && config.title.startsWith('[QUICK_ALARM]')) ? 0 : this.ADVANCE_NOTICE_MS;
            const fireTime = config.scheduledAt.getTime() - advanceNotice;
            
            if (now >= fireTime) {
                if (now - fireTime <= 60 * 60 * 1000) { // Due within last 60 mins
                    this.triggerReminder(config);
                    this.pendingReminders.delete(id);
                    const timeout = this.timeouts.get(id);
                    if (timeout) {
                        clearTimeout(timeout);
                        this.timeouts.delete(id);
                    }
                } else {
                    // Too old, just remove
                    this.pendingReminders.delete(id);
                    this.removeReminder(id);
                }
            }
        }
    }

    private loadFromStorage() {
        try {
            const stored = localStorage.getItem('local_reminders');
            if (stored) {
                const parsed = JSON.parse(stored);
                parsed.forEach((item: any) => {
                    // Re-add to memory
                    this.addReminder({
                        ...item,
                        scheduledAt: new Date(item.scheduledAt),
                        onAction: () => {} // We can't serialize functions, so default to empty
                    });
                });
            }
        } catch (e) {
            console.error("Error loading reminders from storage", e);
        }
    }

    private saveToStorage(config: ReminderConfig) {
        if (!config.persistLocally) return;
        try {
            const stored = localStorage.getItem('local_reminders');
            let list = stored ? JSON.parse(stored) : [];
            list = list.filter((i: any) => i.id !== config.id);
            list.push({
                id: config.id,
                title: config.title,
                subtitle: config.subtitle,
                scheduledAt: config.scheduledAt.toISOString(),
                data: config.data,
                persistLocally: true
            });
            localStorage.setItem('local_reminders', JSON.stringify(list));
        } catch (e) {
            console.error("Failed to save reminder to local storage", e);
        }
    }

    private removeFromStorage(id: string) {
        try {
            const stored = localStorage.getItem('local_reminders');
            if (stored) {
                let list = JSON.parse(stored);
                const initialLen = list.length;
                list = list.filter((i: any) => i.id !== id);
                if (list.length !== initialLen) {
                    localStorage.setItem('local_reminders', JSON.stringify(list));
                }
            }
        } catch (e) {}
    }

    addReminder(config: ReminderConfig) {
        if (this.dismissedIds.has(config.id)) return;

        // Clear existing timeout if it exists
        this.removeReminder(config.id);

        const now = Date.now();
        const scheduledTime = config.scheduledAt.getTime();
        
        // When should the alarm fire?
        const advanceNotice = (config.title && config.title.startsWith('[QUICK_ALARM]')) ? 0 : this.ADVANCE_NOTICE_MS;
        const fireTime = scheduledTime - advanceNotice;
        const delayMs = fireTime - now;

        if (delayMs > 0) {
            // Future reminder: set a timeout AND add to pending for polling
            this.pendingReminders.set(config.id, config);
            const timeout = setTimeout(() => {
                if (this.pendingReminders.has(config.id)) {
                    this.triggerReminder(config);
                    this.pendingReminders.delete(config.id);
                    this.timeouts.delete(config.id);
                }
            }, delayMs);
            this.timeouts.set(config.id, timeout);
            this.saveToStorage(config);
        } else if (delayMs <= 0 && delayMs > -(60 * 60 * 1000)) {
            // Fire immediately
            this.triggerReminder(config);
            this.saveToStorage(config);
        } else {
            // Past due (>60m)
            this.removeFromStorage(config.id);
        }
    }

    removeReminder(id: string) {
        const timeout = this.timeouts.get(id);
        if (timeout) {
            clearTimeout(timeout);
            this.timeouts.delete(id);
        }
        this.pendingReminders.delete(id);
        this.removeFromStorage(id);
    }

    dismissReminder(id: string) {
        this.dismissedIds.add(id);
        this.removeReminder(id);
    }

    private triggerReminder(config: ReminderConfig) {
        // Dispatch a global event that the UI can listen to
        const event = new CustomEvent<ReminderEventData>('reminder-fired', {
            detail: { reminder: config }
        });
        window.dispatchEvent(event);
    }

    // Allow clearing memory on logout
    clearAll() {
        this.timeouts.forEach(clearTimeout);
        this.timeouts.clear();
        this.pendingReminders.clear();
        this.dismissedIds.clear();
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }
}

export const reminderManager = new ReminderManager();
