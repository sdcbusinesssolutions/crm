const { supabaseAdmin } = require('../lib/supabaseClient');
const { google } = require('googleapis');
const whatsappService = require('./whatsappService');
const crypto = require('crypto');

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
        // Use existing logic to fetch integration
        const { data: integration, error } = await supabaseAdmin
            .from('user_integrations')
            .select('*')
            .eq('id', connectionId)
            .eq('user_id', userId)
            .single();

        if (error || !integration) throw new Error('Google connection not found');

        const creds = integration.credentials;

        // --- OPTION A: Service Account (Permanent, No Expiry) ---
        // If the credentials JSON has 'private_key', treat it as a Service Account.
        if (creds.private_key && creds.client_email) {
            console.log('[SheetAutomation] Using Service Account for Auth');

            // AGGRESSIVE PROXY CLEANUP
            ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'ALL_PROXY', 'all_proxy', 'NO_PROXY', 'no_proxy'].forEach(v => {
                if (process.env[v] !== undefined) delete process.env[v];
            });
            process.env.NO_PROXY = '*';

            // Clean Key
            let privateKey = creds.private_key;
            if (typeof privateKey === 'string') {
                if (privateKey.includes('\\n')) privateKey = privateKey.replace(/\\n/g, '\n');
                privateKey = privateKey.replace(/^"|"$/g, '');
            }

            try {
                // MANUAL JWT EXCHANGE (Bypassing Gaxios "Invalid Host")
                const jwt = require('jsonwebtoken');
                const axios = require('axios');

                const now = Math.floor(Date.now() / 1000);
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

                const response = await axios.post(exchangeUrl, exchangeParams, { proxy: false });
                const accessToken = response.data.access_token;

                if (!accessToken) throw new Error('No access_token from Manual JWT');

                console.log('[SheetAutomation] Manual JWT Exchange SUCCESS.');

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
            // Poll every 5 minutes for new rows?
            // Or simplified: run if it hasn't run in X minutes
            if (!lastRun) return true;
            const diffMinutes = (now - lastRun) / 1000 / 60;
            return diffMinutes >= 5; // Check every 5 mins
        }

        if (auto.automation_type === 'schedule') {
            if (!auto.schedule_config) return false;
            const { time, days } = auto.schedule_config; // time: "09:00", days: ["Mon", "Fri"]

            // Check Day
            const currentDay = now.toLocaleDateString('en-US', { weekday: 'short' }); // "Mon"
            if (days && days.length > 0 && !days.includes(currentDay)) return false;

            // Check Time (Hourly granularity or check if we passed the time today)
            const [targetHour, targetMinute] = time.split(':').map(Number);

            // Simple logic: Run if we are in the target minute window AND haven't run today
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();

            // If it already ran today, skip
            if (lastRun && lastRun.getDate() === now.getDate() && lastRun.getMonth() === now.getMonth()) {
                return false;
            }

            // Check if it's time (or slightly past time but robustly handled)
            if (currentHour > targetHour || (currentHour === targetHour && currentMinute >= targetMinute)) {
                return true;
            }
        }

        return false;
    }

    async executeJob(auto) {
        // 1. Setup Google Sheets API
        const auth = await this.getAuthClient(auto.user_id, auto.connection_id); // Assuming we store connection_id
        const sheets = google.sheets({ version: 'v4', auth });

        // 2. Fetch Data
        const range = `${auto.sheet_name}`; // Fetch whole sheet
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: auto.spreadsheet_id,
            range,
        });

        const rows = response.data.values;
        if (!rows || rows.length < 2) return; // No header or data

        const headers = rows[0];
        const dataRows = rows.slice(1);

        console.log(`[SheetAutomation] Found ${dataRows.length} rows.`);

        let processedCount = 0;

        // 3. Automation Logic
        if (auto.automation_type === 'new_row') {
            // Logic: Process rows AFTER the last known index.
            // We need to store 'last_processed_row_index' in 'auto' metadata
            const lastIndex = auto.last_processed_row_index || 0;

            // New rows are those with index >= lastIndex
            // Note: 'rows' array is 0-indexed relative to dataRows (which excludes header)
            // Actual sheet row for dataRows[i] is i + 2.

            const newRows = dataRows.slice(lastIndex);

            for (let i = 0; i < newRows.length; i++) {
                const row = newRows[i];
                const rowObj = this.mapRow(headers, row);
                await this.sendMessage(auto, rowObj);
                processedCount++;
            }

            // Update last index
            await supabaseAdmin.from('sheet_automations').update({
                last_processed_row_index: lastIndex + newRows.length,
                last_run_at: new Date()
            }).eq('id', auto.id);

        } else if (auto.automation_type === 'schedule') {
            // Logic: Iterate ALL, check trigger condition & log check

            for (const row of dataRows) {
                const rowObj = this.mapRow(headers, row);

                // A. Check Trigger Condition
                if (this.checkCondition(auto.trigger_condition, rowObj)) {

                    // B. Check Write-back Status (if configured)
                    // If user mapped a "Status" column, check if it says "Sent"
                    // reusing the mapping_config.status_column
                    const statusCol = auto.mapping_config?.status_column;
                    if (statusCol && rowObj[statusCol]?.toLowerCase() === 'sent') {
                        continue; // Already sent
                    }

                    // C. Fallback: Check Hash Log (if no write-back)
                    // const rowHash = this.computeRowHash(rowObj);
                    // Check DB if this hash was sent TODAY (for bday) or EVER?
                    // For scheduling, usually we rely on "Is Today" + Log to prevent double send.

                    // Send
                    await this.sendMessage(auto, rowObj);

                    // Update Status back to Sheet
                    if (statusCol) {
                        // We need row index.
                        // dataRows index is `rows.indexOf(row) - 1`.
                        // Real sheet index is +2. (Header is 1).
                        // wait... `row` is a reference, indexOf allows invalidity.
                        // Better use index in loop
                    }
                }
            }

            // Update last run
            await supabaseAdmin.from('sheet_automations').update({
                last_run_at: new Date()
            }).eq('id', auto.id);
        }
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
        const op = condition.operator; // equals, contains, is_today, is_empty, etc.
        const targetVal = condition.value;

        // --- Basic String/General Checks ---
        if (op === 'is_empty') return !val || val.toString().trim() === '';
        if (op === 'is_not_empty') return val && val.toString().trim() !== '';

        // For other checks, if value is empty, usually returns false (except 'is_empty')
        // unless we want strict typed checks.
        if (val === undefined || val === null) return false;

        const strVal = String(val).toLowerCase();
        const strTarget = String(targetVal || '').toLowerCase();

        if (op === 'equals') return strVal === strTarget;
        if (op === 'not_equals') return strVal !== strTarget;
        if (op === 'contains') return strVal.includes(strTarget);
        if (op === 'does_not_contain') return !strVal.includes(strTarget);
        if (op === 'starts_with') return strVal.startsWith(strTarget);
        if (op === 'ends_with') return strVal.endsWith(strTarget);

        // --- Numeric Checks ---
        // Attempt to parse numbers
        const numVal = parseFloat(val);
        const numTarget = parseFloat(targetVal);
        if (!isNaN(numVal) && !isNaN(numTarget)) {
            if (op === 'greater_than') return numVal > numTarget;
            if (op === 'less_than') return numVal < numTarget;
            if (op === 'greater_than_or_equal') return numVal >= numTarget;
            if (op === 'less_than_or_equal') return numVal <= numTarget;
        }

        // --- Date Checks ---
        // We use a helper to parse potential dates
        const dateVal = this.parseDate(val);
        const now = new Date();

        // Setup comparison dates based on operator
        if (op === 'is_today') {
            return this.isSameDay(dateVal, now);
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
            if (!dateVal) return false;
            const days = parseInt(targetVal) || 0;
            const threshold = new Date();
            threshold.setDate(now.getDate() - days);
            // Check if dateVal is between threshold and now
            return dateVal >= threshold && dateVal <= now;
        }
        if (op === 'in_next_x_days') {
            if (!dateVal) return false;
            const days = parseInt(targetVal) || 0;
            const threshold = new Date();
            threshold.setDate(now.getDate() + days);
            return dateVal >= now && dateVal <= threshold;
        }

        // --- Standard Date Comparison ---
        if (['date_equals', 'date_before', 'date_after', 'date_between'].includes(op)) {
            if (!dateVal) return false;

            // For these, we expect targetVal to be a date string
            const dateTarget = this.parseDate(targetVal);

            if (op === 'date_equals') return this.isSameDay(dateVal, dateTarget);

            // For before/after, we usually compare timestamps or day-granularity?
            // Let's use strict timestamp for generalized utility, but often users mean "Day Before"
            // Let's strip time for robust "Day" comparison if the input was likely just a date.
            // But strict is safer.
            if (op === 'date_before') return dateVal < (dateTarget || now); // if no target, assume now? No, fail.
            if (op === 'date_after') return dateVal > (dateTarget || now);

            if (op === 'date_between') {
                // targetVal expected format: "start_date,end_date"
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

        // --- Anniversary Checks (Day/Month only) ---
        if (['day_month_equal', 'day_month_after', 'day_month_before'].includes(op)) {
            if (!dateVal) return false;

            // Compare against TODAY
            const dMonth = dateVal.getMonth();
            const dDate = dateVal.getDate();
            const nowMonth = now.getMonth();
            const nowDate = now.getDate();

            if (op === 'day_month_equal') {
                return dMonth === nowMonth && dDate === nowDate;
            }
            if (op === 'day_month_after') {
                // Check if the anniversary is AFTER today in the current year
                if (dMonth > nowMonth) return true;
                if (dMonth === nowMonth && dDate > nowDate) return true;
                return false;
            }
            if (op === 'day_month_before') {
                // Check if the anniversary is BEFORE today in the current year
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
            await whatsappService.sendMessage(
                auto.user_id,
                phone,
                'template',
                templateObject
            );

            // If Write-back enabled:
            // Update Sheet (Logic needed here to find row again and write "Sent")

        } catch (e) {
            console.error('[SheetAutomation] Send Failed:', e.message);
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
}

module.exports = new SheetAutomationService();
