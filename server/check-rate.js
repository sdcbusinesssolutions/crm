const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://ssckorsnhjhzqxyukexm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzY2tvcnNuaGpoenF4eXVrZXhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODM5OTcwOSwiZXhwIjoyMDgzOTc1NzA5fQ.aNUZx09EwkA4tEmHRK-LL4l-J6ySioqTY3c9PcQCJHc';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data: rates, error } = await supabase.from('wa_message_rates').select('*').eq('user_id', '1586284c-4ab4-44e3-8b09-329d8445358c');
    console.log('User rates:', rates);

    const { data: globalRates } = await supabase.from('wa_message_rates').select('*').eq('scope', 'GLOBAL');
    console.log('Global rates:', globalRates);
}
run();
