const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://dndmbarbnsdlbclghkbs.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRuZG1iYXJibnNkbGJjbGdoa2JzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQ4MjMxMywiZXhwIjoyMDk0MDU4MzEzfQ.kGyOt8oA0FfR_zXRJjK0lAzSTNKX3f6cK6b_wPmChxI');
async function check() {
    const { data } = await supabase.from('drip_enrollments').select('id, status, current_step_id, next_run_at, last_run_at, current_step:drip_steps!drip_enrollments_current_step_id_fkey(id, step_order)').eq('id', '7ea11e07-ffcd-40a4-b8ce-c69deb4cc984').single();
    console.log(JSON.stringify(data, null, 2));
}
check();
