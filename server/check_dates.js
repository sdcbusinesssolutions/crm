const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ssckorsnhjhzqxyukexm.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzY2tvcnNuaGpoenF4eXVrZXhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODM5OTcwOSwiZXhwIjoyMDgzOTc1NzA5fQ.aNUZx09EwkA4tEmHRK-LL4l-J6ySioqTY3c9PcQCJHc';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

async function checkDateDifferences() {
    const messageId = "wamid.HBgMOTE4NDA4OTA3NTE2FQIAEhggQUNDRThEN0IzNERBQzIxQzM0QkU4OEFDRjA3Njg1MzgA";

    // Webhook log
    console.log("--- WEBHOOK LOG ---");
    const { data: targetLog } = await supabaseAdmin.from('webhook_logs').select('*').eq('id', '965ffa8a-8d38-4d1c-9e8d-b2e984b97b61').single();

    if (targetLog) {
        console.log(`Webhook Received At DB: ${targetLog.created_at}`);

        if (targetLog.extracted_content) {
            console.log(`Extracted Timestamp: ${targetLog.extracted_content.timestamp}`);
            const ts = parseInt(targetLog.extracted_content.timestamp, 10);
            console.log(`Date from Meta Timestamp: ${new Date(ts * 1000).toISOString()} (UTC)`);
            console.log(`Date from Meta Timestamp: ${new Date(ts * 1000).toLocaleString('en-US', { timeZone: 'Asia/Kolkata', hour12: false })} (IST)`);
        }
    }
}

checkDateDifferences();
