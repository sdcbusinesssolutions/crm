const { createClient } = require('@supabase/supabase-js');
const flowEngine = require('../services/flowEngine');
const realtimeSync = require('../services/realtimeSync');
const { logCRMEvent } = require('../utils/logger');

class Scheduler {
    constructor(supabaseUrl, serviceKey) {
        this.supabase = createClient(supabaseUrl, serviceKey);
        this.interval = null;
        this.triggerUpdateInterval = null;
        this.isRunning = false;
        this.upcomingOffsets = [];
        this.overdueOffsets = [];
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log('⏰ Scheduler Started (Task Reminders)');
        // Update flow triggers every 5 minutes
        this.updateTaskTriggers();
        this.triggerUpdateInterval = setInterval(() => this.updateTaskTriggers(), 5 * 60000);

        // Run every 15 seconds for more responsive timeouts
        this.interval = setInterval(() => this.checkAllReminders(), 15000);
        this.checkAllReminders(); // Run immediately on start
    }

    async updateTaskTriggers() {
        try {
            const { data: flows, error } = await this.supabase
                .from('flows')
                .select('nodes')
                .eq('status', 'published');

            if (error) throw error;

            const upcoming = new Set();
            const overdue = new Set();

            flows.forEach(flow => {
                if (flow.nodes) {
                    flow.nodes.forEach(node => {
                        if (node.type === 'taskReminder') {
                            const trigger = node.data.triggerEvent || 'task_due';
                            const offset = node.data.timeOffset || 60;
                            if (trigger === 'task_upcoming') upcoming.add(parseInt(offset));
                            if (trigger === 'task_overdue') overdue.add(parseInt(offset));
                        }
                    });
                }
            });

            this.upcomingOffsets = Array.from(upcoming);
            this.overdueOffsets = Array.from(overdue);
            // console.log(`[Scheduler] Updated active task triggers: Upcoming [${this.upcomingOffsets.join(',')}], Overdue [${this.overdueOffsets.join(',')}]`);
        } catch (e) {
            console.error('❌ [Scheduler] Error updating task triggers:', e.message);
        }
    }

    async checkAllReminders() {
        const now = new Date();

        // 1. Check EXACTLY Due Tasks (Task is Due)
        await this.checkDueTasks(now);

        // 2. Check Upcoming Tasks (Dynamic Scan)
        // We look ahead up to 7 days (10080 mins) to catch any upcoming triggers
        await this.checkDynamicUpcoming(now);

        // 3. Check Overdue Tasks (Dynamic Scan)
        await this.checkDynamicOverdue(now);

        // 4. Pre-alarms for UI Socket.IO notifications (exactly 5 mins before)
        await this.checkPreAlarms(now);
    }

    async checkPreAlarms(now) {
        try {
            // Target window: from 5 minutes in the past up to exactly 5 minutes in the future
            // Looking in the past ensures if they schedule an alarm for exactly "right now", we don't miss it if a few seconds elapsed.
            const startMs = now.getTime() - (5 * 60000);
            const start = new Date(startMs).toISOString();
            const endMs = now.getTime() + (5 * 60000);
            const end = new Date(endMs).toISOString();

            const { data: tasks, error } = await this.supabase
                .from('tasks')
                .select('id, user_id, lead_id, title, description, due_date, metadata, leads(phone, name, email)')
                .eq('is_completed', false)
                .gte('due_date', start)
                .lte('due_date', end)
                .is('metadata->>pre_alarm_5m_sent', null)
                .limit(500);

            if (tasks && tasks.length > 0) {
                for (const task of tasks) {
                    // Check if the user is actually connected right now!
                    const isConnected = await realtimeSync.isUserConnected(task.user_id);
                    
                    if (isConnected) {
                        const meta = task.metadata || {};
                        const newMeta = { ...meta, pre_alarm_5m_sent: true };

                        // Claim the task to avoid race conditions
                        const { data: claimed, error: claimError } = await this.supabase
                            .from('tasks')
                            .update({ metadata: newMeta })
                            .eq('id', task.id)
                            .is('metadata->>pre_alarm_5m_sent', null)
                            .select();

                        if (!claimError && claimed && claimed.length > 0) {
                            console.log(`[Scheduler] Emitting Socket.IO Pre-Alarm (5m) for Task ${task.id}`);
                            realtimeSync.emitTaskAlarm(task.user_id, {
                                taskId: task.id,
                                title: task.title,
                                dueDate: task.due_date,
                                leadId: task.lead_id,
                                name: task.leads ? task.leads.name : 'Unknown',
                                eventType: 'task_upcoming_5m'
                            });
                        }
                    } else {
                        // User is not connected! Do NOT update the DB. 
                        // The scheduler will retry this on the next tick (every ~30s) as long as it's within the 5m window.
                        console.log(`[Scheduler] Skipping Pre-Alarm for Task ${task.id}, user ${task.user_id} is offline.`);
                    }
                }
            }
        } catch (e) {
            console.error('❌ [Scheduler] Pre-Alarm Check Error:', e);
        }
    }

