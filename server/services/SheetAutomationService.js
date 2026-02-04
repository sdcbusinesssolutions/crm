const { supabaseAdmin } = require('../lib/supabaseClient');
const { google } = require('googleapis');
const whatsappService = require('./whatsappService');
const crypto = require('crypto');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { logGoogleSheetEvent } = require('../utils/logger'); // Import Logger

// Cache for Service Account Auth (Key: email, Value: { token, expiresAt })
const serviceTokenCache = new Map();

class SheetAutomationService {

    /**
     * Compute a unique hash for a row's core data to prevent duplicate sends.
     * We use specific columns if possible, or the whole row.
     */
    computeRowHash(rowObj) {
        // Sort keys to ensure consistency
        const keys = Object.keys(rowObj).sort();
        const dataStr = keys.map(k => `${k}:${rowObj[k]}`).join('|');
        return crypto.createHash('md5').update(dataStr).digest('hex');
    }

    async getAuthClient(userId, connectionId) {
        // GLOBAL PROXY CLEANUP (Critical for googleapis/gaxios)
        // Ensure no proxy environment variables are set that could confuse Gaxios
        // AGGRESSIVE PROXY CLEANUP (Critical for googleapis/gaxios)
        // Ensure no proxy environment variables are set that could confuse Gaxios
        ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'ALL_PROXY', 'all_proxy', 'NO_PROXY', 'no_proxy', 'npm_config_proxy', 'npm_config_https_proxy'].forEach(v => {
            if (process.env[v] !== undefined) delete process.env[v];
        });

        // Explicitly tell Node/Gaxios to NOT use proxy for Google APIs by setting NO_PROXY to wildcard
        process.env.NO_PROXY = '*';

        // Use existing logic to fetch integration
        const { data: integration, error } = await supabaseAdmin
            .from('user_integrations')
            .select('*')
            .eq('id', connectionId)
            .eq('user_id', userId)
            .single();

        if (error) {
            console.error('[SheetAuto] Supabase fetch error:', error);
            throw new Error('Database error while fetching integration');
        }
        if (!integration) {
            console.warn('[SheetAuto] No integration found for:', { userId, connectionId });
            throw new Error('No credentials provided');
        }

        const creds = integration.credentials;
        console.log(`[SheetAuto] Auth Check: private_key=${!!creds.private_key}, client_email=${!!creds.client_email}`);

        // --- OPTION A: Service Account (Permanent, No Expiry) ---
        // If the credentials JSON has 'private_key', treat it as a Service Account.
        if (creds.private_key && creds.client_email) {
            console.log('[SheetAutomation] Using Service Account for Auth');

            const email = creds.client_email;
            const now = Math.floor(Date.now() / 1000);

            // 1. CACHE CHECK
            if (serviceTokenCache.has(email)) {
                const cached = serviceTokenCache.get(email);
                // Check valid with 5min buffer
                if (cached.expiresAt > now + 300) {
                    console.log('[SheetAutomation] Using Cached Service Token');
                    const oauth2Client = new google.auth.OAuth2();
                    oauth2Client.setCredentials({ access_token: cached.token });
                    return oauth2Client;
                }
            }

            // 2. EXCHANGE
            // SERVICE ACCOUNT TOKEN REFRESH: Not needed manually. 
            // We generate a fresh JWT for every execution session using the private key. This key never expires.

            // Clean Key
            let privateKey = creds.private_key;
            if (typeof privateKey === 'string') {
                if (privateKey.includes('\\n')) privateKey = privateKey.replace(/\\n/g, '\n');
                privateKey = privateKey.replace(/^"|"$/g, '');
            }

            try {
                // MANUAL JWT EXCHANGE (Bypassing Gaxios "Invalid Host")
                const payload = {
                    iss: creds.client_email,
                    scope: 'https://www.googleapis.com/auth/spreadsheets',
                    aud: 'https://oauth2.googleapis.com/token',
                    exp: now + 3600,
                    iat: now
                };

                const token = jwt.sign(payload, privateKey, { algorithm: 'RS256' });

                const exchangeUrl = 'https://oauth2.googleapis.com/token';
                const exchangeParams = new URLSearchParams();
                exchangeParams.append('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer');
                exchangeParams.append('assertion', token);

                const response = await axios.post(exchangeUrl, exchangeParams, {
                    proxy: false
                });
                const accessToken = response.data.access_token;
                const expiresIn = response.data.expires_in || 3600;

                if (!accessToken) throw new Error('No access_token from Manual JWT');

                console.log('[SheetAutomation] Manual JWT Exchange SUCCESS.');

                // 3. CACHE UPDATE
                serviceTokenCache.set(email, {
                    token: accessToken,
                    expiresAt: now + expiresIn
                });

                // Wrap in OAuth2Client so google.sheets can use it
                const oauth2Client = new google.auth.OAuth2();
                oauth2Client.setCredentials({ access_token: accessToken });

                return oauth2Client;

            } catch (err) {
                console.error('[SheetAutomation] Service Account Auth Error (Manual JWT):', err.message);
                throw new Error(`Service Account Auth Failed: ${err.message}`);
            }
        }

        // --- OPTION B: OAuth2 (User Account) ---
        const oauth2Client = new google.auth.OAuth2(
            creds.params_client_id || process.env.GOOGLE_CLIENT_ID,
            creds.params_client_secret || process.env.GOOGLE_CLIENT_SECRET,
            creds.params_redirect_url || process.env.GOOGLE_REDIRECT_URL
        );

        oauth2Client.setCredentials(creds);

        // PROACTIVE REFRESH: Check if token is expired or expiring soon (within 5 mins)
        // expiry_date is in milliseconds
        const now = Date.now();
        const EXPIRY_BUFFER = 5 * 60 * 1000;
        const isExpiring = creds.expiry_date && (creds.expiry_date <= now + EXPIRY_BUFFER);

        if (isExpiring && creds.refresh_token) {
            console.log('[SheetAutomation] Token expiring soon, refreshing proactively...');
            try {
                const { credentials } = await oauth2Client.refreshAccessToken();

                const newCreds = { ...creds, ...credentials };

                // Update DB immediately
                await supabaseAdmin
                    .from('user_integrations')
                    .update({
                        credentials: newCreds,
                        updated_at: new Date()
                    })
                    .eq('id', connectionId);

                // Update client
                oauth2Client.setCredentials(newCreds);
                console.log('[SheetAutomation] Proactive refresh successful.');
            } catch (err) {
                console.error('[SheetAutomation] Proactive refresh failed:', err.message);
            }
        }

