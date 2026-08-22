const { supabaseAdmin } = require('./lib/supabaseClient');
async function test() {
  const { data, error } = await supabaseAdmin.from('flow_sessions')
    .select('id, variables, last_interaction_at')
    .eq('status', 'delayed')
    .or(`variables->>global_resume_at.lte.${new Date().toISOString()},variables->global_resume_at.is.null`)
    .limit(10);
  console.log("Error:", error);
  console.log("Data count:", data ? data.length : 0);
}
test();
