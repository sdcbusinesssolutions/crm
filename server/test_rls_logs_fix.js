require('dotenv').config();
const { Client } = require('pg');

async function fixDripLogsRLS() {
    const client = new Client({
        connectionString: 'postgresql://postgres.ssckorsnhjhzqxyukexm:sonuDEV%402211@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres'
    });
    
    await client.connect();
    try {
        await client.query(`
            DROP POLICY IF EXISTS "Users can manage logs of their enrollments" ON drip_logs;
            CREATE POLICY "Users can manage logs of their enrollments" ON drip_logs
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM drip_enrollments e
                    JOIN drip_campaigns c ON e.drip_campaign_id = c.id
                    WHERE e.id = drip_logs.drip_enrollment_id
                    AND c.user_id = auth.uid()
                )
            );
        `);
        console.log("Fixed drip_logs RLS");
    } catch (e) {
        console.error("Error:", e);
    }
    await client.end();
}

fixDripLogsRLS();