        // PERSISTENCE LISTENER: (Only for OAuth)
        // When googleapis refreshes the token automatically (upon 401), this event fires.
        // We MUST save the new access_token (and refresh_token if rotated) to the DB.
        // Otherwise, the Next execution will start with the old expired token again, force a refresh again, 
        // and if refresh_token rotates/expires, we lose access.
        oauth2Client.on('tokens', async (tokens) => {
            console.log('[SheetAutomation] Token Refresh Event triggered.');

            // Merge new tokens with existing creds
            // (tokens event might only return access_token, so we keep old refresh_token unless new one provided)
            const newCreds = { ...creds, ...tokens };

            const { error: updateError } = await supabaseAdmin
                .from('user_integrations')
                .update({
                    credentials: newCreds,
                    updated_at: new Date()
                })
                .eq('id', connectionId);

            if (updateError) {
                console.error('[SheetAutomation] Failed to persist refreshed token:', updateError.message);
            } else {
                console.log('[SheetAutomation] Refreshed tokens persisted to DB.');
            }
        });

        return oauth2Client;
    }

    /**
     * MAIN ENTRY POINT: Run all active automations
     */
    async processJobs() {
        // console.log('[SheetAutomation] Checking for jobs...');

        // 1. Fetch Active Automations
        const { data: automations, error } = await supabaseAdmin
            .from('sheet_automations')
            .select('*')
            .eq('status', 'active');

        if (error || !automations) return;

        for (const auto of automations) {
            try {
                if (this.shouldRun(auto)) {
                    console.log(`[SheetAutomation] Running Job: ${auto.name} (${auto.id})`);
                    await this.executeJob(auto);
                }
            } catch (err) {
                console.error(`[SheetAutomation] Error processing job ${auto.id}:`, err);
            }
        }
    }

    shouldRun(auto) {
        // Enforce IST Timezone for all logic
        const now = new Date();

        // precise formatter for parsing numeric values from IST
        const getISTPart = (part) => {
            const f = new Intl.DateTimeFormat('en-US', {
                timeZone: 'Asia/Kolkata',
                [part]: 'numeric',
                hour12: false
            });
            return parseInt(f.format(now));
        };

        const getISTString = (opts) => now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata', ...opts });

        const currentYear = getISTPart('year');
        const currentMonth = getISTPart('month') - 1; // JS months are 0-11
        const currentDateNum = getISTPart('day');
        const currentHour = getISTPart('hour');
        const currentMinute = getISTPart('minute');
        // Weekday: "Mon", "Tue"
        const currentDayStr = getISTString({ weekday: 'short' });

        // const lastRun = auto.last_run_at ? new Date(auto.last_run_at) : null;
        // NOTE: last_run_at is stored in UTC in DB usually. We need to compare "Is last run TODAY in IST?"
        // So we convert last_run_at to IST components too.
        let lastRunIST = null;
        if (auto.last_run_at) {
            const lr = new Date(auto.last_run_at);
            const getLRP = (part) => parseInt(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', [part]: 'numeric', hour12: false }).format(lr));
            lastRunIST = {
                year: getLRP('year'),
                month: getLRP('month') - 1,
                day: getLRP('day')
            };
        }

        const logReason = (reason) => {
            // Only log valid candidates (has schedule_config) to avoid spam
            if (auto.schedule_config) {
                // Log granular reasons to file for debugging user complaints
                logGoogleSheetEvent('SCHEDULE_CHECK_SKIP', {
                    automation_id: auto.id,
                    automation_name: auto.name,
                    reason: reason,
                    current_ist: `${currentHour}:${currentMinute}`,
                    target_time: auto.schedule_config?.time,
                    last_run: auto.last_run_at
                });
            }
        };

        if (auto.automation_type === 'new_row') {
            // Poll every 5 minutes
            if (!auto.last_run_at) return true;
            const lastRunDate = new Date(auto.last_run_at);
            const diffMinutes = (now - lastRunDate) / 1000 / 60;
            const shouldRun = diffMinutes >= 5;
            if (!shouldRun) {
                // Too spammy to log every skip? Maybe only on verbose
            }
            return shouldRun;
        }

        if (auto.automation_type === 'schedule') {
            if (!auto.schedule_config) {
                logReason("No schedule config");
                return false;
            }

            const { time, days, frequency, day_of_month } = auto.schedule_config;
            // frequency: daily, weekly, monthly, custom (One-Time)

            // SPECIAL CASE: Custom / One-Time
            if (frequency === 'custom') {
                if (auto.last_run_at) {
                    logReason("Custom schedule already ran once.");
                    return false;
                }
                // Check time
                if (!time) return true;
                const [th, tm] = time.split(':').map(Number);
                const isDue = (currentHour > th) || (currentHour === th && currentMinute >= tm);

                if (isDue) {
                    console.log(`[Schedule Check] MATCH (One-Time)! Executing ${auto.name}.`);
                    logGoogleSheetEvent('SCHEDULE_MATCH', {
                        automation_id: auto.id,
                        name: auto.name,
                        type: 'CUSTOM_ONE_TIME',
                        time: time
                    });
                    return true;
                }
                logReason("One-Time: Waiting for time.");
                return false;
            }

            // 1. CHECK DATE (Day/Month/Week)
            let isCorrectDate = false;

            if (frequency === 'weekly') {
                if (days && days.includes(currentDayStr)) isCorrectDate = true;
                else logReason(`Weekly mismatch. Today: ${currentDayStr}, Config: ${JSON.stringify(days)}`);
            } else if (frequency === 'monthly') {
                if (day_of_month && parseInt(day_of_month) === currentDateNum) isCorrectDate = true;
                else logReason(`Monthly mismatch. Today: ${currentDateNum}, Config: ${day_of_month}`);
            } else {
                // 'daily'
                isCorrectDate = true;
            }

            if (!isCorrectDate) return false;

            // 2. CHECK TIME match (Hourly granularity check, but run immediately if passed)
            // Logic: Run if CurrentTime >= ScheduledTime AND hasn't run today.
            if (!time) {
                logReason("No time configured");
                return false;
            }
            const [targetHour, targetMinute] = time.split(':').map(Number);

            const isTimeDue = (currentHour > targetHour) || (currentHour === targetHour && currentMinute >= targetMinute);

            if (!isTimeDue) {
                logReason(`Not due yet. Current IST: ${currentHour}:${currentMinute}, Target: ${time}`);
                return false;
            }

            // 3. CHECK LAST RUN (Prevent double run for THIS schedule instance)
            if (lastRunIST) {
                // If it ran on a DIFFERENT day, we ignore it (allow run).
                // If it ran TODAY, we check if it ran *for this schedule* or a previous one.
                if (lastRunIST.year === currentYear && lastRunIST.month === currentMonth && lastRunIST.day === currentDateNum) {

                    // It ran today. But did it run *at or after* the target time?
                    // If LastRunTime >= TargetTime, then we have already fulfilled this schedule.
                    // If LastRunTime < TargetTime, it implies a previous (earlier) schedule or manual run, so we allow it.

                    const lrDate = new Date(auto.last_run_at);
                    const f = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: 'numeric', hour12: false });
                    const parts = f.formatToParts(lrDate);
                    const p = {};
                    parts.forEach(x => p[x.type] = x.value);

                    // Parse IST hour/min of the LAST RUN
                    // Note: '24' hour format usually returns '0'-'23'. Check format.
                    let lrHour = parseInt(p.hour);
                    if (lrHour === 24) lrHour = 0; // Edge case just in case
                    const lrMinute = parseInt(p.minute);

                    const hasRunForThisSlot = (lrHour > targetHour) || (lrHour === targetHour && lrMinute >= targetMinute);

                    if (hasRunForThisSlot) {
                        logReason(`Already ran for this time slot today. Last Run: ${lrHour}:${lrMinute}, Target: ${time}`);
                        return false;
                    }
                }
            }

            console.log(`[Schedule Check] MATCH! Executing ${auto.name}. Current IST: ${currentHour}:${currentMinute}, Target: ${time}`);
            logGoogleSheetEvent('SCHEDULE_MATCH', {
                automation_id: auto.id,
                name: auto.name,
                type: frequency,
                time: time,
                current_ist: `${currentHour}:${currentMinute}`
            });
            return true;
        }

        return false;
    }

    async triggerById(id, userId) {
        // 1. Fetch Automation
        const { data: auto, error } = await supabaseAdmin
            .from('sheet_automations')
            .select('*')
            .eq('id', id)
            .eq('user_id', userId)
            .single();

        if (error || !auto) throw new Error('Automation not found or access denied');

        console.log(`[SheetAutomation] Manual Trigger for ${auto.name} (${auto.id})`);

        // 2. Execute
        // Pass a flag to indicate manual run if needed, but logic remains same
        await this.executeJob(auto, true);

        return { success: true };
    }

    async executeJob(auto, isManual = false) {
        // 1. LOCK: Update last_run_at immediately to prevent race conditions
        if (!isManual) {
            await supabaseAdmin.from('sheet_automations').update({
                last_run_at: new Date()
            }).eq('id', auto.id);
        }

        const logSummary = {
            total_rows: 0,
            conditions_met: 0,
            already_sent: 0,
            sent_successfully: 0,
            errors: 0
        };

        try {
            let isRecurring = false; // Moved to top scope to prevent ReferenceError
            // 2. Setup Auth (Get Token)
            const authClient = await this.getAuthClient(auto.user_id, auto.connection_id);
            const accessToken = authClient.credentials.access_token;

            if (!accessToken) throw new Error('Failed to retrieve Access Token');

            // 3. Fetch Data (Using Axios directly to bypass Gaxios/Proxy issues)
            const spreadsheetId = auto.spreadsheet_id;
            const range = encodeURIComponent(auto.sheet_name);
            const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`;

            console.log(`[SheetAutomation] Fetching sheet data via Axios: ${url}`);

            const response = await axios.get(url, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                proxy: false // FORCE NO PROXY
            });

            const rows = response.data.values;
            if (!rows || rows.length < 2) {
                console.log('[SheetAutomation] No data found in sheet.');
                return;
            }

            const headers = rows[0];
            const dataRows = rows.slice(1);
            logSummary.total_rows = dataRows.length;

            console.log(`[SheetAutomation] Found ${dataRows.length} rows for ${auto.name}.`);

            // 4. History / Deduplication Setup
            // Determine Deduplication Window based on Trigger Type
            // If trigger uses recurring date logic (e.g. Birthday), we deduct per day/year.
            // If trigger is static (e.g. Status=Paid), we deduct per LIFETIME (never send twice for same row state).

            // Helper for IST Start of Day (Unique per execution to ensure freshness)
            const getISTStart = () => {
                const n = new Date();
                const f = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'numeric', day: 'numeric' });
                const p = f.formatToParts(n);
                const m = {};
                p.forEach(x => m[x.type] = x.value);
                // UTC args: Y, M-1, D. Subtract 5.5h (19800000ms) offset.
                return new Date(Date.UTC(m.year, m.month - 1, m.day) - 19800000);
            };

            let timeWindow = new Date(0); // Default: Lifetime Check (Never repeats)
            let dedupeMode = 'LIFETIME';
            // isRecurring defined at top


            // Bypass for Manual Trigger (Test Mode) -> Ignore History
            if (isManual) {
                timeWindow = new Date(); // Start "Now" (Effectively ignores all past history)
                dedupeMode = 'NONE (MANUAL)';
            } else {
                // Determine Mode based on Config
                const freq = auto.schedule_config?.frequency;

                // 1. Explicit Frequency?
                // CRITICAL CHANGE: Simply having a 'daily' schedule should NOT imply we want to resend to the same person every day.
                // It usually means "Check daily for NEW people".
                // We only enable Recurrence (resetting history) if there is a Logic Condition that implies repetition (e.g., Birthday).

                if (auto.schedule_config?.recurring === true) {
                    isRecurring = true;
                }

                /*
                if (freq && ['daily', 'weekly', 'monthly'].includes(freq)) {
                    // OLD: isRecurring = true; 
                }
                */

                // 2. Implicit Recurrence via Conditions (e.g. Birthday / Anniversary)
                const conditions = Array.isArray(auto.trigger_condition) ? auto.trigger_condition : [auto.trigger_condition];
                for (const cond of conditions) {
                    if (cond && ['is_today', 'is_yesterday', 'is_tomorrow', 'day_month_equal', 'day_month_after', 'day_month_before', 'in_last_x_days', 'in_next_x_days'].includes(cond.operator)) {
                        isRecurring = true;
                        break;
                    }
                }

                if (isRecurring) {
                    timeWindow = getISTStart();
                    dedupeMode = 'TODAY (IST) - Recurring Condition Detected';
                } else {
                    dedupeMode = 'LIFETIME (Safe Mode)';
                }
            }

            console.log(`[SheetAuto] Dedupe Mode: ${dedupeMode}. Window Start: ${timeWindow.toISOString()}`);

            const sentHashes = await this.getSentHashes(auto.id, timeWindow);

            // 5. Processing Loop
            const isScheduleLogic = auto.automation_type === 'schedule' || isManual;

            // Pre-process logging context
            const baseLogContext = {
                automation_id: auto.id,
                automation_name: auto.name,
                sheet_id: spreadsheetId,
                sheet_name: auto.sheet_name
            };

            logGoogleSheetEvent('SHEET_FETCH_SUCCESS', {
                ...baseLogContext,
                row_count: dataRows.length
            });

            if (!isScheduleLogic && auto.automation_type === 'new_row') {
                const lastIndex = auto.last_processed_row_index || 0;
                const newRows = dataRows.slice(lastIndex);

                const statusColName = auto.mapping_config?.status_column;
                let statusColIndex = -1;
                if (statusColName && headers) {
                    statusColIndex = headers.findIndex(h => h && String(h).trim().toLowerCase() === String(statusColName).trim().toLowerCase());
                }

                logGoogleSheetEvent('NEW_ROWS_DETECTED', {
                    ...baseLogContext,
                    count: newRows.length,
                    start_index: lastIndex
                });

                for (let i = 0; i < newRows.length; i++) {
                    const row = newRows[i];
                    const rowObj = this.mapRow(headers, row);
                    const phone = rowObj[auto.mapping_config?.phone_col] || 'unknown';

                    // FIX: Apply Filtering Logic (Conditions)
                    const conditionMet = this.checkCondition(auto.trigger_condition, rowObj);
                    if (!conditionMet) {
                        console.log(`[SheetAuto] New Row Skipped (Condition Failed): Phone=${phone}`);
                        logGoogleSheetEvent('ROW_SKIPPED', {
                            ...baseLogContext,
                            reason: 'Condition Failed',
                            phone: phone,
                            row_data: rowObj
                        });
                        continue;
                    }

                    try {
                        await this.sendMessageWithHistory(auto, rowObj, null);
                        logSummary.sent_successfully++;

                        logGoogleSheetEvent('MESSAGE_SENT', {
                            ...baseLogContext,
                            phone: phone,
                            mode: 'New Row'
                        });

                        if (statusColIndex !== -1) {
                            const rowIndex = lastIndex + i + 2;
                            await this.writeStatus(authClient, spreadsheetId, auto.sheet_name, rowIndex, statusColIndex, 'Sent');
                        }
                    } catch (e) {
                        // If reservation failed (duplicate), it throws 'Duplicate' error usually or we handle it?
                        // sendMessageWithHistory handles the flow. If it throws, it means send failed or reserve failed.
                        if (e.message !== 'Skipped: Duplicate Pending/Sent') {
                            logSummary.errors++;
                            console.error('Send Error:', e);
                            logGoogleSheetEvent('SEND_ERROR', {
                                ...baseLogContext,
                                phone: phone,
                                error: e.message
                            });
                        } else {
                            logSummary.already_sent++;
                            logGoogleSheetEvent('ROW_SKIPPED', {
                                ...baseLogContext,
                                reason: 'Duplicate (Pending/Sent)',
                                phone: phone
                            });
                        }
                    }
                }

                await supabaseAdmin.from('sheet_automations').update({
                    last_processed_row_index: lastIndex + newRows.length,
                    error_log: this.formatLog(logSummary)
                }).eq('id', auto.id);

            } else {
                // Schedule or Manual Mode
                const statusColName = auto.mapping_config?.status_column;
                let statusColIndex = -1;
                if (statusColName && headers) {
                    statusColIndex = headers.findIndex(h => h && String(h).trim().toLowerCase() === String(statusColName).trim().toLowerCase());
                }

                logGoogleSheetEvent('START_SCHEDULE_SCAN', {
                    ...baseLogContext,
                    total_rows: dataRows.length,
                    dedupe_mode: dedupeMode,
                    recurring_mode: isRecurring
                });

                for (let i = 0; i < dataRows.length; i++) {
                    const row = dataRows[i];
                    const rowObj = this.mapRow(headers, row);
                    const phone = rowObj[auto.mapping_config?.phone_col] || 'unknown';

                    // DEBUG: Log first row to verifying mapping
                    // console.log('[SheetAuto] Processing Row:', JSON.stringify(rowObj));

                    // A. Check Trigger Condition
                    const conditionMet = this.checkCondition(auto.trigger_condition, rowObj);
                    if (conditionMet) {
                        logSummary.conditions_met++;
                        console.log(`[SheetAuto] Condition MET for row: Phone=${phone}`);

                        // B. Check Write-back Status (Case Insensitive Lookup)
                        const statusCol = auto.mapping_config?.status_column;
                        if (statusCol) {
                            // Find the actual key in rowObj that matches the configured status column (ignoring case/trim)
                            const actualKey = Object.keys(rowObj).find(k =>
                                String(k).trim().toLowerCase() === String(statusCol).trim().toLowerCase()
                            );

                            if (actualKey && rowObj[actualKey]?.trim().toLowerCase() === 'sent') {
                                logSummary.already_sent++;
                                console.log(`[SheetAuto] Skipped: Already marked as SENT in sheet (Col: ${actualKey}).`);

                                logGoogleSheetEvent('ROW_SKIPPED', {
                                    ...baseLogContext,
                                    phone: phone,
                                    reason: 'Status Column is SENT'
                                });
                                continue;
                            }
                        }

                        // C. Check History Hash (Robust Deduplication)
                        const statusColName = auto.mapping_config?.status_column;
                        let rowHash = this.computeRowHash(rowObj, statusColName);

                        // MANUAL TRIGGER: Force uniqueness to allow re-send and bypass DB constraints
                        if (isManual) {
                            rowHash = `${rowHash}_MANUAL_${Date.now()}`;
                            console.log('[SheetAuto] Manual Trigger: Generated unique hash to force send.');
                        } else {
                            // SCHEDULE TRIGGER: Strict Deduplication
                            if (sentHashes.has(rowHash)) {
                                logSummary.already_sent++;
                                const msg = `Skipped: Message already sent to this row (Safety Lock). RowHash=${rowHash.substring(0, 8)}`;
                                console.log(`[SheetAuto] ${msg}`);
                                logGoogleSheetEvent('ROW_SKIPPED', {
                                    ...baseLogContext,
                                    phone: phone,
                                    reason: 'Already Sent (History/Dedupe Prevention)',
                                    hash: rowHash
                                });
                                continue;
                            }
                        }

                        // Send with Reservation Pattern
                        try {
                            console.log('[SheetAuto] Attempting to Send Message...');
                            await this.sendMessageWithHistory(auto, rowObj, rowHash);
                            logSummary.sent_successfully++;
                            console.log('[SheetAuto] Message Sent Successfully!');
                            // Success -> Add to local dedupe set
                            sentHashes.add(rowHash);

                            logGoogleSheetEvent('MESSAGE_SENT', {
                                ...baseLogContext,
                                phone: phone,
                                hash: rowHash
                            });

                            if (statusColIndex !== -1) {
                                const rowIndex = i + 2; // 1-based (header=1) + index
                                await this.writeStatus(authClient, spreadsheetId, auto.sheet_name, rowIndex, statusColIndex, 'Sent');
                            }
                        } catch (e) {
                            if (e.message === 'Skipped: Duplicate Pending/Sent') {
                                logSummary.already_sent++;
                                console.log('[SheetAuto] Skipped due to concurrency (Duplicate Pending).');
                                logGoogleSheetEvent('ROW_SKIPPED', {
                                    ...baseLogContext,
                                    phone: phone,
                                    reason: 'Concurrency (Duplicate Pending)'
                                });
                            } else {
                                logSummary.errors++;
                                console.error('[SheetAuto] Send Error:', e.message);
                                logGoogleSheetEvent('SEND_ERROR', {
                                    ...baseLogContext,
                                    phone: phone,
                                    error: e.message
                                });

                                // CRITICAL: Even if it fails (e.g. invalid template), we MUST add to history
                                // to prevent the scheduler from retrying this same bad row every minute forever.
                                // Users can retry manually after fixing the data.
                                sentHashes.add(rowHash);
                            }
                        }
                    } else {
                        // Condition Failed
                        // Only log verbose if needed, usually just count
                        // console.log(`[SheetAuto] Condition FAILED for row. Phone=${phone}`);
                    }
                }

                // Final Update with Stats
                console.log('[SheetAuto] Job Completed. Summary:', logSummary);

                const updatePayload = {
                    error_log: this.formatLog(logSummary)
                };

                // Only update last_run_at if it's a SCHEDULED run (not manual)
                // This ensures manual testing doesn't block the daily schedule from triggering.
                if (!isManual) {
                    updatePayload.last_run_at = new Date();
                }

                await supabaseAdmin.from('sheet_automations').update(updatePayload).eq('id', auto.id);
            }

            // Log to File System
            logGoogleSheetEvent('JOB_SUMMARY', {
                ...baseLogContext,
                is_manual: isManual,
                recurring_mode: isRecurring ? 'YES' : 'NO',
                dedupe_mode: dedupeMode,
                stats: logSummary
            });

            return logSummary;

        } catch (err) {
            console.error(`[SheetAutomation] Job Failed:`, { message: err.message, stack: err.stack, code: err.code });
            await supabaseAdmin.from('sheet_automations').update({
                error_log: `CRITICAL FAILURE: ${err.message}`,
                last_run_at: new Date()
            }).eq('id', auto.id);
            throw err;
        }
    }

    // --- Helpers for History ---

    async getSentHashes(automationId, sinceDate) {
        const { data, error } = await supabaseAdmin
            .from('sheet_automation_history')
            .select('row_hash')
            .eq('automation_id', automationId)
            .gte('sent_at', sinceDate.toISOString())
            .in('status', ['sent', 'pending']); // Exclude 'failed' so they can retry

        if (error) {
            console.error('Error fetching history:', error);
            return new Set();
        }
        return new Set(data.map(r => r.row_hash));
    }

    async sendMessageWithHistory(auto, rowObj, rowHash) {
        const finalHash = rowHash || this.computeRowHash(rowObj, auto.mapping_config?.status_column);
        const phoneCol = auto.mapping_config.phone_col;
        const phone = rowObj[phoneCol] || 'unknown';

        // 1. RESERVE: Insert 'pending' status
        // Note: If multiple runners, this might fail on unique constraint? 
        // We don't have a unique constraint on (automation_id, row_hash) in the table definition I made earlier.
        // So we just check if it exists first? No, we rely on 'sentHashes' for in-memory batch.
        // But for cross-process, we insert.

        const { data: inserted, error: insertError } = await supabaseAdmin.from('sheet_automation_history').insert({
            automation_id: auto.id,
            row_hash: finalHash,
            phone_number: phone,
            status: 'pending',
            sent_at: new Date(),
            meta: { row_data: rowObj }
        }).select().single();

        if (insertError) {
            // If sensitive, maybe fail? But usually we proceed. 
            console.warn('[SheetAuto] History insert failed (Continuing):', insertError.message);
            // If it's a unique constraint violation, it means another process already reserved/sent it.
            // In this case, we should treat it as already sent/pending and skip.
            if (insertError.code === '23505') { // Unique violation error code for PostgreSQL
                throw new Error('Skipped: Duplicate Pending/Sent');
            }
        }
        const historyId = inserted?.id;

        try {
            // 2. SEND
            await this.sendMessage(auto, rowObj);

            // 3. CONFIRM: Update to 'sent'
            if (historyId) {
                await supabaseAdmin.from('sheet_automation_history')
                    .update({ status: 'sent' })
                    .eq('id', historyId);
            }
        } catch (err) {
            // 4. ROLLBACK: Update to 'failed'
            if (historyId) {
                await supabaseAdmin.from('sheet_automation_history')
                    .update({ status: 'failed', meta: { row_data: rowObj, error: err.message } })
                    .eq('id', historyId);
            }
            throw err;
        }
    }

    computeRowHash(rowObj, statusColumnName = null) {
        // Robust Hash: Sort keys to ensure consistency regardless of insertion order
        let keys = Object.keys(rowObj).sort();

        // CRITICAL: Exclude the status column from the hash.
        // Whether the status is "" or "Sent", the row identity is the same.
        // If we include it, the hash changes after sending, bypassing the history check on the next run.
        if (statusColumnName) {
            const normalizedStatusCol = String(statusColumnName).trim().toLowerCase();
            keys = keys.filter(k => String(k).trim().toLowerCase() !== normalizedStatusCol);
        }

        // Create deterministic string: key:value|key:value...
        // We use a simple concatenation for speed, but could use crypto for shorter storage if needed.
        // For debugging, plain string is nicer but long. Let's use crypto for the DB storage.

        const dataStr = keys.map(k => `${k}:${String(rowObj[k]).trim()}`).join('|');
        return crypto.createHash('md5').update(dataStr).digest('hex');
    }


    mapRow(headers, rowValues) {
        const obj = {};
        headers.forEach((h, i) => {
            obj[h] = rowValues[i] || '';
        });
        return obj;
    }

    checkCondition(conditionOrConditions, rowObj) {
        if (!conditionOrConditions) return true; // No condition = always run

        // Support Multiple Conditions (AND Logic)
        if (Array.isArray(conditionOrConditions)) {
            // Return true only if ALL conditions are met
            return conditionOrConditions.every(cond => this.checkSingleCondition(cond, rowObj));
        }

        return this.checkSingleCondition(conditionOrConditions, rowObj);
    }

    checkSingleCondition(condition, rowObj) {
        if (!condition || !condition.column) return true;

        const val = rowObj[condition.column];
        const op = condition.operator;
        const targetVal = condition.value;

        // --- Helper: IST Date (Start of Day) ---
        // Returns a Date object representing the given date in IST timezone (at 00:00:00)
        // Or strictly gets the Day/Month/Year components in IST.
        const getISTComponents = (d) => {
            if (!d || isNaN(d.getTime())) return null;
            const f = new Intl.DateTimeFormat('en-US', {
                timeZone: 'Asia/Kolkata',
                year: 'numeric', month: 'numeric', day: 'numeric'
            });
            const parts = f.formatToParts(d);
            // Format: "1/21/2026" usually. Parts map is safer.
            const p = {};
            parts.forEach(x => p[x.type] = x.value);
            return {
                year: parseInt(p.year),
                month: parseInt(p.month) - 1, // 0-based
                day: parseInt(p.day)
            };
        };

        const now = new Date();
        const istNow = getISTComponents(now); // Current IST date components

        // --- Basic String/General Checks ---
        if (op === 'is_empty') return !val || val.toString().trim() === '';
        if (op === 'is_not_empty') return val && val.toString().trim() !== '';

        if (!targetVal && !['is_today', 'is_yesterday', 'is_tomorrow', 'day_month_before', 'day_month_after', 'day_month_equal'].includes(op)) {
            return false;
        }

        const strVal = String(val || '').toLowerCase();
        const strTarget = String(targetVal || '').toLowerCase();

        if (op === 'equals') return strVal === strTarget;
        if (op === 'not_equals') return strVal !== strTarget;
        if (op === 'contains') return strVal.includes(strTarget);
        if (op === 'does_not_contain') return !strVal.includes(strTarget);
        if (op === 'starts_with') return strVal.startsWith(strTarget);
        if (op === 'ends_with') return strVal.endsWith(strTarget);

        // --- Numeric Checks ---
        const numVal = parseFloat(val);
        const numTarget = parseFloat(targetVal);
        if (!isNaN(numVal) && !isNaN(numTarget)) {
            if (op === 'greater_than') return numVal > numTarget;
            if (op === 'less_than') return numVal < numTarget;
            if (op === 'greater_than_or_equal') return numVal >= numTarget;
            if (op === 'less_than_or_equal') return numVal <= numTarget;
        }

        // --- Date Checks ---
        const dateVal = this.parseDate(val); // This assumes the string from Sheet implies "Local Day".
        // Since sheet dates (e.g. 21/01/2026) are usually "date only", we should treat them as "Target Date"
        // We compare this "Target Date" against "IST Today".

        if (['is_today', 'is_yesterday', 'is_tomorrow', 'in_last_x_days', 'in_next_x_days', 'date_equals', 'date_before', 'date_after', 'date_between', 'day_month_equal', 'day_month_after', 'day_month_before'].includes(op)) {
            if (!dateVal) {
                // Console log is noisy, maybe limit it
                // console.log(`Condition '${op}' invalid date: ${val}`);
                return false;
            }
        }

        // Helper to compare dates components
        const isSameDate = (d1, d2Parts) => { // d1 is Date, d2Parts is {year, month, day} from IST
            // We assume d1 (from sheet) is "YYYY-MM-DD 00:00:00 Local".
            // We just compare components directly.
            return d1.getFullYear() === d2Parts.year &&
                d1.getMonth() === d2Parts.month &&
                d1.getDate() === d2Parts.day;
        };

        // Shift IST Now for relative checks
        const getRelativeIST = (offsetDays) => {
            // Create a date object that *looks* like IST date
            const d = new Date(istNow.year, istNow.month, istNow.day);
            d.setDate(d.getDate() + offsetDays);
            return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
        };

        if (op === 'is_today') return isSameDate(dateVal, istNow);
        if (op === 'is_yesterday') return isSameDate(dateVal, getRelativeIST(-1));
        if (op === 'is_tomorrow') return isSameDate(dateVal, getRelativeIST(1));

        // Range Checks: Use timestamp comparison after setting both to Noon to avoid DST/TimeZone edge cases?
        // Simpler: Compare YYYYMMDD integers.
        const toInt = (d) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
        const istNowInt = istNow.year * 10000 + (istNow.month + 1) * 100 + istNow.day;
        const valInt = toInt(dateVal);

        if (op === 'in_last_x_days') {
            const days = parseInt(targetVal) || 0;
            const thresholdObs = getRelativeIST(-days);
            const thresholdInt = thresholdObs.year * 10000 + (thresholdObs.month + 1) * 100 + thresholdObs.day;
            return valInt >= thresholdInt && valInt <= istNowInt;
        }

        if (op === 'in_next_x_days') {
            const days = parseInt(targetVal) || 0;
            const thresholdObs = getRelativeIST(days);
            const thresholdInt = thresholdObs.year * 10000 + (thresholdObs.month + 1) * 100 + thresholdObs.day;
            return valInt >= istNowInt && valInt <= thresholdInt;
        }

        if (['date_equals', 'date_before', 'date_after', 'date_between'].includes(op)) {
            // For explicit date comparisons, we assume targetVal is also YYYY-MM-DD provided by user (or UI).
            // We parse it naively.
            const targetDate = this.parseDate(targetVal);
            if (!targetDate) return false;

            const targetInt = toInt(targetDate);

            if (op === 'date_equals') return valInt === targetInt;
            if (op === 'date_before') return valInt < targetInt; // Strict before? "Date Before" usually means <
            if (op === 'date_after') return valInt > targetInt;

            if (op === 'date_between') {
                const parts = String(targetVal).split(',');
                if (parts.length === 2) {
                    const d1 = this.parseDate(parts[0]);
                    const d2 = this.parseDate(parts[1]);
                    if (d1 && d2) {
                        const i1 = toInt(d1);
                        const i2 = toInt(d2);
                        return valInt >= i1 && valInt <= i2;
                    }
                }
                return false;
            }
        }

        if (['day_month_equal', 'day_month_after', 'day_month_before'].includes(op)) {
            // Birthday Logic: Compare MM * 100 + DD
            const valMMDD = (dateVal.getMonth() + 1) * 100 + dateVal.getDate();
            const istMMDD = (istNow.month + 1) * 100 + istNow.day;

            if (op === 'day_month_equal') return valMMDD === istMMDD;
            if (op === 'day_month_after') return valMMDD > istMMDD;
            if (op === 'day_month_before') return valMMDD < istMMDD;
        }

        return false;
    }



    // --- Helpers ---

    parseDate(val) {
        if (!val) return null;
        // 1. Try standard Date constructor
        let d = new Date(val);
        if (!isNaN(d.getTime())) return d;

        // 2. Try DD/MM/YYYY or DD-MM-YYYY (Common in Sheet data)
        const parts = String(val).match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
        if (parts) {
            // parts[1] is Day, parts[2] is Month, parts[3] is Year
            // Note: Month is 0-indexed in JS Date
            d = new Date(parts[3], parseInt(parts[2]) - 1, parts[1]);
            if (!isNaN(d.getTime())) return d;
        }

        // 3. Try DD-Mon-YYYY (e.g., 20-Jan-2026)
        const textParts = String(val).match(/^(\d{1,2})[\/\-]([A-Za-z]{3})[\/\-](\d{4})/);
        if (textParts) {
            const months = {
                'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
                'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
            };
            const monStr = textParts[2].toLowerCase();
            if (months[monStr] !== undefined) {
                d = new Date(textParts[3], months[monStr], textParts[1]);
                if (!isNaN(d.getTime())) return d;
            }
        }

        return null;
    }

    isSameDay(d1, d2) {
        if (!d1 || !d2) return false;
        return d1.getFullYear() === d2.getFullYear() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getDate() === d2.getDate();
    }

    async sendMessage(auto, rowObj) {
        // Extract Phone
        const phoneCol = auto.mapping_config.phone_col;
        const phone = rowObj[phoneCol];

        if (!phone) {
            console.log('[SheetAutomation] Skipping row, no phone number.');
            return;
        }

        // --- NEW LOGIC: Check if this is a Flow Trigger ---
        if (auto.flow_id) {
            console.log(`[SheetAuto] Triggering Flow ${auto.flow_id} for ${phone}`);

            // Lazy load flowEngine
            const flowEngine = require('./flowEngine');

            // Fetch flow
            const rpcClient = supabaseAdmin;
            const { data: flow } = await rpcClient.from('flows').select('*').eq('id', auto.flow_id).single();
            if (!flow) throw new Error(`Flow ${auto.flow_id} not found`);

            // Find Start Node (Sheet Trigger)
            const startNode = flow.nodes?.find(n => n.type === 'sheetTrigger');

            // Prepare Context
            const initialContext = {
                ...rowObj,
                trigger: { ...rowObj },
                source: 'google_sheet'
            };

            // Normalize phone
            let safePhone = phone.replace(/[^\d+]/g, '');

            // Start Flow with Explicit Node ID
            await flowEngine.startFlow(auto.user_id, safePhone, flow, initialContext, startNode ? startNode.id : null);
            return;
        }

        // --- OLD LOGIC: Template Message ---

        // Prepare Template Parameters
        const { template_name, language, components } = auto.template_config; // Stored struct
        const finalComponents = [];

        // We need to map the stored "params" to actual values from rowObj
        // The mapping_config might look like: { "body_1": "Name", "body_2": "OrderDate" }

        // This part depends on how we structure the mapping JSON in frontend.
        // Let's assume a simple replacement for now or strict mapping

        // Construct basic template object
        const templateObject = {
            name: template_name,
            language: { code: language || 'en' },
            components: components
            // We need to inject variables here. If components contains {{1}}, we need to replace?
            // Actually, the API expects "parameters": [{ type: "text", text: "Value" }]
            // So we need to build that from the mapping.
        };

        // ... Logic to hydrate templateObject using rowObj and mapping_config ...

        // 1. Map Params (Body Variables)
        if (templateObject.components) {
            templateObject.components = templateObject.components.map(comp => {
                if (comp.type === 'BODY' && comp.parameters) {
                    // This is where we inject the values.
                    // But wait, the stored 'components' usually don't have 'parameters' yet if it's the raw template struct.
                    // We need to BUILD the parameters array based on {{1}}, {{2}}.
                    // actually, the 'components' from db might be the raw structure.
                    // We need to construct the payload for API.
                }
                return comp;
            });

            // BETTER APPROACH: Construct the API payload anew based on configuration
            const apiComponents = [];

            // A. Header
            const headerConfig = auto.template_config.components.find(c => c.type && c.type.toUpperCase() === 'HEADER');
            if (headerConfig) {
                const headerParams = [];
                if (headerConfig.format === 'IMAGE') {
                    const mapVal = this.getMappedValue(auto.mapping_config.params['HEADER_IMAGE'], rowObj);
                    if (mapVal) headerParams.push({ type: 'image', image: { link: mapVal } });
                } else if (headerConfig.format === 'VIDEO') {
                    const mapVal = this.getMappedValue(auto.mapping_config.params['HEADER_VIDEO'], rowObj);
                    if (mapVal) headerParams.push({ type: 'video', video: { link: mapVal } });
                } else if (headerConfig.format === 'DOCUMENT') {
                    const mapVal = this.getMappedValue(auto.mapping_config.params['HEADER_DOCUMENT'], rowObj);
                    if (mapVal) headerParams.push({ type: 'document', document: { link: mapVal } });
                } else if (headerConfig.format === 'TEXT' && headerConfig.text.includes('{{1}}')) {
                    // Check for header variable
                    const mapVal = this.getMappedValue(auto.mapping_config.params['header_variable_1'], rowObj);
                    if (mapVal) headerParams.push({ type: 'text', text: mapVal });
                }

                if (headerParams.length > 0) {
                    apiComponents.push({ type: 'header', parameters: headerParams });
                }
            }

            // B. Body
            const bodyConfig = auto.template_config.components.find(c => c.type && c.type.toUpperCase() === 'BODY');
            if (bodyConfig) {
                console.log('[DEBUG] Body config found:', bodyConfig.text);
                const bodyParams = [];
                // Find all {{x}} variables in body text
                const matches = bodyConfig.text.match(/{{(\d+)}}/g);
                console.log('[DEBUG] Matches found:', matches);

                if (matches) {
                    const uniqueVars = Array.from(new Set(matches)).sort(); // {{1}}, {{2}}
                    // Whatsapp expects params in order 1, 2, 3...

                    let maxIndex = 0;
                    uniqueVars.forEach(v => {
                        const idx = parseInt(v.replace(/[^\d]/g, ''));
                        if (idx > maxIndex) maxIndex = idx;
                    });

                    console.log('[DEBUG] Max Index:', maxIndex);

                    for (let i = 1; i <= maxIndex; i++) {
                        const paramKey = `body_variable_${i}`;
                        let val = this.getMappedValue(auto.mapping_config.params[paramKey], rowObj);
                        console.log(`[DEBUG] Mapping ${paramKey} -> ${val}`);
                        if (!val) val = '-';
                        bodyParams.push({ type: 'text', text: val });
                    }
                }

                if (bodyParams.length > 0) {
                    apiComponents.push({ type: 'body', parameters: bodyParams });
                } else {
                    console.log('[DEBUG] Body params empty!');
                }
            } else {
                console.log('[DEBUG] No BODY config found in template');
            }

            // Overwrite components with built ones
            templateObject.components = apiComponents;
        }

        try {
            const logMeta = {
                automation_id: auto.id,
                automation_name: auto.name,
                phone: phone,
                template: templateObject.name,
                row_data: rowObj // Include Sheet Row Data
            };

            console.log(`[SheetAuto] Sending WhatsApp Template: ${templateObject.name} to ${phone}`);

            // Log Attempt to File
            logGoogleSheetEvent('SEND_ATTEMPT', {
                ...logMeta,
                payload: templateObject
            });

            const response = await whatsappService.sendMessage(
                auto.user_id,
                phone,
                'template',
                templateObject
            );

            console.log(`[SheetAuto] WhatsApp API responded Success for ${phone}`);

            // Log Success to File
            logGoogleSheetEvent('SEND_SUCCESS', {
                ...logMeta,
                response: response
            });

            // If Write-back enabled:
            // Update Sheet (Logic needed here to find row again and write "Sent")

        } catch (e) {
            console.error('[SheetAutomation] Send Failed:', e.message);
            const errorDetails = e.response && e.response.data ? e.response.data : e.message;
            if (e.response && e.response.data) {
                console.error('[SheetAutomation] API Error Data:', JSON.stringify(e.response.data));
            }

            // Log Failure to File
            logGoogleSheetEvent('SEND_FAILURE', {
                automation_id: auto.id,
                automation_name: auto.name,
                phone: phone,
                template: templateObject.name,
                row_data: rowObj, // Include Row Data on Error too
                error: errorDetails
            });

            throw e; // Rethrow so it counts as error
        }
    }
    getMappedValue(mapConfig, rowObj) {
        if (!mapConfig) return null;

        // Case 1: Complex Object (New Style: { type: 'static|column', value: '...' })
        if (typeof mapConfig === 'object' && mapConfig !== null) {
            if (mapConfig.type === 'static') {
                return mapConfig.value;
            } else if (mapConfig.type === 'column') {
                return rowObj[mapConfig.value] || '';
            }
        }

        // Case 2: Simple String (Legacy: just column name)
        if (typeof mapConfig === 'string') {
            return rowObj[mapConfig] || '';
        }

        return null;
    }
    formatLog(summary) {
        return `Run complete: ${summary.sent_successfully} sent, ${summary.errors} errors, ${summary.already_sent} skipped.`;
    }

    async writeStatus(authClient, spreadsheetId, sheetName, rowIndex, colIndex, status) {
        try {
            // Use AXIOS directly to avoid Gaxios Proxy issues
            const accessToken = authClient.credentials.access_token;
            if (!accessToken) throw new Error('No access token for write status');

            const colLetter = this.getColLetter(colIndex);
            const range = `${sheetName}!${colLetter}${rowIndex}`;
            const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=RAW`;

            await axios.put(url, {
                values: [[status]]
            }, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                proxy: false
            });

            console.log(`[SheetAuto] Updated status to '${status}' at ${range}`);
        } catch (err) {
            console.error('[SheetAuto] Failed to write status:', err.message);
        }
    }

    getColLetter(n) {
        let s = "";
        while (n >= 0) {
            s = String.fromCharCode(n % 26 + 65) + s;
            n = Math.floor(n / 26) - 1;
        }
        return s;
    }
}

module.exports = new SheetAutomationService();
