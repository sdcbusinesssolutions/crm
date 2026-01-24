
const { createClient } = require('@supabase/supabase-js');

// Config
const USER_ID = '35d4fe7d-753d-43da-85fb-a32b6f66133e';
const SUPABASE_URL = "https://ssckorsnhjhzqxyukexm.supabase.co";
// Service Role Key needed for deletion
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzY2tvcnNuaGpoenF4eXVrZXhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODM5OTcwOSwiZXhwIjoyMDgzOTc1NzA5fQ.aNUZx09EwkA4tEmHRK-LL4l-J6ySioqTY3c9PcQCJHc";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function cleanScientificData() {
    console.log("🧹 Starting Clean-up of 'Scientific Notation' Bad Data...");

    // 1. Fetch potential bad data
    // "E+" might be in phone numbers.
    const { data: contacts, error } = await supabase
        .from('contacts')
        .select('id, phone, name, created_at')
        .eq('user_id', USER_ID)
        .ilike('phone', '%e+%'); // Case insensitive search for 'e+'

    if (error) {
        console.error("Error searching:", error);
        return;
    }

    console.log(`⚠️ Found ${contacts.length} suspect records containing 'E+' in phone.`);

    if (contacts.length === 0) {
        console.log("✅ No bad data found. Database is clean.");
        return;
    }

    contacts.forEach(c => {
        console.log(`  - Deleting: ${c.name} (Phone: ${c.phone}) [ID: ${c.id}]`);
    });

    const ids = contacts.map(c => c.id);

    // 2. Delete them
    const { error: delErr, data: deleted } = await supabase
        .from('contacts')
        .delete()
        .in('id', ids)
        .select();

    if (delErr) {
        console.error("❌ Delete failed:", delErr);
    } else {
        console.log(`✅ Successfully deleted ${deleted.length} garbage records.`);
    }
}

cleanScientificData();
