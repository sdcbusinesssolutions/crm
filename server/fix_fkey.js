const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixForeignKey() {
    console.log('Dropping strict foreign key on conversations.assigned_to...');
    // We use a raw SQL query via RPC or directly if possible.
    // If no RPC for raw sql exists, we might need to use pg pool.
    
    // Instead of raw sql, we'll just check if we can run it.
    // Often projects have a query or exec_sql rpc.
    const { data, error } = await supabaseAdmin.rpc('exec_sql', {
        query: 'ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_assigned_to_fkey;'
    });

    if (error) {
        console.error('Failed via RPC, attempting pg connection...');
        const { Pool } = require('pg');
        const pool = new Pool({ connectionString: process.env.DATABASE_URL });
        try {
            await pool.query('ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_assigned_to_fkey;');
            console.log('✅ Success via pg pool!');
        } catch (pgErr) {
            console.error('❌ Failed via pg pool:', pgErr.message);
        } finally {
            await pool.end();
        }
    } else {
        console.log('✅ Success via RPC!');
    }
}

fixForeignKey();
