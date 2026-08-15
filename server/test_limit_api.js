const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient('https://ssckorsnhjhzqxyukexm.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzY2tvcnNuaGpoenF4eXVrZXhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODM5OTcwOSwiZXhwIjoyMDgzOTc1NzA5fQ.aNUZx09EwkA4tEmHRK-LL4l-J6ySioqTY3c9PcQCJHc');

async function test() {
    const { data, error } = await supabaseAdmin
        .from('leads')
        .select('phone')
        .contains('assigned_staff_ids', ['4bf2e1df-bd7d-4c74-a2f5-6caf285a7866'])
        .limit(5000);
    console.log("Leads array size with limit 5000:", data ? data.length : error);
}
test();
