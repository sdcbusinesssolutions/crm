const { createClient } = require('@supabase/supabase-js');

async function run() {
    const clickubeUrl = 'https://ssckorsnhjhzqxyukexm.supabase.co';
    const clickubeKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzY2tvcnNuaGpoenF4eXVrZXhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODM5OTcwOSwiZXhwIjoyMDgzOTc1NzA5fQ.aNUZx09EwkA4tEmHRK-LL4l-J6ySioqTY3c9PcQCJHc';
    const clickube = createClient(clickubeUrl, clickubeKey);
    
    const { data: msgs, error: msgError } = await clickube
        .from('conversations')
        .select('*')
        .eq('user_id', '6869c6b0-1bb3-44ac-8f85-9ae9e87718f2');
        
    console.log("Found conversations:", msgs?.length);
}
run();
