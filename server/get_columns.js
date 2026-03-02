const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ssckorsnhjhzqxyukexm.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzY2tvcnNuaGpoenF4eXVrZXhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODM5OTcwOSwiZXhwIjoyMDgzOTc1NzA5fQ.aNUZx09EwkA4tEmHRK-LL4l-J6ySioqTY3c9PcQCJHc';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
});

async function run() {
    const tables = ['messages', 'whatsapp_config', 'flows', 'contacts'];

    for (const table of tables) {
        const { data, error } = await supabaseAdmin.from(table).select('*').limit(1);
        if (error) {
            console.error(`Error fetching from ${table}:`, error.message);
        } else if (data && data.length > 0) {
            console.log(`\nTable ${table} columns:`);
            console.log(Object.keys(data[0]).join(', '));
        } else {
            console.log(`\nTable ${table} is empty.`);
        }
    }
}

run();
