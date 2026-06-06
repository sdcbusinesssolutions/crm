const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://dndmbarbnsdlbclghkbs.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRuZG1iYXJibnNkbGJjbGdoa2JzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQ4MjMxMywiZXhwIjoyMDk0MDU4MzEzfQ.kGyOt8oA0FfR_zXRJjK0lAzSTNKX3f6cK6b_wPmChxI');
async function check() {
    const { data } = await supabase.from('drip_steps').select('delay_unit').limit(10);
    console.log(data);
}
check();
