const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://ssckorsnhjhzqxyukexm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzY2tvcnNuaGpoenF4eXVrZXhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODM5OTcwOSwiZXhwIjoyMDgzOTc1NzA5fQ.aNUZx09EwkA4tEmHRK-LL4l-J6ySioqTY3c9PcQCJHc';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data: users, error } = await supabase.from('profiles').select('id, email').eq('email', 'rachanamanswi@gmail.com');
    if (error) console.error('Error:', error);
    
    console.log('Profiles found:', users);
    
    if (users && users.length > 0) {
        const { error: delErr } = await supabase.auth.admin.deleteUser(users[0].id);
        console.log('Delete test error:', delErr);
    }
}
run();
