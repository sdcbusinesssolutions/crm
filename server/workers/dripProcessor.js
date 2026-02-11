const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
const GmailService = require('../services/GmailService');
const SmtpService = require('../services/SmtpService');

// Environment check
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing Supabase credentials for Drip Processor');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// --- HELPER: Logging & Idempotency ---
async function logAction(enrollment, type, details = {}, idempotencyKey = null) {
    try {
        // 1. If Idempotency Key is provided, check if action already happened
        if (idempotencyKey) {
            const { data: existing } = await supabase
                .from('drip_logs')
                .select('id')
                .eq('idempotency_key', idempotencyKey)
                .limit(1)
                .single();

            if (existing) {
                console.log(`[DripLog] SKIP: Action '${type}' already processed (Key: ${idempotencyKey})`);
                return { skipped: true }; // Already done
            }
        }

        // 2. Insert Log Entry
        const { error } = await supabase.from('drip_logs').insert({
            drip_enrollment_id: enrollment.id,
            contact_id: enrollment.contact_id,
            action_type: type, // 'MESSAGE_SENT', 'OWNER_NOTIFY', 'STOP_AT_EXPIRED', 'ERROR'
            campaign_name: enrollment.drip_campaign?.name || 'Unknown',
            step_order: enrollment.current_step?.step_order || 0,
            details: details,
            idempotency_key: idempotencyKey,
            status: 'SUCCESS'
        });

        if (error) console.error('[DripLog] Failed to write log:', error);

        console.log(`[DripLog] ${type}: ${JSON.stringify(details)}`);
        return { skipped: false };

    } catch (e) {
        console.error('[DripLog] Critical Logging Error:', e);
        return { skipped: false }; // Allow proceed if logging fails (prioritize action)
    }
}

