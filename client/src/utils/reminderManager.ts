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
    private dismissedIds: Set<string> = new Set();
    
    // We want to trigger it 15 minutes before the actual time, as requested
    private ADVANCE_NOTICE_MS = 15 * 60 * 1000;

    constructor() {
        this.loadFromStorage();
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
        
        // When should the alarm fire? (e.g. 15 mins before scheduledTime)
        const fireTime = scheduledTime - this.ADVANCE_NOTICE_MS;
        const delayMs = fireTime - now;

        if (delayMs > 0) {
            // Future reminder: set a timeout
            const timeout = setTimeout(() => {
                this.triggerReminder(config);
            }, delayMs);
            this.timeouts.set(config.id, timeout);
            this.saveToStorage(config);
        } else if (delayMs <= 0 && delayMs > -(60 * 60 * 1000)) {
            // If it's already due (within the last 60 minutes)
            // Fire immediately
            this.triggerReminder(config);
            this.saveToStorage(config);
        } else {
            // It's way past due (> 60m), just clean it up if it was in storage
            this.removeFromStorage(config.id);
        }
    }

    removeReminder(id: string) {
        const timeout = this.timeouts.get(id);
        if (timeout) {
            clearTimeout(timeout);
            this.timeouts.delete(id);
        }
        // Always attempt to remove from storage, just in case
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
        this.dismissedIds.clear();
    }
}

export const reminderManager = new ReminderManager();
