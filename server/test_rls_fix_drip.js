require('dotenv').config();
const { Client } = require('pg');

async function fixRLS() {
    const client = new Client({
        connectionString: 'postgresql://postgres.ssckorsnhjhzqxyukexm:sonuDEV%402211@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres'
    });
    
    await client.connect();
    
    try {
        // Fix drip_steps
        await client.query(`
            DROP POLICY IF EXISTS "Users can manage steps of their campaigns" ON drip_steps;
            CREATE POLICY "Users can manage steps of their campaigns" ON drip_steps
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM drip_campaigns
                    WHERE drip_campaigns.id = drip_steps.drip_campaign_id
                    AND drip_campaigns.user_id = auth.uid()
                )
            );
        `);
        console.log("Fixed drip_steps");

        // Fix drip_enrollments
        await client.query(`
            DROP POLICY IF EXISTS "Users can manage enrollments of their campaigns" ON drip_enrollments;
            CREATE POLICY "Users can manage enrollments of their campaigns" ON drip_enrollments
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM drip_campaigns
                    WHERE drip_campaigns.id = drip_enrollments.drip_campaign_id
                    AND drip_campaigns.user_id = auth.uid()
                )
            );
        `);
        console.log("Fixed drip_enrollments");

        // Fix drip_logs (Assuming it has enrollment_id)
        await client.query(`
            DROP POLICY IF EXISTS "Users can manage logs of their enrollments" ON drip_logs;
            CREATE POLICY "Users can manage logs of their enrollments" ON drip_logs
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM drip_enrollments e
                    JOIN drip_campaigns c ON e.drip_campaign_id = c.id
                    WHERE e.id = drip_logs.enrollment_id
                    AND c.user_id = auth.uid()
                )
            );
        `);
        console.log("Fixed drip_logs");

    } catch (e) {
        console.error("Error:", e);
    }
    
    await client.end();
}

fixRLS();
