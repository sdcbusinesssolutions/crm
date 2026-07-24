const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ssckorsnhjhzqxyukexm.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzY2tvcnNuaGpoenF4eXVrZXhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODM5OTcwOSwiZXhwIjoyMDgzOTc1NzA5fQ.aNUZx09EwkA4tEmHRK-LL4l-J6ySioqTY3c9PcQCJHc';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkDatabase() {
    try {
        console.log("Checking connection to:", SUPABASE_URL);
        
        // Check if basic tables exist
        const tablesToCheck = ['users', 'profiles', 'contacts', 'messages', 'conversations', 'whatsapp_flows', 'whatsapp_flow_submissions', 'pipelines', 'pipeline_stages', 'leads', 'tags'];
        
        for (const table of tablesToCheck) {
            const { data, error } = await supabase.from(table).select('*').limit(1);
            if (error) {
                console.log(`❌ Error fetching from '${table}':`, error.message);
            } else {
                console.log(`✅ Table '${table}' exists and is accessible.`);
            }
        }
        
    } catch (e) {
        console.error("Connection error:", e);
    }
}

checkDatabase();
