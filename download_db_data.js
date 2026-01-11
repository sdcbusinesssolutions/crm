const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const result = require('dotenv').config({ path: path.join(__dirname, 'server/.env') });

if (result.error) {
    console.error('Dotenv Error:', result.error);
}

console.log('Loaded File:', path.join(__dirname, 'server/.env'));
console.log('SUPABASE_URL:', process.env.SUPABASE_URL || 'MISSING');
console.log('SUPABASE_SERVICE_KEY Length:', process.env.SUPABASE_SERVICE_KEY ? process.env.SUPABASE_SERVICE_KEY.length : 0);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in server/.env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function downloadData() {
    console.log(`Connecting to ${supabaseUrl}...`);

    // List of known public tables
    const tables = [
        'contacts', 'contact_groups', 'custom_fields',
        'pipelines', 'pipeline_stages', 'leads',
        'forms', 'form_submissions',
        'notes', 'tasks', 'appointments', 'call_logs',
        'whatsapp_config', 'user_security', 'whatsapp_templates',
        'conversations', 'messages', 'flows', 'webhook_logs',
        'campaigns', 'campaign_queue', 'meta_limits'
    ];

    let sqlContent = `-- Database Dump Generated via Script\n-- Date: ${new Date().toISOString()}\n\n`;

    for (const table of tables) {
        process.stdout.write(`Downloading table '${table}'... `);

        try {
            const { data, error } = await supabase.from(table).select('*');

            if (error) {
                console.log(`FAILED: ${error.message}`);
                continue;
            }

            if (!data || data.length === 0) {
                console.log(`(Empty)`);
                continue;
            }

            console.log(`${data.length} rows.`);

            sqlContent += `-- Data for ${table}\n`;

            data.forEach(row => {
                const keys = Object.keys(row).join(', ');
                const values = Object.values(row).map(v => {
                    if (v === null) return 'NULL';
                    if (typeof v === 'object') return `'${JSON.stringify(v)}'`;
                    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
                    if (typeof v === 'number') return v;
                    // Escape single quotes for SQL
                    return `'${String(v).replace(/'/g, "''")}'`;
                }).join(', ');

                sqlContent += `INSERT INTO public.${table} (${keys}) VALUES (${values});\n`;
            });
            sqlContent += '\n';

        } catch (err) {
            console.log(`ERROR: ${err.message}`);
        }
    }

    fs.writeFileSync('Full_Data_Dump.sql', sqlContent);
    console.log('\nSuccess! Data saved to Full_Data_Dump.sql');
}

downloadData();
