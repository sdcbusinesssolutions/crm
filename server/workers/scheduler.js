const { createClient } = require('@supabase/supabase-js');
const flowEngine = require('../services/flowEngine');
const { logCRMEvent } = require('../utils/logger');

class Scheduler {
    constructor(supabaseUrl, serviceKey) {
        this.supabase = createClient(supabaseUrl, serviceKey);
        this.interval = null;
        this.isRunning = false;
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log('⏰ Scheduler Started (Task Reminders)');
        // Run every 15 seconds for more responsive timeouts
        this.interval = setInterval(() => this.checkAllReminders(), 15000);
        this.checkAllReminders(); // Run immediately on start
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

        // 4. Check Flow Timeouts (Unresponsive / Delays)
        await this.checkFlowTimeouts(now);
    }

    async checkDueTasks(now) {
        try {
            // Window: -1 min to +1 min
            const start = new Date(now.getTime() - 60000).toISOString();
            const end = new Date(now.getTime() + 60000).toISOString();

            const { data: tasks, error } = await this.supabase
                .from('tasks')
                .select('*')
                .eq('is_completed', false)
                .gte('due_date', start)
                .lte('due_date', end)
                .is('reminder_sent', false);

            if (tasks && tasks.length > 0) {
                for (const task of tasks) {
                    await this.processTask(task, 'task_due', {});
                    await this.supabase.from('tasks').update({ reminder_sent: true }).eq('id', task.id);
                }
            }
        } catch (e) {
            console.error('❌ [Scheduler] Due Check Error:', e);
        }
    }

    async checkDynamicUpcoming(now) {
        try {
            // "Batch Processing" to handle 5,000+ tasks
            let lastId = '00000000-0000-0000-0000-000000000000';
            let hasMore = true;

            // Look ahead 7 days
            const lookAheadLimit = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

            while (hasMore) {
                // Fetch next batch of 500
                const { data: tasks, error } = await this.supabase
                    .from('tasks')
                    .select('*')
                    .eq('is_completed', false)
                    .gt('due_date', now.toISOString())
                    .lt('due_date', lookAheadLimit)
                    .gt('id', lastId) // Cursor: Get tasks with ID greater than last processed
                    .order('id', { ascending: true })
                    .limit(500);

                if (error || !tasks || tasks.length === 0) {
                    hasMore = false;
                    break;
                }

                // Process this batch
                for (const task of tasks) {
                    lastId = task.id; // Update cursor

                    const dueDate = new Date(task.due_date);
                    const diffMs = dueDate.getTime() - now.getTime();
                    const minutesRemaining = Math.round(diffMs / 60000);

                    if (minutesRemaining <= 0) continue;

                    const key = `upcoming_${minutesRemaining}_sent`;
                    const meta = task.metadata || {};

                    if (meta[key]) continue; // Already sent for this minute

                    // Trigger Flow
                    await this.processTask(task, 'task_upcoming', { timeOffset: minutesRemaining });

                    // Update metadata
                    const newMeta = { ...meta, [key]: true };
                    await this.supabase.from('tasks').update({ metadata: newMeta }).eq('id', task.id);
                }
            }
        } catch (e) {
            console.error('❌ [Scheduler] Dynamic Upcoming Error:', e);
        }
    }

    async checkDynamicOverdue(now) {
        try {
            let lastId = '00000000-0000-0000-0000-000000000000';
            let hasMore = true;

            // Look back 7 days
            const lookBackLimit = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

            while (hasMore) {
                const { data: tasks, error } = await this.supabase
                    .from('tasks')
                    .select('*')
                    .eq('is_completed', false)
                    .lt('due_date', now.toISOString())
                    .gt('due_date', lookBackLimit)
                    .gt('id', lastId)
                    .order('id', { ascending: true })
                    .limit(500);

                if (error || !tasks || tasks.length === 0) {
                    hasMore = false;
                    break;
                }

                for (const task of tasks) {
                    lastId = task.id;

                    const dueDate = new Date(task.due_date);
                    const diffMs = now.getTime() - dueDate.getTime();
                    const minutesOverdue = Math.round(diffMs / 60000);

                    if (minutesOverdue <= 0) continue;

                    const key = `overdue_${minutesOverdue}_sent`;
                    const meta = task.metadata || {};

                    if (meta[key]) continue;

                    await this.processTask(task, 'task_overdue', { timeOffset: minutesOverdue });

                    const newMeta = { ...meta, [key]: true };
                    await this.supabase.from('tasks').update({ metadata: newMeta }).eq('id', task.id);
                }
            }
        } catch (e) {
            console.error('❌ [Scheduler] Dynamic Overdue Error:', e);
        }
    }

    async checkFlowTimeouts(now) {
        try {
            // Fetch sessions that are 'waiting_input' or 'delayed'
            const { data: sessions, error } = await this.supabase
                .from('flow_sessions')
                .select('*')
                .in('status', ['waiting_input', 'delayed']);

            if (error) {
                console.error('[Scheduler] Error fetching waiting sessions:', error.message);
                return;
            }

            if (!sessions || sessions.length === 0) return;

            const nowTime = now.getTime();
            const buffer = 5000; // 5 second buffer

            for (const session of sessions) {
                if (!session.variables) continue;

                // 1. Unresponsive Timeout
                if (session.status === 'waiting_input') {
                    const nodeId = session.current_node_id;
                    const nodeState = session.variables[nodeId];

                    if (nodeState && nodeState.timeoutAt) {
                        const timeoutTime = new Date(nodeState.timeoutAt).getTime();
                        
                        // LOGGING for debugging
                        if (process.env.DEBUG_TIMEOUTS || true) { // Force on for now to help user see it in logs
                            console.log(`[Scheduler] Checking Session ${session.id}: TimeoutAt ${nodeState.timeoutAt}, Now ${now.toISOString()}`);
                        }

                        if (nowTime >= (timeoutTime - buffer)) {
                            console.log(`[Scheduler] Session ${session.id} unresponsive timeout reached (${timeoutTime} <= ${nowTime})`);
                            await flowEngine.handleSessionTimeout(session.id, 'unresponsive');
                        }
                    }
                }

                // 2. Delay Resume
                if (session.status === 'delayed') {
                    const nodeId = session.current_node_id;
                    const nodeData = session.variables[nodeId];
                    // 'resumeAt' is standard for Delay node
                    if (nodeData && nodeData.resumeAt) {
                        const resumeTime = new Date(nodeData.resumeAt).getTime();
                        if (now.getTime() >= resumeTime) {
                            console.log(`[Scheduler] Session ${session.id} delay completed.`);
                            // 'default' handle usually for continuation after delay
                            await flowEngine.handleSessionTimeout(session.id, 'default');
                        }
                    }
                }
            }
        } catch (e) {
            console.error('❌ [Scheduler] Flow Timeout Check Error:', e);
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
                    'contact.name': taskWithLead.leads.name,
                    'contact.email': taskWithLead.leads.email,
                    ...extraData
                });
            }
        } catch (err) {
            console.error(`[Scheduler] Failed to process task ${task.id}:`, err);
        }
    }
}

module.exports = Scheduler;
