const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://ssckorsnhjhzqxyukexm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzY2tvcnNuaGpoenF4eXVrZXhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODM5OTcwOSwiZXhwIjoyMDgzOTc1NzA5fQ.aNUZx09EwkA4tEmHRK-LL4l-J6ySioqTY3c9PcQCJHc';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUser() {
    const email = 'vinaymathur5777@gmail.com';
    console.log(`Checking user: ${email}...`);
    const { data: users, error } = await supabase.auth.admin.listUsers();

    if (error) {
        console.error("Error fetching users:", error);
        return;
    }

    const user = users.users.find(u => u.email === email);
    if (!user) {
        console.log(`User ${email} NOT FOUND in Auth.`);
        return;
    }

    console.log(`\n--- AUTH DETAILS ---`);
    console.log(`ID: ${user.id}`);
    console.log(`Email: ${user.email}`);
    console.log(`Banned Status: ${user.banned_until ? 'BANNED until ' + user.banned_until : 'NOT BANNED'}`);
    console.log(`Last Sign In: ${user.last_sign_in_at}`);
    console.log(`Created At: ${user.created_at}`);

    console.log(`\n--- PROFILE DETAILS ---`);
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (profile) {
        console.log(`Status in profile DB: ${profile.status}`);
        console.log(`Signup Domain: ${profile.signup_domain}`);
        console.log(`Role: ${profile.role}`);
    } else {
        console.log(`Profile NOT FOUND`);
    }
}
checkUser();
