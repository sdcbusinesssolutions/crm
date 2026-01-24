
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Parse arguments (though we have them hardcoded for this specific user request)
const USER_ID = '35d4fe7d-753d-43da-85fb-a32b6f66133e';
const DB_URL = "postgresql://postgres.ssckorsnhjhzqxyukexm:sonuDEV%402211@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres";
const SUPABASE_URL = "https://ssckorsnhjhzqxyukexm.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzY2tvcnNuaGpoenF4eXVrZXhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODM5OTcwOSwiZXhwIjoyMDgzOTc1NzA5fQ.aNUZx09EwkA4tEmHRK-LL4l-J6ySioqTY3c9PcQCJHc";

// Initialize Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkDuplicates() {
    const report = {};
    report.user = USER_ID;
    console.log("Starting check...");

    // 1. Fetch ALL contacts for this user (Limit raised to 5000)
    const { data: contacts, error, count } = await supabase
        .from('contacts')
        .select('id, name, phone, group_ids, created_at', { count: 'exact' })
        .eq('user_id', USER_ID)
        .range(0, 4999);

    if (error) {
        fs.writeFileSync('duplicates_report.json', JSON.stringify({ error }));
        return;
    }

    report.totalFetched = contacts.length;
    report.totalCountDB = count;

    // 2. Group by Phone
    const phoneMap = new Map();
    contacts.forEach(c => {
        const phone = c.phone ? String(c.phone).trim() : 'NO_PHONE';
        if (!phoneMap.has(phone)) {
            phoneMap.set(phone, []);
        }
        phoneMap.get(phone).push(c);
    });

    const duplicates = [];
    phoneMap.forEach((list, phone) => {
        if (list.length > 1) {
            duplicates.push({ phone, records: list });
        }
    });

    report.uniquePhones = phoneMap.size;
    report.duplicateCount = duplicates.length;
    report.duplicates = duplicates;

    // 4. Fetch Groups to match IDs
    const { data: groups } = await supabase.from('contact_groups').select('id, name').eq('user_id', USER_ID);
    report.groups = groups;

    fs.writeFileSync('duplicates_report.json', JSON.stringify(report, null, 2));
    console.log("Report written to duplicates_report.json");
}

checkDuplicates();
