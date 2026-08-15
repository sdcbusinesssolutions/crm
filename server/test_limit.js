const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient('https://ssckorsnhjhzqxyukexm.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzY2tvcnNuaGpoenF4eXVrZXhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODM5OTcwOSwiZXhwIjoyMDgzOTc1NzA5fQ.aNUZx09EwkA4tEmHRK-LL4l-J6ySioqTY3c9PcQCJHc');

async function test() {
    const phones = Array.from({length: 1200}, (_, i) => `9199750${i.toString().padStart(4, '0')}`);
    console.log("Array length:", phones.length);
    const { data, error } = await supabaseAdmin
        .from('conversations')
        .select('id')
        .in('contact_phone', phones)
        .limit(1);
    
    console.log("Error:", error?.message);
    console.log("Data count:", data?.length);
}
test();
