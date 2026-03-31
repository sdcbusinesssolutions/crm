const { supabaseAdmin } = require('./lib/supabaseClient');

async function checkLogs() {
    try {
        console.log('--- Drip Logs Samples ---');
        const { data: logs, error: lErr } = await supabaseAdmin
            .from('drip_logs')
            .select('*')
            .limit(5)
            .order('created_at', { ascending: false });
        
        if (lErr) throw lErr;
        console.log(JSON.stringify(logs, null, 2));

        if (logs && logs.length > 0) {
            const enrollmentId = logs[0].drip_enrollment_id;
            console.log(`\n--- Logs for Enrollment ID: ${enrollmentId} ---`);
            const { data: enrLogs, error: elErr } = await supabaseAdmin
                .from('drip_logs')
                .select('*')
                .eq('drip_enrollment_id', enrollmentId)
                .order('created_at', { ascending: true });
            
            if (elErr) throw elErr;
            console.log(JSON.stringify(enrLogs, null, 2));
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

checkLogs();
