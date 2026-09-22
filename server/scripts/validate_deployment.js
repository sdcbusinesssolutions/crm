const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

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

async function fetchDeepSchema(url, key) {
    const supabase = createClient(url, key);
    // Call the custom SQL function
    const { data, error } = await supabase.rpc('get_schema_deep_info');

    if (error) {
        // If function doesn't exist, we fall back or fail
        return { error: error.message };
    }
    return { data };
}

async function validateSchemaIntegrity() {
    console.log('🚀 Starting ULTIMATE Deep Schema Comparison (Tables, Policies, Triggers)...');

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

    // 2. Fetch Schemas via RPC
    const dbSchemas = new Map();
    let referenceSchema = null;
    let referenceUrl = '';

    for (const [url, data] of uniqueDatabases) {
        console.log(`   Asking ${url} for Deep Info...`);
        const { data: schema, error } = await fetchDeepSchema(url, data.key);

        if (error || !schema) {
            if (error && error.includes('fetch failed')) {
                console.log(`   ⚠️ Skipping Deep Info fetch (Supabase unreachable).`);
            } else {
                console.error(`   ❌ Failed to fetch Deep Info from ${url}: ${error || 'Unknown'}`);
            }
            if (error && error.includes('function get_schema_deep_info() does not exist')) {
                console.error('      💡 ACTION REQUIRED: Run server/sql/get_schema_info.sql on this database!');
            }
            data.domains.forEach(d => logToDomain(d, `❌ SKIP: Database missing 'get_schema_deep_info' function.`));
            continue;
        }

        dbSchemas.set(url, schema);

        if (!referenceSchema) {
            referenceSchema = schema;
            referenceUrl = url;
            console.log(`\n🏆 Acquired Reference Schema from: ${referenceUrl}`);
            console.log(`      Tables: ${Object.keys(schema.tables || {}).length}`);
            console.log(`      Policies: ${(schema.policies || []).length}`);
            console.log(`      Triggers: ${(schema.triggers || []).length}\n`);
        }
    }

    if (!referenceSchema) {
        console.log("❌ No valid schemas found. Please run the SQL setup script!");
        process.exit(0);
    }

    // 3. Compare
    let globalFail = false;

    for (const [url, data] of uniqueDatabases) {
        const target = dbSchemas.get(url);
        if (!target) {
            data.domains.forEach(d => logToDomain(d, "❌ SKIP: Could not inspect DB (Missing RPC function?)"));
            continue;
        }

        const diffs = [];

        // A. Compare Tables & Columns
        const refTables = referenceSchema.tables || {};
        const targetTables = target.tables || {};

        for (const tName of Object.keys(refTables)) {
            if (!targetTables[tName]) {
                diffs.push(`❌ Missing Table: ${tName}`);
                continue;
            }
            // Columns
            const refCols = refTables[tName];
            const targetCols = targetTables[tName];
            for (const cName of Object.keys(refCols)) {
                if (!targetCols[cName]) {
                    diffs.push(`⚠️ Missing Column: ${tName}.${cName}`);
                }
            }
        }

        // B. Compare Policies (RLS)
        const refPolicies = referenceSchema.policies || [];
        const targetPolicies = target.policies || [];

        // We create a set of signatures "tablename:policyname"
        const targetPolicySet = new Set(targetPolicies.map(p => `${p.table}:${p.policy_name}`));

        for (const p of refPolicies) {
            const signature = `${p.table}:${p.policy_name}`;
            if (!targetPolicySet.has(signature)) {
                diffs.push(`🔴 Missing RLS Policy: ${p.policy_name} ON ${p.table}`);
            }
        }

        // C. Compare Triggers
        const refTriggers = referenceSchema.triggers || [];
        const targetTriggers = target.triggers || [];
        const targetTriggerSet = new Set(targetTriggers.map(t => `${t.table}:${t.trigger_name}`));

        for (const t of refTriggers) {
            const signature = `${t.table}:${t.trigger_name}`;
            if (!targetTriggerSet.has(signature)) {
                diffs.push(`⚡ Missing Trigger: ${t.trigger_name} ON ${t.table}`);
            }
        }

        // Report
        if (diffs.length === 0) {
            console.log(`   ✅ ${url}: Matches Reference.`);
            data.domains.forEach(d => {
                logToDomain(d, "✅ Database Schema Integrity Check: PASS");
                logToDomain(d, `   Verified Tables, Policies, and Triggers match reference.`);
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
