const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient('https://ssckorsnhjhzqxyukexm.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzY2tvcnNuaGpoenF4eXVrZXhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODM5OTcwOSwiZXhwIjoyMDgzOTc1NzA5fQ.aNUZx09EwkA4tEmHRK-LL4l-J6ySioqTY3c9PcQCJHc');

async function test() {
    const userId = '1586284c-4ab4-44e3-8b09-329d8445358c';
    const staffId = '4bf2e1df-bd7d-4c74-a2f5-6caf285a7866';
    const contactPhone = '919975020094';
    
    const { data: assignedLead, error } = await supabaseAdmin
        .from('leads')
        .select('id')
        .eq('user_id', userId)
        .eq('phone', contactPhone)
        .contains('assigned_staff_ids', [staffId])
        .limit(1)
        .maybeSingle();
        
    console.log("Assigned Lead:", assignedLead, "Error:", error);
}
test();
