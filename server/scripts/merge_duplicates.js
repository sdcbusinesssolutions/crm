
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Config
const USER_ID = '35d4fe7d-753d-43da-85fb-a32b6f66133e';
const SUPABASE_URL = "https://ssckorsnhjhzqxyukexm.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzY2tvcnNuaGpoenF4eXVrZXhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODM5OTcwOSwiZXhwIjoyMDgzOTc1NzA5fQ.aNUZx09EwkA4tEmHRK-LL4l-J6ySioqTY3c9PcQCJHc";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const LOG_FILE = 'merge_log.txt';
function log(msg) {
    const line = typeof msg === 'string' ? msg : JSON.stringify(msg);
    fs.appendFileSync(LOG_FILE, line + '\n');
    console.log(line);
}

async function mergeDuplicates() {
    fs.writeFileSync(LOG_FILE, ''); // Clear log
    log('🔄 Starting Duplicate Merge Process...');
    const report = { merged: 0, deleted: 0, errors: [] };

    // 1. Fetch ALL Contacts
    let allContacts = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
        const from = page * pageSize;
        constto = (page + 1) * pageSize - 1;

        const { data, error } = await supabase
            .from('contacts')
            .select('*')
            .eq('user_id', USER_ID)
            .range(from, constto);

        if (error) {
            log("Fetch Error: " + error.message);
            break;
        }

        if (data.length > 0) {
            allContacts = allContacts.concat(data);
            log(`Fetched ${data.length} records...`);
        }

        if (data.length < pageSize) hasMore = false;
        page++;
    }

    log(`📊 Total Contacts Loaded: ${allContacts.length}`);

    // 2. Identify Duplicates (With Normalization)
    const phoneMap = new Map();
    function normalize(p) {
        if (!p) return null;
        return String(p).replace(/\D/g, ''); // Digits only
    }

    allContacts.forEach(c => {
        const raw = c.phone;
        const norm = normalize(raw);
        const key = (norm && norm.length > 5) ? norm : (raw ? String(raw).trim() : `nophone-${c.id}`);

        if (!phoneMap.has(key)) phoneMap.set(key, []);
        phoneMap.get(key).push(c);
    });

    // 3. Process Duplicates
    const duplicates = [];
    phoneMap.forEach((list, phone) => {
        if (list.length > 1) {
            // Sort Oldest First
            list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            duplicates.push({ phone, list });
        }
    });

    log(`⚠️ Found ${duplicates.length} sets of duplicates to merge.`);

    for (const { phone, list } of duplicates) {
        const master = list[0];
        const slaves = list.slice(1);

        log(`Processing ${phone} (Master: ${master.id})`);

        let newGroups = new Set(master.group_ids || []);
        let newTags = new Set(master.tags || []);
        let newCustom = { ...(master.custom_data || {}) };

        for (const slave of slaves) {
            log(`  - Merging & Deleting Slave: ${slave.id}`);
            (slave.group_ids || []).forEach(g => newGroups.add(g));
            (slave.tags || []).forEach(t => newTags.add(t));
            Object.assign(newCustom, slave.custom_data || {});

            const { error: delErr } = await supabase.from('contacts').delete().eq('id', slave.id);
            if (delErr) {
                log(`  ❌ Delete Failed: ${delErr.message}`);
                report.errors.push(`Delete failed for ${slave.id}`);
            } else {
                report.deleted++;
            }
        }

        const updatePayload = {
            group_ids: Array.from(newGroups),
            tags: Array.from(newTags),
            custom_data: newCustom,
            updated_at: new Date().toISOString()
        };

        const { error: upErr } = await supabase.from('contacts').update(updatePayload).eq('id', master.id);

        if (upErr) {
            log(`  ❌ Update Master Failed: ${upErr.message}`);
            report.errors.push(`Update failed for ${master.id}`);
        } else {
            log(`  ✅ Master Updated (Groups: ${updatePayload.group_ids.length})`);
            report.merged++;
        }
    }

    log("\n--- SUMMARY ---");
    log(JSON.stringify(report, null, 2));
}

mergeDuplicates();
