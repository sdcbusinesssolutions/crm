const path = require('path');
const { supabaseAdmin } = require(path.join(__dirname, '../server/lib/supabaseClient'));

async function tryExecSql() {
    const query = "ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_staff_ids UUID[] DEFAULT '{}'";
    try {
        const { data, error } = await supabaseAdmin.rpc('exec_sql', { query });
        if (error) {
            console.error('RPC exec_sql failed:', error);
            // Try another common name
            const { data: data2, error: error2 } = await supabaseAdmin.rpc('execute_sql', { sql: query });
            if (error2) {
               console.error('RPC execute_sql failed:', error2);
            } else {
               console.log('Success via execute_sql:', data2);
            }
        } else {
            console.log('Success via exec_sql:', data);
        }
    } catch (err) {
        console.error('Catch error:', err);
    }
}

tryExecSql();
