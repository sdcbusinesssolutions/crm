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
        const now = new Date();
        const lastRun = auto.last_run_at ? new Date(auto.last_run_at) : null;

        if (auto.automation_type === 'new_row') {
            // Poll every 5 minutes
            if (!lastRun) return true;
            const diffMinutes = (now - lastRun) / 1000 / 60;
            return diffMinutes >= 5;
        }

        if (auto.automation_type === 'schedule') {
            if (!auto.schedule_config) return false;

            const { time, days, frequency, day_of_month } = auto.schedule_config;
            // frequency: daily, weekly, monthly

            // 1. CHECK DATE (Day/Month/Week)
            const currentDayStr = now.toLocaleDateString('en-US', { weekday: 'short' }); // "Mon"
            const currentDateNum = now.getDate();

            let isCorrectDate = false;

            if (frequency === 'weekly') {
                // Must matches one of the days
                if (days && days.includes(currentDayStr)) isCorrectDate = true;
            } else if (frequency === 'monthly') {
                // Must match day of month
                if (day_of_month && parseInt(day_of_month) === currentDateNum) isCorrectDate = true;
            } else {
                // 'daily' or 'custom' (assuming custom is handled else, but daily runs every day)
                isCorrectDate = true;
            }

            if (!isCorrectDate) return false;

            // 2. CHECK TIME match (Hourly granularity)
            if (!time) return false;
            const [targetHour, targetMinute] = time.split(':').map(Number);
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();

            // Check if we passed the scheduled time
            const isTime = currentHour > targetHour || (currentHour === targetHour && currentMinute >= targetMinute);
            if (!isTime) return false;

            // 3. CHECK LAST RUN (Prevent double run today)
            // If it ran TODAY, don't run again.
            if (lastRun) {
                const sameYear = lastRun.getFullYear() === now.getFullYear();
                const sameMonth = lastRun.getMonth() === now.getMonth();
                const sameDate = lastRun.getDate() === now.getDate();
                if (sameYear && sameMonth && sameDate) {
                    return false; // Already ran today
                }
            }

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

            let isRecurringTrigger = false;
            // Check if any condition implies recurrence
            const conditions = Array.isArray(auto.trigger_condition) ? auto.trigger_condition : [auto.trigger_condition];

            for (const cond of conditions) {
                if (cond && ['is_today', 'is_yesterday', 'is_tomorrow', 'day_month_equal', 'day_month_after', 'day_month_before', 'in_last_x_days', 'in_next_x_days'].includes(cond.operator)) {
                    isRecurringTrigger = true;
                    break;
                }
            }

            let timeWindow = new Date(0); // Default: Lifetime Deduplication (Check All History)

            if (isRecurringTrigger) {
                timeWindow = new Date();
                timeWindow.setHours(0, 0, 0, 0); // Window: Start of Today
                console.log(`[SheetAuto] Recurring Trigger detected. Checking history since today's start.`);
            } else {
                console.log(`[SheetAuto] Static Trigger detected. Checking LIFETIME history.`);
            }

            // Override for Custom Frequency (Explicit One-Time)
            if (auto.schedule_config?.frequency === 'custom') {
                timeWindow = new Date(0);
            }

            const sentHashes = await this.getSentHashes(auto.id, timeWindow);

            // 5. Processing Loop
            const isScheduleLogic = auto.automation_type === 'schedule' || isManual;

            if (!isScheduleLogic && auto.automation_type === 'new_row') {
                const lastIndex = auto.last_processed_row_index || 0;
                const newRows = dataRows.slice(lastIndex);

                for (let i = 0; i < newRows.length; i++) {
                    const row = newRows[i];
                    const rowObj = this.mapRow(headers, row);

                    try {
                        await this.sendMessageWithHistory(auto, rowObj, null);
                        logSummary.sent_successfully++;
                    } catch (e) {
                        // If reservation failed (duplicate), it throws 'Duplicate' error usually or we handle it?
                        // sendMessageWithHistory handles the flow. If it throws, it means send failed or reserve failed.
                        if (e.message !== 'Skipped: Duplicate Pending/Sent') {
                            logSummary.errors++;
                            console.error('Send Error:', e);
                        } else {
                            logSummary.already_sent++;
                        }
                    }
                }

                await supabaseAdmin.from('sheet_automations').update({
                    last_processed_row_index: lastIndex + newRows.length,
                    error_log: this.formatLog(logSummary)
                }).eq('id', auto.id);

            } else {
                // Schedule or Manual Mode
                for (const row of dataRows) {
                    const rowObj = this.mapRow(headers, row);

                    // DEBUG: Log first row to verifying mapping
                    // console.log('[SheetAuto] Processing Row:', JSON.stringify(rowObj));

                    // A. Check Trigger Condition
                    const conditionMet = this.checkCondition(auto.trigger_condition, rowObj);
                    if (conditionMet) {
                        logSummary.conditions_met++;
                        console.log(`[SheetAuto] Condition MET for row: Phone=${rowObj[auto.mapping_config?.phone_col]}`);

                        // B. Check Write-back Status
                        const statusCol = auto.mapping_config?.status_column;
                        if (statusCol && rowObj[statusCol]?.toLowerCase() === 'sent') {
                            logSummary.already_sent++;
                            console.log('[SheetAuto] Skipped: Already marked as SENT in sheet.');
                            continue;
                        }

                        // C. Check History Hash (Robust Deduplication)
                        // C. Check History Hash (Robust Deduplication)
                        let rowHash = this.computeRowHash(rowObj);

                        // MANUAL TRIGGER: Force uniqueness to allow re-send and bypass DB constraints
                        if (isManual) {
                            rowHash = `${rowHash}_MANUAL_${Date.now()}`;
                            console.log('[SheetAuto] Manual Trigger: Generated unique hash to force send.');
                        } else {
                            // SCHEDULE TRIGGER: Strict Deduplication
                            if (sentHashes.has(rowHash)) {
                                logSummary.already_sent++;
                                console.log('[SheetAuto] Skipped: Duplicate hash in history.');
                                continue;
                            }
                        }

                        // Send with Reservation Pattern
                        try {
                            console.log('[SheetAuto] Attempting to Send Message...');
                            await this.sendMessageWithHistory(auto, rowObj, rowHash);
                            logSummary.sent_successfully++;
                            console.log('[SheetAuto] Message Sent Successfully!');
                            sentHashes.add(rowHash);
                        } catch (e) {
                            if (e.message === 'Skipped: Duplicate Pending/Sent') {
                                logSummary.already_sent++;
                                console.log('[SheetAuto] Skipped due to concurrency (Duplicate Pending).');
                            } else {
                                logSummary.errors++;
                                console.error('[SheetAuto] Send Error:', e.message);
                            }
                        }
                    } else {
                        console.log(`[SheetAuto] Condition FAILED for row. Phone=${rowObj[auto.mapping_config?.phone_col] || 'N/A'}`);
                        console.log(`   - Condition: ${JSON.stringify(auto.trigger_condition)}`);
                        console.log(`   - Row Value: ${rowObj[auto.trigger_condition?.column]}`);
                        console.log(`   - Parsed Date: ${this.parseDate(rowObj[auto.trigger_condition?.column])}`);
                    }
                }

                // Final Update with Stats
                console.log('[SheetAuto] Job Completed. Summary:', logSummary);
                await supabaseAdmin.from('sheet_automations').update({
                    error_log: this.formatLog(logSummary),
                    last_run_at: new Date()
                }).eq('id', auto.id);
            }

            // Log to File System
            logGoogleSheetEvent('EXECUTION_SUMMARY', {
                automation_id: auto.id,
                automation_name: auto.name,
                recurring_mode: isRecurringTrigger,
                ...logSummary
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
        const finalHash = rowHash || this.computeRowHash(rowObj);
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

    computeRowHash(rowObj) {
        // Robust Hash: Sort keys to ensure consistency regardless of insertion order
        const keys = Object.keys(rowObj).sort();
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

        // --- Basic String/General Checks ---
        if (op === 'is_empty') return !val || val.toString().trim() === '';
        if (op === 'is_not_empty') return val && val.toString().trim() !== '';

        if (!targetVal && !['is_today', 'is_yesterday', 'is_tomorrow', 'day_month_before', 'day_month_after', 'day_month_equal'].includes(op)) {
            // Unary date ops don't need targetVal, but binary ops do.
            // If targetVal is required but missing, fail safely.
            // console.warn(`[SheetAuto] Condition '${op}' skipped: No value provided.`);
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
        const dateVal = this.parseDate(val);
        const now = new Date();

        if (['is_today', 'is_yesterday', 'is_tomorrow', 'in_last_x_days', 'in_next_x_days', 'date_equals', 'date_before', 'date_after', 'date_between', 'day_month_equal', 'day_month_after', 'day_month_before'].includes(op)) {
            if (!dateVal) {
                console.log(`[SheetAuto] Condition '${op}' failed: Invalid date value '${val}' in column '${condition.column}'`);
                return false;
            }
        }

        if (op === 'is_today') {
            const isMatch = this.isSameDay(dateVal, now);
            console.log(`[SheetAuto] is_today Check: RowDate=${dateVal} Today=${now} Match=${isMatch}`);
            return isMatch;
        }
        if (op === 'is_yesterday') {
            const yest = new Date();
            yest.setDate(now.getDate() - 1);
            return this.isSameDay(dateVal, yest);
        }
        if (op === 'is_tomorrow') {
            const tom = new Date();
            tom.setDate(now.getDate() + 1);
            return this.isSameDay(dateVal, tom);
        }
        if (op === 'in_last_x_days') {
            const days = parseInt(targetVal) || 0;
            const threshold = new Date();
            threshold.setDate(now.getDate() - days);
            return dateVal >= threshold && dateVal <= now;
        }
        if (op === 'in_next_x_days') {
            const days = parseInt(targetVal) || 0;
            const threshold = new Date();
            threshold.setDate(now.getDate() + days);
            return dateVal >= now && dateVal <= threshold;
        }

        if (['date_equals', 'date_before', 'date_after', 'date_between'].includes(op)) {
            const dateTarget = this.parseDate(targetVal);

            if (op === 'date_equals') return this.isSameDay(dateVal, dateTarget);
            if (op === 'date_before') return dateVal < (dateTarget || now);
            if (op === 'date_after') return dateVal > (dateTarget || now);

            if (op === 'date_between') {
                const parts = String(targetVal).split(',');
                if (parts.length === 2) {
                    const start = this.parseDate(parts[0]);
                    const end = this.parseDate(parts[1]);
                    if (start && end) {
                        return dateVal >= start && dateVal <= end;
                    }
                }
                return false;
            }
        }

        if (['day_month_equal', 'day_month_after', 'day_month_before'].includes(op)) {
            const dMonth = dateVal.getMonth();
            const dDate = dateVal.getDate();
            const nowMonth = now.getMonth();
            const nowDate = now.getDate();

            if (op === 'day_month_equal') return dMonth === nowMonth && dDate === nowDate;
            if (op === 'day_month_after') {
                if (dMonth > nowMonth) return true;
                if (dMonth === nowMonth && dDate > nowDate) return true;
                return false;
            }
            if (op === 'day_month_before') {
                if (dMonth < nowMonth) return true;
                if (dMonth === nowMonth && dDate < nowDate) return true;
                return false;
            }
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
            const headerConfig = auto.template_config.components.find(c => c.type === 'HEADER');
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
            const bodyConfig = auto.template_config.components.find(c => c.type === 'BODY');
            if (bodyConfig) {
                const bodyParams = [];
                // Find all {{x}} variables in body text
                const matches = bodyConfig.text.match(/{{(\d+)}}/g);
                if (matches) {
                    const uniqueVars = Array.from(new Set(matches)).sort(); // {{1}}, {{2}}
                    // Whatsapp expects params in order 1, 2, 3...
                    // We assume the template uses specific indices.
                    // IMPORTANT: The API expects parameters to essentially match the order of appearance or index.
                    // Usually it's strictly positional for {{1}}, {{2}}.

                    // Let's iterate 1 to N based on max index found
                    let maxIndex = 0;
                    uniqueVars.forEach(v => {
                        const idx = parseInt(v.replace(/[^\d]/g, ''));
                        if (idx > maxIndex) maxIndex = idx;
                    });

                    for (let i = 1; i <= maxIndex; i++) {
                        const paramKey = `body_variable_${i}`;
                        let val = this.getMappedValue(auto.mapping_config.params[paramKey], rowObj);
                        if (!val) val = '-'; // Fallback to hyphen if missing to prevent failure
                        bodyParams.push({ type: 'text', text: val });
                    }
                }

                if (bodyParams.length > 0) {
                    apiComponents.push({ type: 'body', parameters: bodyParams });
                }
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
}

module.exports = new SheetAutomationService();