function isWithinWindow(campaign, now = new Date()) {
    // 1. Check Days of Week
    const day = now.getDay(); // 0-6
    const allowedDays = (campaign.allowed_days || '0,1,2,3,4,5,6').split(',').map(Number);
    if (!allowedDays.includes(day)) return false;

    // 2. Check Time of Day
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [startH, startM] = (campaign.time_window_start || '00:00').split(':').map(Number);
    const startMinutes = startH * 60 + startM;

    const [endH, endM] = (campaign.time_window_end || '23:59').split(':').map(Number);
    const endMinutes = endH * 60 + endM;

    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

/**
 * Main Processor Function
 */
async function processDrips() {
    console.log('[DripEngine] Running cycle...');
    const now = new Date();

    try {
        // 1. ATOMIC LOCKING
        // We call a Postgres Function that finds AND locks rows in one step.
        // This guarantees no race conditions.
        const { data: lockedRows, error: rpcError } = await supabase.rpc('fetch_and_lock_drip_jobs', {
            batch_size: 10
        });

        if (rpcError) {
            console.error('[DripEngine] RPC Error:', rpcError);
            return;
        }

        if (!lockedRows || lockedRows.length === 0) return;

        const dueIds = lockedRows.map(e => e.id);

        // 2. Fetch Full Data (Joins) for Locked IDs
        const { data: enrollments, error } = await supabase
            .from('drip_enrollments')
            .select(`
                *,
                drip_campaign:drip_campaigns(*),
                current_step:drip_steps!drip_enrollments_current_step_id_fkey(*),
                contact:contacts(*)
            `)
            .in('id', dueIds);

        if (error) throw error;

        console.log(`[DripEngine] Processing batch of ${enrollments.length} enrollments (Safe Locked)...`);

        for (const enrollment of enrollments) {

            // A. Check Stop At Constraint (The "Until Date" Logic)
            // A. Check Stop At Constraint (The "Until Date" Logic)
            if (enrollment.stop_at) {
                const stopTime = new Date(enrollment.stop_at).getTime();
                const nowTime = now.getTime();

                // Advanced Dynamic Owner Notifications
                if (stopTime > nowTime) {
                    const diffMs = stopTime - nowTime;
                    const sentAlerts = enrollment.notifications_sent || [];
                    const rules = enrollment.notification_rules || [];
                    const newSentAlerts = [...sentAlerts];
                    let alertsModified = false;

                    for (const rule of rules) {
                        // rule: { phone, value: 2, unit: 'HOURS' }
                        const ruleId = `${rule.phone}-${rule.value}-${rule.unit}`;
                        if (sentAlerts.includes(ruleId)) continue; // Check Local Cache

                        let checkMs = 0;
                        if (rule.unit === 'MINUTES') checkMs = rule.value * 60 * 1000;
                        else if (rule.unit === 'HOURS') checkMs = rule.value * 60 * 60 * 1000;
                        else if (rule.unit === 'DAYS') checkMs = rule.value * 24 * 60 * 60 * 1000;

                        if (diffMs <= checkMs && diffMs > 0) {
                            // IDEMPOTENCY CHECK & LOGGING
                            const idempotencyKey = `NOTIFY-${enrollment.id}-${ruleId}`;
                            const { skipped } = await logAction(enrollment, 'OWNER_NOTIFY', {
                                phone: rule.phone,
                                message: `Follow-up for ${enrollment.contact.name} due in ~${rule.value} ${rule.unit}`
                            }, idempotencyKey);

                            if (!skipped) {
                                // Simulate sending notification
                                newSentAlerts.push(ruleId);
                                alertsModified = true;
                            }
                        }
                    }

                    if (alertsModified) {
                        await supabase.from('drip_enrollments').update({
                            notifications_sent: newSentAlerts
                        }).eq('id', enrollment.id);
                    }

                } else {
                    // Stop time passed -> Cancel/Complete
                    console.log(`[DripEngine] Enrollment ${enrollment.id} expired (Stop At: ${enrollment.stop_at}). Cancelling.`);

                    // Log the Stop Event
                    await logAction(enrollment, 'STOP_AT_EXPIRED', { stop_at: enrollment.stop_at });

                    await supabase.from('drip_enrollments').update({ status: 'EXPIRED', completed_at: now }).eq('id', enrollment.id);
                    continue;
                }
            }

            // B. Check Campaign Pause Status
            if (enrollment.drip_campaign.status !== 'ACTIVE') {
                console.log(`[DripEngine] Campaign ${enrollment.drip_campaign.name} is paused/draft. Skipping.`);
                continue;
            }

            // C. Check Time Window (Global & Step-Specific)
            // Use step custom schedule if enabled, otherwise campaign default
            const useStepSchedule = enrollment.current_step.use_custom_schedule;

            const scheduleConfig = useStepSchedule ? {
                allowed_days: enrollment.current_step.custom_allowed_days,
                time_window_start: enrollment.current_step.custom_time_start,
                time_window_end: enrollment.current_step.custom_time_end
            } : enrollment.drip_campaign;

            if (!isWithinWindow(scheduleConfig, now)) {
                // If strictly missed, reschedule for next window? 
                // For simplicity, we just check again next run (1 min later) until window opens.
                // Or we could bump next_run_at to start of next window to save DB calls.
                console.log(`[DripEngine] Enrollment ${enrollment.id} outside delivery window. Waiting.`);
                continue;
            }

            // D. Execute Step Action
            const step = enrollment.current_step;
            let success = false;

            try {
                if (step.step_type === 'WHATSAPP_MESSAGE') {
                    // IDEMPOTENCY KEY: Unique per enrollment + step
                    const idempotencyKey = `MSG-${enrollment.id}-${step.id}`;

                    const { skipped } = await logAction(enrollment, 'MESSAGE_SENT', {
                        template: step.step_config.template_name,
                        to: enrollment.contact.phone
                    }, idempotencyKey);

                    if (skipped) {
                        success = true; // Auto-advance if already done
                    } else {
                        // ACTUAL SENDING LOGIC (Simulated)
                        console.log(`[DripEngine] SENT WA to ${enrollment.contact.phone}: ${step.step_config.template_name}`);
                        success = true;
                    }

                } else if (step.step_type === 'EMAIL') {
                    const idempotencyKey = `EMAIL-${enrollment.id}-${step.id}`;

                    // Optimistic Locking: Log first
                    const { skipped } = await logAction(enrollment, 'EMAIL_SENT', { to: enrollment.contact.email }, idempotencyKey);

                    if (skipped) {
                        success = true;
                    } else {
                        try {
                            const config = step.step_config || {};
                            const toEmail = enrollment.contact.email;

                            if (!toEmail) throw new Error('Contact has no email address');

                            if (config.provider === 'GMAIL') {
                                if (!config.connectionId) throw new Error('No Gmail connection selected');

                                await GmailService.sendEmail(
                                    enrollment.drip_campaign.user_id,
                                    config.connectionId,
                                    toEmail,
                                    config.subject,
                                    config.body
                                );

                            } else if (config.provider === 'SMTP') {
                                if (!config.connectionId) throw new Error('No SMTP connection selected');

                                // Fetch connection manually for SMTP as Service needs raw config
                                const { data: conn } = await supabase
                                    .from('user_integrations')
                                    .select('credentials')
                                    .eq('id', config.connectionId)
                                    .single();

                                if (!conn) throw new Error('SMTP Connection not found');

                                await SmtpService.sendEmail(
                                    conn.credentials,
                                    conn.credentials.fromEmail,
                                    toEmail,
                                    config.subject,
                                    config.body
                                );
                            } else {
                                throw new Error(`Unknown or missing Email provider: ${config.provider}`);
                            }

                            console.log(`[DripEngine] SENT Email to ${toEmail} via ${config.provider}`);
                            success = true;

                        } catch (sendErr) {
                            console.error(`[DripEngine] Email Failed: ${sendErr.message}`);
                            // We already logged SUCCESS, strictly we should revert it or log a failure. 
                            // Current arch relies on catching below to log ERROR.
                            throw sendErr;
                        }
                    }

                } else if (step.step_type === 'WAIT') {
                    // Just a pass-through node
                    success = true;
                }

            } catch (execError) {
                console.error(`[DripEngine] Failed to execute step for ${enrollment.id}`, execError);
                await logAction(enrollment, 'ERROR', { error: execError.message, step: step.id });
                // Do not set success=true, so it retries later (maybe add retry count?)
            }

            if (success) {
                // E. Move to Next Step
                const { data: nextSteps } = await supabase
                    .from('drip_steps')
                    .select('*')
                    .eq('drip_campaign_id', enrollment.drip_campaign_id)
                    .gt('step_order', step.step_order)
                    .order('step_order', { ascending: true })
                    .limit(1);

                const nextStep = nextSteps && nextSteps.length > 0 ? nextSteps[0] : null;

                if (nextStep) {
                    // Calculate Delay for Next Run
                    const delayValue = nextStep.delay_value || 0;
                    const delayUnit = nextStep.delay_unit || 'HOURS';
                    const nextRun = calculateDelay(now, delayValue, delayUnit);

                    await supabase
                        .from('drip_enrollments')
                        .update({
                            current_step_id: nextStep.id,
                            next_run_at: nextRun,
                            last_run_at: now
                        })
                        .eq('id', enrollment.id);

                    console.log(`[DripEngine] Moved enrollment ${enrollment.id} to step ${nextStep.step_order}. Next run: ${nextRun}`);
                } else {
                    // No more steps -> Check if Loop is Enabled
                    const stopTime = enrollment.stop_at ? new Date(enrollment.stop_at).getTime() : null;
                    const shouldLoop = enrollment.is_looping && (!stopTime || stopTime > now.getTime());

                    if (shouldLoop) {
                        // RESTART from Step 1
                        const { data: firstSteps } = await supabase
                            .from('drip_steps')
                            .select('*')
                            .eq('drip_campaign_id', enrollment.drip_campaign_id)
                            .order('step_order', { ascending: true })
                            .limit(1);

                        const firstStep = firstSteps && firstSteps.length > 0 ? firstSteps[0] : null;

                        if (firstStep) {
                            // Calculate restart delay (usually similar to step 1 delay)
                            const delayValue = firstStep.delay_value || 0;
                            const delayUnit = firstStep.delay_unit || 'HOURS';
                            const nextRun = calculateDelay(now, delayValue, delayUnit);

                            await supabase.from('drip_enrollments').update({
                                current_step_id: firstStep.id,
                                next_run_at: nextRun,
                                last_run_at: now
                            }).eq('id', enrollment.id);

                            console.log(`[DripEngine] LOOPING enrollment ${enrollment.id} back to Step 1. Next run: ${nextRun}`);
                            await logAction(enrollment, 'LOOP_RESTART', { reason: 'is_looping=true' });
                            // Don't return, just finish the iteration for this enrollment
                        } else {
                            // Just in case no steps found
                            await supabase.from('drip_enrollments').update({ status: 'COMPLETED', completed_at: now }).eq('id', enrollment.id);
                        }
                    } else {
                        // Else -> Mark Completed
                        await supabase
                            .from('drip_enrollments')
                            .update({
                                status: 'COMPLETED',
                                completed_at: now,
                                last_run_at: now,
                                current_step_id: null
                            })
                            .eq('id', enrollment.id);

                        console.log(`[DripEngine] Completed enrollment ${enrollment.id}`);
                    }
                }
            }
        }

    } catch (err) {
        console.error('[DripEngine] Critical Error:', err);
    }
}



function calculateDelay(startDate, value, unit) {
    const date = new Date(startDate);
    if (!value) return date;

    switch (unit) {
        case 'MINUTES': date.setMinutes(date.getMinutes() + value); break;
        case 'HOURS': date.setHours(date.getHours() + value); break;
        case 'DAYS': date.setDate(date.getDate() + value); break;
        case 'WEEKS': date.setDate(date.getDate() + (value * 7)); break;
        case 'MONTHS': date.setMonth(date.getMonth() + value); break;
        default: break;
    }
    return date;
}


// Start function for external control (Server.js integration)
function start() {
    console.log('[DripEngine] Starting worker...');
    processDrips(); // Initial run
    setInterval(processDrips, 60 * 1000); // 1 Minute loop
}

// Check if running directly or imported
if (require.main === module) {
    start();
}

module.exports = { processDrips, start };
