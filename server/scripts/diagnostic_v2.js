const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

// Setup Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Paths
const LOG_FILE = path.join(__dirname, '../diagnostic_result.txt');
const CSV_1 = path.resolve(__dirname, '../../contacts_export.csv');       // 1000 contacts
const CSV_2 = path.resolve(__dirname, '../../contacts_export (11).csv');  // 25 contacts

function log(msg) {
    console.log(msg);
    fs.appendFileSync(LOG_FILE, msg + '\n');
}

// Helper to read phones from CSV
function getPhonesFromCsv(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split(/\r?\n/);
        const phones = new Set();
        let header = true;

        lines.forEach(line => {
            if (!line.trim()) return;
            if (header) { header = false; return; }

            // CSV parsing (simple split by comma)
            const parts = line.split(',');
            // Assuming Name, Phone is index 0, 1 based on previous checks
            if (parts.length > 1) {
                const p = parts[1].trim();
                if (p) phones.add(p);
            }
        });
        return phones;
    } catch (e) {
        log(`Error reading ${filePath}: ${e.message}`);
        return new Set();
    }
}

async function run() {
    fs.writeFileSync(LOG_FILE, `Diagnostic Run at ${new Date().toISOString()}\n`);
    log(`CWD: ${process.cwd()}`);

    // 1. Identify Target User (Owner of the 1000 contacts)
    // We fetch all contacts (limit 1500 to cover the user) and group by user_id
    const { data: contacts, error: fetchError } = await supabase
        .from('contacts')
        .select('user_id')
        .range(0, 9999); // Fetch all to be safe

    if (fetchError) {
        log(`CRITICAL ERROR fetching contacts: ${fetchError.message}`);
        return;
    }

    const counts = {};
    contacts.forEach(c => {
        if (c.user_id) counts[c.user_id] = (counts[c.user_id] || 0) + 1;
    });

    let targetUserId = null;
    let maxCount = 0;

    log('--- User Contact Counts ---');
    Object.entries(counts).forEach(([uid, count]) => {
        log(`User ${uid}: ${count}`);
        if (count > maxCount) {
            maxCount = count;
            targetUserId = uid;
        }
    });

    if (!targetUserId) {
        log('No users found with contacts.');
        return;
    }

    log(`\nTarget User Identified: ${targetUserId} (Count: ${maxCount})`);

    // 2. Load CSVs
    const set1 = getPhonesFromCsv(CSV_1); // 1000
    const set2 = getPhonesFromCsv(CSV_2); // 25
    log(`CSV 1 (1000 file) phones: ${set1.size}`);
    log(`CSV 2 (25 file) phones: ${set2.size}`);

    // 3. Check for Data Loss (Are the 25 contacts in DB?)
    // Fetch actual phones for this user
    const { data: userContacts } = await supabase
        .from('contacts')
        .select('phone')
        .eq('user_id', targetUserId)
        .range(0, 9999);

    const dbPhones = new Set(userContacts.map(c => c.phone));
    log(`DB Phrases found for user: ${dbPhones.size}`);

    let missingFrom2 = 0;
    set2.forEach(p => {
        if (!dbPhones.has(p)) missingFrom2++;
    });

    log(`\n--- MISSING CONTACTS CHECK ---`);
    log(`Missing from CSV 2 (The 25 batch): ${missingFrom2}`);

    let missingFrom1 = 0;
    set1.forEach(p => {
        if (!dbPhones.has(p)) missingFrom1++;
    });
    log(`Missing from CSV 1 (The 1000 batch): ${missingFrom1}`);

    if (missingFrom2 > 0) {
        log('\n[!] DATA LOSS CONFIRMED: The contacts from the 25-file are NOT in the database.');
    } else {
        log('\n[?] The contacts ARE in the database. Potential ownership or display issue?');
    }

    // 4. INSERTION TEST (Check for Limits)
    log('\n--- INSERTION LIMIT TEST ---');
    const dummyPhone = '9999999999';
    const { data: insertData, error: insertError } = await supabase
        .from('contacts')
        .insert({
            user_id: targetUserId,
            name: 'Diagnostic_Test_Limit_Check',
            phone: dummyPhone,
            status: 'New'
        })
        .select();

    if (insertError) {
        log(`[!] INSERT FAILED: ${insertError.message}`);
        log(`[!] This indicates a DATABASE LIMIT or TRIGGER is blocking new contacts.`);
    } else {
        log(`[SUCCESS] Inserted test contact. ID: ${insertData[0].id}`);
        log(`[INFO] There is NO database-level insertion limit blocking standard inserts.`);

        // Cleanup
        await supabase.from('contacts').delete().eq('id', insertData[0].id);
        log(`[INFO] Test contact deleted.`);
    }

    log('\n--- DIAGNOSTIC COMPLETE ---');
}

run();
