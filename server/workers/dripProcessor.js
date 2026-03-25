const { createClient } = require('@supabase/supabase-js');
const GmailService = require('../services/GmailService');
const SmtpService = require('../services/SmtpService');
const WhatsAppService = require('../services/whatsappService');
const AIService = require('../services/AIService');

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
        if (idempotencyKey) {
            const { data: existing } = await supabase
                .from('drip_logs')
                .select('id')
                .eq('idempotency_key', idempotencyKey)
                .limit(1)
                .maybeSingle();

            if (existing) {
                console.log(`[DripLog] SKIP: Action '${type}' already processed (Key: ${idempotencyKey})`);
                return { skipped: true };
            }
        }

        const { error } = await supabase.from('drip_logs').insert({
            drip_enrollment_id: enrollment.id,
            contact_id: enrollment.contact_id,
            action_type: type,
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
        return { skipped: false };
    }
}

function isWithinWindow(campaign, now = new Date()) {
    const day = now.getDay();
    const allowedDays = (campaign.allowed_days || '0,1,2,3,4,5,6').split(',').map(Number);
    if (!allowedDays.includes(day)) return false;

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [startH, startM] = (campaign.time_window_start || '00:00').split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const [endH, endM] = (campaign.time_window_end || '23:59').split(':').map(Number);
    const endMinutes = endH * 60 + endM;

    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

function replaceVariables(text, enrollment) {
    if (!text) return '';
    let result = text.toString();
    if (enrollment.contact) {
        const name = enrollment.contact.name || '';
        const phone = enrollment.contact.phone || '';
        const email = enrollment.contact.email || '';
        const firstName = name.split(' ')[0] || '';

        result = result.replace(/{{contact.name}}/g, name);
        result = result.replace(/{{contact.first_name}}/g, firstName);
        result = result.replace(/{{contact.phone}}/g, phone);
        result = result.replace(/{{contact.email}}/g, email);
    }
    return result;
}

async function processDrips() {
    console.log('[DripEngine] Running cycle...');
    const now = new Date();

    try {
        const { data: lockedRows, error: rpcError } = await supabase.rpc('fetch_and_lock_drip_jobs', { batch_size: 10 });
        if (rpcError) {
            console.error('[DripEngine] RPC Error:', rpcError);
            return;
        }

        if (!lockedRows || lockedRows.length === 0) {
            console.log('[DripEngine] No due jobs found.');
            return;
        }

        const dueIds = lockedRows.map(e => e.id);
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

        for (const enrollment of enrollments) {
            try {
                await processSingleEnrollment(enrollment, now);
            } catch (err) {
                console.error(`[DripEngine] Critical failure in enrollment ${enrollment.id}:`, err);
            }
        }
    } catch (error) {
        console.error('[DripEngine] Critical loop failure:', error);
    }
}

async function processSingleEnrollment(enrollment, now = new Date()) {
    try {
        // 1. DUPLICATE CHECK
        const { data: olderEnrollment } = await supabase
            .from('drip_enrollments')
            .select('id')
            .eq('drip_campaign_id', enrollment.drip_campaign_id)
            .eq('contact_id', enrollment.contact_id)
            .in('status', ['ACTIVE', 'PROCESSING'])
            .lt('created_at', enrollment.created_at)
            .limit(1)
            .maybeSingle();

        if (olderEnrollment) {
            console.log(`[DripEngine] DUPLICATE DETECTED: Enrollment ${enrollment.id} redundant. Cancelling.`);
            await supabase.from('drip_enrollments').update({ status: 'DUPLICATE_CANCELLED', completed_at: new Date() }).eq('id', enrollment.id);
            return;
        }

        // 2. STOP AT CHECK
        if (enrollment.stop_at) {
            const stopTime = new Date(enrollment.stop_at).getTime();
            if (stopTime <= now.getTime()) {
                console.log(`[DripEngine] Enrollment ${enrollment.id} expired. Cancelling.`);
                await logAction(enrollment, 'STOP_AT_EXPIRED', { stop_at: enrollment.stop_at });
                await supabase.from('drip_enrollments').update({ status: 'EXPIRED', completed_at: now }).eq('id', enrollment.id);
                return;
            }
        }

        // 3. CAMPAIGN STATUS CHECK
        if (enrollment.drip_campaign.status !== 'ACTIVE') {
            console.log(`[DripEngine] Campaign ${enrollment.drip_campaign.name} not active. Skipping.`);
            return;
        }

        // 4. WINDOW CHECK
        const scheduleConfig = enrollment.current_step.use_custom_schedule ? {
            allowed_days: enrollment.current_step.custom_allowed_days,
            time_window_start: enrollment.current_step.custom_time_start,
            time_window_end: enrollment.current_step.custom_time_end
        } : enrollment.drip_campaign;

        if (!isWithinWindow(scheduleConfig, now)) {
            console.log(`[DripEngine] Enrollment ${enrollment.id} outside delivery window. Waiting.`);
            return;
        }

        // 5. EXECUTE ACTION
        const step = enrollment.current_step;
        let success = false;

        if (step.step_type === 'WHATSAPP_MESSAGE') {
            const idempotencyKey = `MSG-${enrollment.id}-${step.id}`;
            if (!enrollment.contact.phone) {
                await logAction(enrollment, 'SKIPPED', { reason: 'Missing Phone' });
                success = true;
            } else {
                const { skipped } = await logAction(enrollment, 'MESSAGE_SENT', { template: step.step_config.template_name, to: enrollment.contact.phone }, idempotencyKey);
                if (skipped) {
                    success = true;
                } else {
                    try {
                        const config = step.step_config;
                        const templateName = config.template_name;
                        const params = config.parameters || {};
                        let langCode = config.template_language?.code || config.template_language || 'en';

                        let components = [];
                        if (config.template_type === 'CAROUSEL') {
                            if (params.body && Array.isArray(params.body) && params.body.length > 0) {
                                components.push({
                                    type: 'carousel',
                                    cards: [{ card_index: 0, components: [{ type: 'body', parameters: params.body.map(v => ({ type: 'text', text: replaceVariables(v, enrollment) })) }] }]
                                });
                            }
                        } else {
                            if (params.header) {
                                if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(params.header.type?.toUpperCase()) && params.header.url) {
                                    components.push({ type: 'header', parameters: [{ type: params.header.type.toLowerCase(), [params.header.type.toLowerCase()]: { link: params.header.url } }] });
                                } else if (params.header.type?.toUpperCase() === 'TEXT' && params.header.text) {
                                    components.push({ type: 'header', parameters: [{ type: 'text', text: replaceVariables(params.header.text, enrollment) }] });
                                }
                            }
                            if (params.body && Array.isArray(params.body)) {
                                components.push({ type: 'body', parameters: params.body.map(v => ({ type: 'text', text: replaceVariables(v, enrollment) })) });
                            }
                        }

                        await WhatsAppService.sendMessage(enrollment.drip_campaign.user_id, enrollment.contact.phone, 'template', { name: templateName, language: { code: langCode }, components });
                        console.log(`[DripEngine] SENT WA to ${enrollment.contact.phone}`);
                        success = true;
                    } catch (e) {
                        console.error('[DripEngine] WA Failed:', e.message);
                        await logAction(enrollment, 'FAILED', { error: e.message });
                        success = true;
                    }
                }
            }
        } else if (step.step_type === 'EMAIL') {
            const idempotencyKey = `EMAIL-${enrollment.id}-${step.id}`;
            if (!enrollment.contact.email) {
                await logAction(enrollment, 'SKIPPED', { reason: 'Missing Email' });
                success = true;
            } else {
                const { skipped } = await logAction(enrollment, 'EMAIL_SENT', { to: enrollment.contact.email }, idempotencyKey);
                if (skipped) {
                    success = true;
                } else {
                    try {
                        const config = step.step_config || {};
                        let toEmail = replaceVariables(config.to || enrollment.contact.email, enrollment);
                        const subject = replaceVariables(config.subject || '', enrollment);
                        const body = replaceVariables(config.body || '', enrollment);

                        if (config.provider === 'GMAIL') {
                            await GmailService.sendEmail(enrollment.drip_campaign.user_id, config.connectionId, toEmail, subject, body);
                        } else if (config.provider === 'SMTP') {
                            const { data: conn } = await supabase.from('user_integrations').select('credentials').eq('id', config.connectionId).single();
                            if (!conn) throw new Error('SMTP Connection not found');
                            await SmtpService.sendEmail(conn.credentials, conn.credentials.fromEmail, toEmail, subject, body);
                        }
                        console.log(`[DripEngine] SENT Email to ${toEmail}`);
                        success = true;
                    } catch (e) {
                        console.error('[DripEngine] Email Failed:', e.message);
                        await logAction(enrollment, 'FAILED', { error: e.message });
                        success = true;
                    }
                }
            }
        } else if (step.step_type === 'WAIT' || step.step_type === 'AI_INTENT') {
            // WAIT is a pass-through. AI_INTENT logic would be complex, keeping it simplified for now or adding back if needed.
            // But user wants to see it works. I'll add back basic AI_INTENT.
            if (step.step_type === 'AI_INTENT') {
                 try {
                    const { data: lastMsg } = await supabase.from('messages').select('content').eq('contact_id', enrollment.contact_id).eq('type', 'inbound').order('created_at', { ascending: false }).limit(1).maybeSingle();
                    if (lastMsg) {
                        const config = step.step_config || {};
                        const intent = await AIService.analyzeIntent(lastMsg.content, config.intents || [], config.analysis_mode, enrollment.drip_campaign.user_id, config.openai_connection_id);
                        await logAction(enrollment, 'AI_ANALYSIS', { result: intent });
                    }
                 } catch (e) { console.error('AI Step Failed', e); }
            }
            success = true;
        }

        if (success) {
            const { data: nextSteps } = await supabase.from('drip_steps').select('*').eq('drip_campaign_id', enrollment.drip_campaign_id).gt('step_order', step.step_order).order('step_order', { ascending: true }).limit(1);
            const nextStep = nextSteps?.[0];

            if (nextStep) {
                const nextRun = calculateDelay(now, nextStep.delay_value || 0, nextStep.delay_unit || 'HOURS');
                await supabase.from('drip_enrollments').update({ current_step_id: nextStep.id, next_run_at: nextRun, last_run_at: now }).eq('id', enrollment.id);
                console.log(`[DripEngine] Moved ${enrollment.id} to step ${nextStep.step_order}`);
            } else {
                const shouldLoop = enrollment.is_looping && (!enrollment.stop_at || new Date(enrollment.stop_at) > now);
                if (shouldLoop) {
                    const { data: firstSteps } = await supabase.from('drip_steps').select('*').eq('drip_campaign_id', enrollment.drip_campaign_id).order('step_order', { ascending: true }).limit(1);
                    const firstStep = firstSteps?.[0];
                    if (firstStep) {
                        const nextRun = calculateDelay(now, firstStep.delay_value || 0, firstStep.delay_unit || 'HOURS');
                        await supabase.from('drip_enrollments').update({ current_step_id: firstStep.id, next_run_at: nextRun, last_run_at: now }).eq('id', enrollment.id);
                        await logAction(enrollment, 'LOOP_RESTART');
                    }
                } else {
                    await supabase.from('drip_enrollments').update({ status: 'COMPLETED', completed_at: now, last_run_at: now, current_step_id: null }).eq('id', enrollment.id);
                    console.log(`[DripEngine] Completed ${enrollment.id}`);
                }
            }
        }
    } catch (err) {
        console.error(`[DripEngine] Error in ${enrollment.id}:`, err);
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
    }
    return date;
}

function start() {
    console.log('[DripEngine] Starting worker...');
    processDrips();
    setInterval(processDrips, 60000);
}

if (require.main === module) { start(); }
module.exports = { processDrips, start, processSingleEnrollment, replaceVariables };
