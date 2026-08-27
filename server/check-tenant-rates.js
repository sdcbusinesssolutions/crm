const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://ssckorsnhjhzqxyukexm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzY2tvcnNuaGpoenF4eXVrZXhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODM5OTcwOSwiZXhwIjoyMDgzOTc1NzA5fQ.aNUZx09EwkA4tEmHRK-LL4l-J6ySioqTY3c9PcQCJHc';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data: tenantRates, error } = await supabase.from('wa_message_rates').select('*').in('scope', ['TENANT', 'WORKSPACE']).not('user_id', 'is', null);
    console.log('Tenant/Workspace rates in DB:', tenantRates);
}
run();
