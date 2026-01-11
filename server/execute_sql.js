const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Must act as admin

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runSql() {
    const sqlFile = process.argv[2];
    if (!sqlFile) {
        console.error('Usage: node execute_sql.js <path_to_sql_file>');
        process.exit(1);
    }

    try {
        const filePath = path.resolve(process.cwd(), sqlFile);

        console.log(`Checking file ${sqlFile} via Supabase Client...`);

        // ALTERNATIVE: Use the debug_flows.js logic!
        // We really just want to see flows.

        const { data, error } = await supabase
            .from('flows')
            .select('id, name, status, nodes')
            .eq('status', 'published');

        if (error) throw error;

        let found = false;
        if (data) {
            for (const flow of data) {
                const nodes = typeof flow.nodes === 'string' ? JSON.parse(flow.nodes) : flow.nodes;
                const hasTask = nodes.some(n => n.type === 'taskReminder');
                if (hasTask) {
                    console.log(`✅ Found Published Flow with Task Trigger: "${flow.name}"(ID: ${flow.id})`);
                    found = true;
                }
            }
        }

        if (!found) {
            console.log('❌ No published flows found with Task Reminder nodes.');
        }

    } catch (err) {
        console.error('❌ SQL check failed:', err.message);
    }
}

runSql();
