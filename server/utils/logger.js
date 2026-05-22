const fs = require('fs');
const path = require('path');

// Safe logger that falls back to console if file system is read-only (Netlify)
const LOG_DIR = path.join(process.cwd(), 'logs');
// Limits
const MAX_CAMPAIGN_LOG_SIZE = 500 * 1024; // 500KB
const MAX_INBOX_LOG_SIZE = 2 * 1024 * 1024; // 2MB

let canWriteToFile = false;

try {
    // Check if we are in a read-only environment or if directory exists
    // In Netlify/Lambda, writing to non-tmp directories often fails.
    if (process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME) {
        canWriteToFile = false;
    } else {
        if (!fs.existsSync(LOG_DIR)) {
            fs.mkdirSync(LOG_DIR, { recursive: true });
        }
        // Explicit Write Test
        const testFile = path.join(LOG_DIR, '.write_test');
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        canWriteToFile = true;
    }
} catch (error) {
    console.warn('Logger: File system is read-only or inaccessible. Falling back to console logging.', error.message);
    canWriteToFile = false;
}

/**
 * Returns formatted date string DD-MM-YYYY
 */
/**
 * Returns formatted date string DD-MM-YYYY in Asia/Kolkata timezone
 */
function getTodayDateString() {
    return new Date().toLocaleString('en-GB', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).split('/').join('-'); // en-GB gives DD/MM/YYYY, we convert to DD-MM-YYYY
}

/**
 * Determines the current active log file path for a given prefix.
 * Format: {prefix}_DD-MM-YYYY_partX.log
 */
function getCurrentLogFile(prefix, maxSize) {
    if (!canWriteToFile) return null;

    const dateStr = getTodayDateString();
    const dateFolder = path.join(LOG_DIR, dateStr);

    try {
        if (!fs.existsSync(dateFolder)) {
            fs.mkdirSync(dateFolder, { recursive: true });
        }
    } catch (e) {
        console.error(`Logger Error creating date folder ${dateFolder}:`, e);
        return null;
    }

    const baseName = prefix;

    let maxPart = 1;
    let currentFile = path.join(dateFolder, `${baseName}_part${maxPart}.log`);

    try {
        const files = fs.readdirSync(dateFolder);
        // regex to match: {prefix}_part(\d+).log
        const safePrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`^${safePrefix}_part(\\d+)\\.log$`);

        const parts = [];
        files.forEach(file => {
            const match = file.match(regex);
            if (match) {
                parts.push(parseInt(match[1], 10));
            }
        });

        if (parts.length > 0) {
            maxPart = Math.max(...parts);
            currentFile = path.join(dateFolder, `${baseName}_part${maxPart}.log`);

            // Check size
            if (fs.existsSync(currentFile)) {
                const stats = fs.statSync(currentFile);
                if (stats.size >= maxSize) {
                    maxPart++;
                    currentFile = path.join(dateFolder, `${baseName}_part${maxPart}.log`);
                }
            }
        }
    } catch (e) {
        console.error(`Logger Error finding log file for ${prefix}:`, e);
        // Fallback to part 1
    }

    return currentFile;
}

function getKolkataTimestamp() {
    try {
        return new Date().toLocaleString('sv-SE', {
            timeZone: 'Asia/Kolkata',
            hour12: false,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }).replace('T', ' '); // Ensure space separator if sv-SE adds T (usually doesn't)
    } catch (e) {
        return new Date().toISOString(); // Fallback
    }
}

// --- BUFFERED LOGGING SYSTEM ---
const LOG_FLUSH_INTERVAL = 5000; // Flush to disk every 5 seconds
const MAX_BUFFER_SIZE = 100; // Flush if buffer exceeds 100 entries

const logBuffer = {
    // key: unique file path, value: array of strings to write
};

