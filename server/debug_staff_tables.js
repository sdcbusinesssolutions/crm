const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkStaffModule() {
    console.log('--- Checking Staff Module Tables ---');
    const tables = ['team_staff', 'team_staff_permissions', 'lead_assignments'];

    for (const table of tables) {
        const { data, error } = await supabase.from(table).select('*').limit(5);
        if (error) {
            console.error(`❌ Table '${table}' error:`, error.message);
        } else {
            console.log(`✅ Table '${table}' exists. Count: ${data.length}`);
            if (data.length > 0) {
                console.log(`   Sample:`, data[0]);
            }
        }
    }
}

checkStaffModule();
