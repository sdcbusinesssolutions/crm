const { createClient } = require('@supabase/supabase-js');

async function run() {
    const clickubeUrl = 'https://ssckorsnhjhzqxyukexm.supabase.co';
    const clickubeKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzY2tvcnNuaGpoenF4eXVrZXhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODM5OTcwOSwiZXhwIjoyMDgzOTc1NzA5fQ.aNUZx09EwkA4tEmHRK-LL4l-J6ySioqTY3c9PcQCJHc';
    const clickube = createClient(clickubeUrl, clickubeKey);
    
    const { data: msgs, error: msgError } = await clickube
        .from('messages')
        .select('created_at, conversation_id, text, type, direction')
        .ilike('text', 'ok');
        
    console.log("Found ok:", msgs?.length);
}
run();