    async checkDueTasks(now) {
        try {
            // Window: -1 min to +1 min
            const start = new Date(now.getTime() - 60000).toISOString();
            const end = new Date(now.getTime() + 60000).toISOString();

            // 1. Fetch potential tasks
            const { data: tasks, error } = await this.supabase
                .from('tasks')
                .select('id, user_id, lead_id, title, description, due_date')
                .eq('is_completed', false)
                .gte('due_date', start)
                .lte('due_date', end)
                .is('reminder_sent', false);

            if (tasks && tasks.length > 0) {
                for (const task of tasks) {
                    // ATOMIC CLAIM: Try to mark as sent. Only proceed if we were the one who updated it.
                    const { data: claimed, error: claimError } = await this.supabase
                        .from('tasks')
                        .update({ reminder_sent: true })
                        .eq('id', task.id)
                        .eq('reminder_sent', false)
                        .select();

                    if (!claimError && claimed && claimed.length > 0) {
                        console.log(`[Scheduler] Claimed Due Task ${task.id}`);
                        await this.processTask(task, 'task_due', {});
                    }
                }
            }
        } catch (e) {
            console.error('❌ [Scheduler] Due Check Error:', e);
        }
    }

    async checkDynamicUpcoming(now) {
        if (!this.upcomingOffsets || this.upcomingOffsets.length === 0) return;

        try {
            for (const offset of this.upcomingOffsets) {
                // Target due date is exactly `now + offset` minutes
                const targetMs = now.getTime() + offset * 60000;
                // 2 min window to ensure we catch it within the 15s interval
                const start = new Date(targetMs - 60000).toISOString();
                const end = new Date(targetMs + 60000).toISOString();

                const { data: tasks, error } = await this.supabase
                    .from('tasks')
                    .select('id, user_id, lead_id, title, description, due_date, metadata')
                    .eq('is_completed', false)
                    .gte('due_date', start)
                    .lte('due_date', end)
                    .limit(500);

                if (error) continue;
                if (!tasks || tasks.length === 0) continue;

                for (const task of tasks) {
                    const key = `upcoming_${offset}_sent`;
                    const meta = task.metadata || {};

                    if (meta[key]) continue; // Already sent for this offset

                    // ATOMIC CLAIM: Update metadata
                    const newMeta = { ...meta, [key]: true };
                    const { data: claimed, error: claimError } = await this.supabase
                        .from('tasks')
                        .update({ metadata: newMeta })
                        .eq('id', task.id)
                        .is(`metadata->>${key}`, null) 
                        .select();

                    if (!claimError && claimed && claimed.length > 0) {
                        console.log(`[Scheduler] Claimed Upcoming(${offset}m) Task ${task.id}`);
                        // Trigger Flow
                        await this.processTask(task, 'task_upcoming', { timeOffset: offset });
                    }
                }
            }
        } catch (e) {
            console.error('❌ [Scheduler] Dynamic Upcoming Error:', e);
        }
    }

    async checkDynamicOverdue(now) {
        if (!this.overdueOffsets || this.overdueOffsets.length === 0) return;

        try {
            for (const offset of this.overdueOffsets) {
                // Target due date is exactly `now - offset` minutes
                const targetMs = now.getTime() - offset * 60000;
                // 2 min window
                const start = new Date(targetMs - 60000).toISOString();
                const end = new Date(targetMs + 60000).toISOString();

                const { data: tasks, error } = await this.supabase
                    .from('tasks')
                    .select('id, user_id, lead_id, title, description, due_date, metadata')
                    .eq('is_completed', false)
                    .gte('due_date', start)
                    .lte('due_date', end)
                    .limit(500);

                if (error) continue;
                if (!tasks || tasks.length === 0) continue;

                for (const task of tasks) {
                    const key = `overdue_${offset}_sent`;
                    const meta = task.metadata || {};

                    if (meta[key]) continue;

                    // ATOMIC CLAIM
                    const newMeta = { ...meta, [key]: true };
                    const { data: claimed, error: claimError } = await this.supabase
                        .from('tasks')
                        .update({ metadata: newMeta })
                        .eq('id', task.id)
                        .is(`metadata->>${key}`, null)
                        .select();

                    if (!claimError && claimed && claimed.length > 0) {
                        console.log(`[Scheduler] Claimed Overdue(${offset}m) Task ${task.id}`);
                        await this.processTask(task, 'task_overdue', { timeOffset: offset });
                    }
                }
            }
        } catch (e) {
            console.error('❌ [Scheduler] Dynamic Overdue Error:', e);
        }
    }

    async processTask(task, eventType, extraData) {
        try {
            // Fetch lead phone, name, email
            const { data: taskWithLead } = await this.supabase
                .from('tasks')
                .select('*, leads(phone, name, email)')
                .eq('id', task.id)
                .single();

            if (taskWithLead && taskWithLead.leads && taskWithLead.leads.phone) {
                console.log(`[Scheduler] Triggering '${eventType}' flow for Task ${task.id}`);

                await flowEngine.triggerFlowByEvent(task.user_id, taskWithLead.leads.phone, eventType, {
                    taskId: task.id,
                    leadId: task.lead_id,
                    title: task.title,
                    description: task.description,
                    dueDate: task.due_date,
                    name: taskWithLead.leads.name,
                    email: taskWithLead.leads.email,
                    phone: taskWithLead.leads.phone,
                    'contact.name': taskWithLead.leads.name,
                    'contact.email': taskWithLead.leads.email,
                    'contact.phone': taskWithLead.leads.phone,
                    ...extraData
                });
            }
        } catch (err) {
            console.error(`[Scheduler] Failed to process task ${task.id}:`, err);
        }
    }
}

module.exports = Scheduler;