function flushLogs() {
    if (!canWriteToFile) return;

    // Iterate over buffered files
    Object.keys(logBuffer).forEach(filePath => {
        const entries = logBuffer[filePath];
        if (entries && entries.length > 0) {
            // Join all buffered lines into one large string
            const chunk = entries.join('');

            // Clear buffer immediately for this file to handle new incoming logs
            logBuffer[filePath] = [];

            // Async write to avoid blocking event loop
            try {
                fs.appendFile(filePath, chunk, (err) => {
                    if (err) console.error(`[Logger] Async Write Failed for ${path.basename(filePath)}:`, err.message);
                });
            } catch (e) { console.error('Logger Flush Error:', e); }
        }
    });
}

// Start Flush Interval
if (canWriteToFile) {
    setInterval(flushLogs, LOG_FLUSH_INTERVAL).unref(); // unref so it doesn't keep process alive if idle
}

function _logToFile(prefix, type, data, maxSize) {
    const timestamp = getKolkataTimestamp();

    // Always console log in production for observability (optional)
    if (!canWriteToFile) return;

    // Inject timestamp into data if it's an object
    let logData = data;
    if (typeof data === 'object' && data !== null) {
        logData = { ...data, timestamp: timestamp };
    }

    try {
        // Determine file path (Sync check is okay here as it's cached mostly)
        // Optimization: We could cache the current file path per prefix to avoid fs.statSync every time
        const file = getCurrentLogFile(prefix, maxSize);

        if (file) {
            const logEntry = `[${timestamp}] [${type.toUpperCase()}]\n${JSON.stringify(logData, null, 2)}\n----------------------------------------\n`;

            // Add to Buffer
            // Add to Buffer
            if (!logBuffer[file]) logBuffer[file] = [];

            // Safety measure: Prevent memory leak if buffer grows indefinitely without flush (rare but possible)
            if (logBuffer[file].length < MAX_BUFFER_SIZE * 5) {
                logBuffer[file].push(logEntry);
            } else {
                console.warn(`[Logger] Buffer overflow for ${path.basename(file)}. Dropping log.`);
            }

            // Force flush if buffer gets too big
            if (logBuffer[file].length >= MAX_BUFFER_SIZE) {
                flushLogs();
            }


        }
    } catch (err) {
        console.error(`Failed to buffer log (${prefix}):`, err);
    }
}

/**
 * Overrides console.log and console.error to write to daily log files
 */
function overrideConsole() {
    if (!canWriteToFile) return;

    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    console.log = (...args) => {
        // Print to stdout first
        originalLog.apply(console, args);
        try {
            const timestamp = getKolkataTimestamp();
            const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
            const file = getCurrentLogFile('app_info', 5 * 1024 * 1024); // 5MB for app info
            if (file) fs.appendFileSync(file, `[${timestamp}] [INFO] ${message}\n`);
        } catch (e) { /* ignore log errors to avoid infinite loop */ }
    };

    console.error = (...args) => {
        // Print to stderr first
        originalError.apply(console, args);
        try {
            const timestamp = getKolkataTimestamp();
            const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
            const file = getCurrentLogFile('error_log', 5 * 1024 * 1024); // 5MB for errors
            if (file) fs.appendFileSync(file, `[${timestamp}] [ERROR] ${message}\n`);
        } catch (e) { /* ignore */ }
    };

    // Treat warn as info/error or just normal console? Let's map to app_info with WARN tag
    console.warn = (...args) => {
        originalWarn.apply(console, args);
        try {
            const timestamp = getKolkataTimestamp();
            const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
            const file = getCurrentLogFile('app_info', 5 * 1024 * 1024);
            if (file) fs.appendFileSync(file, `[${timestamp}] [WARN] ${message}\n`);
        } catch (e) { /* ignore */ }
    };

    console.log('✅ Console output is now being mirrored to server/logs/app_info_...log');
}

function logCampaignRequest(type, data) {
    _logToFile('campaign_requests', type, data, MAX_CAMPAIGN_LOG_SIZE);
}

function logInboxMessage(type, data) {
    _logToFile('inbox_messages', type, data, MAX_INBOX_LOG_SIZE);
}

const MAX_FLOW_LOG_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_TEMPLATE_LOG_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_CRM_LOG_SIZE = 5 * 1024 * 1024; // 5MB (Higher volume for combined CRM activities)
const MAX_FORM_LOG_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_WA_FORM_LOG_SIZE = 2 * 1024 * 1024; // 2MB

