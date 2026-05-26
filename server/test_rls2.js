require('dotenv').config();
const { Client } = require('pg');

async function fixRLS() {
    const client = new Client({
        connectionString: 'postgresql://postgres.ssckorsnhjhzqxyukexm:sonuDEV%402211@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres'
    });
    
    await client.connect();
    
    // Check if RLS is enabled
    const res = await client.query(`SELECT relrowsecurity FROM pg_class WHERE relname = 'drip_campaigns';`);
    console.log("RLS enabled on drip_campaigns:", res.rows[0]?.relrowsecurity);
    
    // If it's enabled but no policies exist, we should probably add one to allow user to manage their own campaigns
    // Or just disable RLS if it's not meant to be enabled. But standard is to have user_id = auth.uid()
    // Let's add the standard policy for drip_campaigns:
    
    try {
        await client.query(`
            DROP POLICY IF EXISTS "Users can manage their own drip campaigns" ON drip_campaigns;
            CREATE POLICY "Users can manage their own drip campaigns" ON drip_campaigns
                FOR ALL USING (auth.uid() = user_id);
        `);
        console.log("Policy created.");
        
        const resPol = await client.query(`
            SELECT cmd, qual, with_check 
            FROM pg_policies 
            WHERE tablename = 'drip_campaigns';
        `);
        console.log("New Policies:", resPol.rows);
    } catch (e) {
        console.error("Error creating policy:", e);
    }
    
    await client.end();
}

fixRLS();
