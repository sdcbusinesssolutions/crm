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
        
        // Add random jitter (0-15s) so the 6 containers don't hit the DB at the exact same millisecond
        const jitter = Math.floor(Math.random() * 15000);
        
        setTimeout(() => {
            console.log(`⏰ Scheduler Started (Task Reminders) [High-Throughput Mode] - Jitter: ${jitter}ms`);
            
            // Update flow triggers every 5 minutes
            this.updateTaskTriggers();
            this.triggerUpdateInterval = setInterval(() => this.updateTaskTriggers(), 5 * 60000);

            // Run every 15 seconds for more responsive timeouts
            this.interval = setInterval(() => this.checkAllReminders(), 15000);
            this.checkAllReminders(); // Run immediately on start
        }, jitter);
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
                        // taskReminder has been removed
                    });
                }
            });

            this.upcomingOffsets = Array.from(upcoming);
            this.overdueOffsets = Array.from(overdue);
        } catch (e) {
            console.error('❌ [Scheduler] Error updating task triggers:', e.message);
        }
    }

    async checkAllReminders() {
        const now = new Date();

        // 1. Check EXACTLY Due Tasks (Task is Due)
        await this.checkDueTasks(now);

        // 2. Check Upcoming Tasks (Dynamic Scan)
        await this.checkDynamicUpcoming(now);

        // 3. Check Overdue Tasks (Dynamic Scan)
        await this.checkDynamicOverdue(now);

        // 4. Pre-alarms for UI Socket.IO notifications (exactly 5 mins before)
        await this.checkPreAlarms(now);
    }

    async checkPreAlarms(now) {
        try {
            // Target window: Exactly 5 minutes in the future (with a small 5-min backward buffer for late-created tasks)
            // We DO NOT use 24 hours here, otherwise old missed tasks will spam a "Due in 5 mins" popup.
            const targetMs = now.getTime() + (5 * 60000);
            const start = new Date(targetMs - (5 * 60000)).toISOString(); // From exactly now
            const end = new Date(targetMs + 60000).toISOString();         // Up to 6 mins future

            const { data: tasks, error } = await this.supabase
                .from('tasks')
                .select('id, user_id, lead_id, title, description, due_date, metadata, leads(phone, name, email)')
                .eq('is_completed', false)
                .gte('due_date', start)
                .lte('due_date', end)
                .is('metadata->>pre_alarm_5m_sent', null)
                .limit(1000); // 🚀 SCALED

            if (tasks && tasks.length > 0) {
                const processPreAlarm = async (task) => {
                    const isConnected = await realtimeSync.isUserConnected(task.user_id);
                    
                    const meta = task.metadata || {};
                    // Even if they are offline, we MUST mark them as processed to prevent queue starvation!
                    const newMeta = { ...meta, pre_alarm_5m_sent: true };

                    // Claim the task to avoid race conditions
                    const { data: claimed, error: claimError } = await this.supabase
                        .from('tasks')
                        .update({ metadata: newMeta })
                        .eq('id', task.id)
                        .is('metadata->>pre_alarm_5m_sent', null)
                        .select();

                    if (!claimError && claimed && claimed.length > 0) {
                        if (isConnected) {
                            console.log(`[Scheduler] Emitting Socket.IO Pre-Alarm (5m) for Task ${task.id}`);
                            realtimeSync.emitTaskAlarm(task.user_id, {
                                taskId: task.id,
                                title: task.title,
                                dueDate: task.due_date,
                                leadId: task.lead_id,
                                name: task.leads ? task.leads.name : 'Unknown',
                                eventType: 'task_upcoming_5m'
                            });
                        } else {
                            console.log(`[Scheduler] Processed Pre-Alarm for Task ${task.id} (User offline, skipping live popup)`);
                        }
                    }
                };

                // 🚀 SCALED: Concurrent chunk execution
                for (let i = 0; i < tasks.length; i += 50) {
                    const chunk = tasks.slice(i, i + 50);
                    await Promise.all(chunk.map(processPreAlarm));
                }
            }
        } catch (e) {
            console.error('❌ [Scheduler] Pre-Alarm Check Error:', e);
        }
    }

    async checkDueTasks(now) {
        try {
            // Window: -1 hour to +1 min (A reasonable backlog window for due tasks if server restarts)
            const start = new Date(now.getTime() - (60 * 60000)).toISOString();
            const end = new Date(now.getTime() + 60000).toISOString();

            const { data: tasks, error } = await this.supabase
                .from('tasks')
                .select('id, user_id, lead_id, title, description, due_date')
                .eq('is_completed', false)
                .gte('due_date', start)
                .lte('due_date', end)
                .is('reminder_sent', false)
                .limit(1000); // 🚀 SCALED

            if (tasks && tasks.length > 0) {
                const processDue = async (task) => {
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
                };

                for (let i = 0; i < tasks.length; i += 50) {
                    const chunk = tasks.slice(i, i + 50);
                    await Promise.all(chunk.map(processDue));
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
                
                // Tight window: We only send "60 mins upcoming" if it's ACTUALLY between 50-60 mins away.
                // Sending it 10 mins away makes no sense.
                const start = new Date(targetMs - (10 * 60000)).toISOString();
                const end = new Date(targetMs + 60000).toISOString();

                const { data: tasks, error } = await this.supabase
                    .from('tasks')
                    .select('id, user_id, lead_id, title, description, due_date, metadata')
                    .eq('is_completed', false)
                    .gte('due_date', start)
                    .lte('due_date', end)
                    .limit(1000);

                if (error) continue;
                if (!tasks || tasks.length === 0) continue;

                const processUpcoming = async (task) => {
                    const key = `upcoming_${offset}_sent`;
                    const meta = task.metadata || {};

                    if (meta[key]) return; // Already sent for this offset

                    const newMeta = { ...meta, [key]: true };
                    const { data: claimed, error: claimError } = await this.supabase
                        .from('tasks')
                        .update({ metadata: newMeta })
                        .eq('id', task.id)
                        .is(`metadata->>${key}`, null) 
                        .select();

                    if (!claimError && claimed && claimed.length > 0) {
                        console.log(`[Scheduler] Claimed Upcoming(${offset}m) Task ${task.id}`);
                        await this.processTask(task, 'task_upcoming', { timeOffset: offset });
                    }
                };

                for (let i = 0; i < tasks.length; i += 50) {
                    const chunk = tasks.slice(i, i + 50);
                    await Promise.all(chunk.map(processUpcoming));
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
                
                // Generous window for overdue tasks (up to 24 hours late)
                const start = new Date(targetMs - (24 * 60 * 60000)).toISOString();
                const end = new Date(targetMs + 60000).toISOString();

                const { data: tasks, error } = await this.supabase
                    .from('tasks')
                    .select('id, user_id, lead_id, title, description, due_date, metadata')
                    .eq('is_completed', false)
                    .gte('due_date', start)
                    .lte('due_date', end)
                    .limit(1000);

                if (error) continue;
                if (!tasks || tasks.length === 0) continue;

                const processOverdue = async (task) => {
                    const key = `overdue_${offset}_sent`;
                    const meta = task.metadata || {};

                    if (meta[key]) return;

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
                };

                for (let i = 0; i < tasks.length; i += 50) {
                    const chunk = tasks.slice(i, i + 50);
                    await Promise.all(chunk.map(processOverdue));
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
