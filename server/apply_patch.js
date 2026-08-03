const { createClient } = require('@supabase/supabase-js');

// Use the user's provided production keys for the test
const supabaseUrl = 'https://dndmbarbnsdlbclghkbs.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRuZG1iYXJibnNkbGJjbGdoa2JzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQ4MjMxMywiZXhwIjoyMDk0MDU4MzEzfQ.kGyOt8oA0FfR_zXRJjK0lAzSTNKX3f6cK6b_wPmChxI';

// We need postgres credentials to run CREATE INDEX natively, or we can use the postgres connection string the user gave us earlier:
// postgresql://postgres.dndmbarbnsdlbclghkbs:sonuDEV%402211@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres

const { Client } = require('pg');

async function applySecurityPatch() {
    const client = new Client({
        connectionString: 'postgresql://postgres.dndmbarbnsdlbclghkbs:sonuDEV%402211@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres'
    });

    try {
        await client.connect();
        console.log('Connected to Production Database.');

        const sql = `
            CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_tx_refund_dedup
            ON public.wallet_transactions(wa_message_id)
            WHERE source IN ('ADJUSTMENT', 'REFUND');
        `;
        
        await client.query(sql);
        console.log('✅ SECURITY PATCH APPLIED: Unique constraint idx_wallet_tx_refund_dedup created successfully.');
        
    } catch (err) {
        console.error('❌ Failed to apply patch:', err);
    } finally {
        await client.end();
    }
}

applySecurityPatch();
