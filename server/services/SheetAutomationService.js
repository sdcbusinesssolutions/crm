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
        const oauth2Client = new google.auth.OAuth2(
            creds.params_client_id || process.env.GOOGLE_CLIENT_ID,
            creds.params_client_secret || process.env.GOOGLE_CLIENT_SECRET,
            creds.params_redirect_url || process.env.GOOGLE_REDIRECT_URL
        );

        oauth2Client.setCredentials(creds);
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

    checkCondition(condition, rowObj) {
        if (!condition || !condition.column) return true; // No condition = always run? (Dangerous), assume true for now or enforce condition.

        const val = rowObj[condition.column];
        const op = condition.operator; // equals, contains, is_today, is_empty

        if (op === 'is_empty') return !val || val.trim() === '';
        if (op === 'is_not_empty') return val && val.trim() !== '';
        if (op === 'equals') return val == condition.value;

        if (op === 'day_month_equal') {
            // Check if Date(val) has same Day/Month as Today (Ignore Year)
            // val format could be anything. Assume standard date parsable.
            if (!val) return false;
            const d = new Date(val);
            const now = new Date();
            return d.getDate() === now.getDate() && d.getMonth() === now.getMonth();
        }

        return false;
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
        // (Simplified for MVP: Just sending the raw template request with mapped params)

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
}

module.exports = new SheetAutomationService();
