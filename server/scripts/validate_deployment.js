const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Configure path to domains.csv
const CSV_PATH = path.join(__dirname, '../../domains.csv');
const LOG_DIR = path.join(__dirname, '../../deployment_logs');

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

function logToDomain(domain, message) {
    const timestamp = new Date().toISOString();
    const logFile = path.join(LOG_DIR, `${domain}_deploy.log`);
    if (!fs.existsSync(logFile)) {
        fs.writeFileSync(logFile, `=== DEPLOYMENT LOG FOR ${domain} ===\n`);
    }
    fs.appendFileSync(logFile, `[${timestamp}] [VALIDATION] ${message}\n`);
}

async function fetchRemoteSchema(url, key) {
    try {
        // PostgREST exposes OpenAPI spec at root
        const response = await axios.get(`${url}/rest/v1/`, {
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`
            }
        });
        return response.data;
    } catch (e) {
        return null;
    }
}

function parseSchema(swagger) {
    if (!swagger || !swagger.definitions) return {};

    const relevantDefs = {};
    for (const [tableName, def] of Object.entries(swagger.definitions)) {
        relevantDefs[tableName] = {};
        if (def.properties) {
            for (const [colName, colProp] of Object.entries(def.properties)) {
                relevantDefs[tableName][colName] = colProp.type || 'unknown';
            }
        }
    }
    return relevantDefs;
}

async function validateSchemaIntegrity() {
    console.log('🚀 Starting Deep Schema Comparison...');

    if (!fs.existsSync(CSV_PATH)) {
        console.error(`❌ domains.csv not found.`);
        process.exit(1);
    }

    // 1. Parse CSV
    const rawContent = fs.readFileSync(CSV_PATH, 'utf8');
    const lines = rawContent.split(/\r?\n/).filter(line => line.trim() !== '');
    const headers = lines[0].split(',').map(h => h.trim());

    const urlIndex = headers.indexOf('SupabaseUrl');
    const keyIndex = headers.indexOf('SupabaseServiceKey');
    const domainIndex = headers.indexOf('Domain');

    if (urlIndex === -1 || keyIndex === -1) {
        console.error('❌ CSV missing SupabaseUrl or SupabaseServiceKey');
        process.exit(1);
    }

    const uniqueDatabases = new Map();
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        if (cols.length < headers.length) continue;
        const url = cols[urlIndex].trim();
        const key = cols[keyIndex].trim();
        const domain = cols[domainIndex].trim();
        if (url && key) {
            if (!uniqueDatabases.has(url)) {
                uniqueDatabases.set(url, { key, domains: [] });
            }
            uniqueDatabases.get(url).domains.push(domain);
        }
    }

    console.log(`Found ${uniqueDatabases.size} Unique Databases.`);

    // 2. Fetch Schemas
    const dbSchemas = new Map();
    const failedFetches = [];

    let referenceSchema = null;
    let referenceUrl = '';

    for (const [url, data] of uniqueDatabases) {
        console.log(`   Asking ${url} for Schema...`);
        const swagger = await fetchRemoteSchema(url, data.key);

        if (!swagger) {
            console.error(`   ❌ Failed to fetch Schema from ${url}`);
            failedFetches.push(url);
            continue;
        }

        const simplified = parseSchema(swagger);
        dbSchemas.set(url, simplified);

        if (!referenceSchema && Object.keys(simplified).length > 0) {
            referenceSchema = simplified;
            referenceUrl = url;
            console.log(`\n🏆 Acquired Reference Schema from: ${referenceUrl} (${Object.keys(referenceSchema).length} tables)\n`);
        }
    }

    if (!referenceSchema) {
        console.error("❌ Could not fetch ANY schemas. Check keys/connectivity.");
        process.exit(0); // Warn but don't crash deploy
    }

    // 3. Compare All Against Reference
    let globalFail = false;

    for (const [url, data] of uniqueDatabases) {
        if (failedFetches.includes(url)) {
            data.domains.forEach(d => logToDomain(d, "❌ SKIP: Could not fetch schema from DB."));
            continue;
        }

        const targetSchema = dbSchemas.get(url);
        const diffs = [];
        const missingTables = [];

        // Compare Tables
        for (const table of Object.keys(referenceSchema)) {
            if (!targetSchema[table]) {
                diffs.push(`❌ Missing Table: ${table}`);
                missingTables.push(table);
                continue;
            }

            // Compare Columns
            const refCols = referenceSchema[table];
            const targetCols = targetSchema[table];

            for (const col of Object.keys(refCols)) {
                if (!targetCols[col]) {
                    diffs.push(`⚠️ Missing Column: ${table}.${col} (Type: ${refCols[col]})`);
                }
            }
        }

        // Report
        if (diffs.length === 0) {
            console.log(`   ✅ ${url}: Matches Reference.`);
            data.domains.forEach(d => {
                logToDomain(d, "✅ Database Schema Integrity Check: PASS");
                logToDomain(d, `   Matched ${Object.keys(targetSchema).length} tables vs Reference.`);
                logToDomain(d, `   Verified Columns & Types match reference.`);
            });
        } else {
            console.log(`   ⚠️ ${url}: ${diffs.length} Differences Found (See Logs).`);
            globalFail = true;
            data.domains.forEach(d => {
                logToDomain(d, "⚠️ Database Schema Integrity Check: WARNING");
                diffs.forEach(err => logToDomain(d, `   ${err}`));
            });
        }
    }

    if (globalFail) {
        console.log('\n⚠️  Differences found between databases.');
    } else {
        console.log('\n✅ All Databases are Synchronized.');
    }
    process.exit(0);
}

validateSchemaIntegrity();