// ... (existing code)

function logFlowEvent(type, data) {
    _logToFile('flow_logs', type, data, MAX_FLOW_LOG_SIZE);
}

const MAX_ONBOARDING_LOG_SIZE = 2 * 1024 * 1024; // 2MB

// ... (existing code)

function logOnboardingEvent(type, data) {
    _logToFile('onboarding_logs', type, data, MAX_ONBOARDING_LOG_SIZE);
}

// --- New Loggers ---

function logTemplateEvent(type, data) {
    _logToFile('template_logs', type, data, MAX_TEMPLATE_LOG_SIZE);
}

function logCRMEvent(type, data) {
    // Covers: Leads, Pipelines, Stages, Tasks, Follow-ups
    _logToFile('crm_logs', type, data, MAX_CRM_LOG_SIZE);
}

function logFormBuilderEvent(type, data) {
    _logToFile('form_builder_logs', type, data, MAX_FORM_LOG_SIZE);
}

function logWhatsAppFormEvent(type, data) {
    _logToFile('whatsapp_form_logs', type, data, MAX_WA_FORM_LOG_SIZE);
}

const MAX_FACEBOOK_LEAD_LOG_SIZE = 2 * 1024 * 1024; // 2MB

function logFacebookLeadEvent(type, data) {
    _logToFile('facebook_lead_logs', type, data, MAX_FACEBOOK_LEAD_LOG_SIZE);
}

const MAX_AUTH_BRIDGE_LOG_SIZE = 2 * 1024 * 1024; // 2MB

function logAuthBridgeEvent(type, data) {
    _logToFile('auth_bridge', type, data, MAX_AUTH_BRIDGE_LOG_SIZE);
}

const MAX_GOOGLE_LOG_SIZE = 2 * 1024 * 1024; // 2MB

function logGoogleEvent(type, data) {
    _logToFile('google_integrations', type, data, MAX_GOOGLE_LOG_SIZE);
}

const MAX_GSHEET_AUTOMATION_LOG_SIZE = 2 * 1024 * 1024; // 2MB

function logGoogleSheetEvent(type, data) {
    _logToFile('google_sheet_automation', type, data, MAX_GSHEET_AUTOMATION_LOG_SIZE);
}

const RETENTION_DAYS = 14; 

async function cleanupOldLogs() {
    if (!canWriteToFile || !fs.existsSync(LOG_DIR)) return;
    
    try {
        const now = new Date();
        const files = fs.readdirSync(LOG_DIR);
        
        for (const folder of files) {
            const folderPath = path.join(LOG_DIR, folder);
            const stats = fs.statSync(folderPath);
            
            if (stats.isDirectory()) {
                const daysOld = (now - stats.mtime) / (1000 * 60 * 60 * 24);
                if (daysOld > RETENTION_DAYS) {
                    // Use async rm to prevent blocking the event loop
                    fs.rm(folderPath, { recursive: true, force: true }, (err) => {
                        if (err) console.error(`[Logger Cleanup] Failed to delete: ${folder}`, err);
                        else console.log(`[Logger Cleanup] Deleted old log folder (>${RETENTION_DAYS} days): ${folder}`);
                    });
                }
            }
        }
    } catch (e) {
        console.error('[Logger Cleanup] Error during cleanup:', e);
    }
}

// Run cleanup once on startup (delayed by 1 min to not impact boot time) and then every 24 hours
if (canWriteToFile) {
    setTimeout(cleanupOldLogs, 60 * 1000).unref();
    setInterval(cleanupOldLogs, 24 * 60 * 60 * 1000).unref();
}

module.exports = {
    logCampaignRequest,
    logInboxMessage,
    logFlowEvent,
    logOnboardingEvent,
    logTemplateEvent,
    logCRMEvent,
    logFormBuilderEvent,
    logWhatsAppFormEvent,
    logFacebookLeadEvent,
    logAuthBridgeEvent,
    logGoogleEvent,
    logGoogleSheetEvent,
    logContactImportEvent: (type, data) => _logToFile('contact_imports', type, data, 2 * 1024 * 1024),
    overrideConsole
};
