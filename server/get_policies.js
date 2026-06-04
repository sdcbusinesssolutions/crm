const { supabaseAdmin } = require('./lib/supabaseClient');

async function getPolicies() {
  try {
    const { data, error } = await supabaseAdmin.rpc('run_sql', {
      query: "SELECT * FROM pg_policies WHERE tablename = 'follow_ups';"
    });
    if (error) {
      console.log("RPC run_sql failed, trying direct query on pg_policies using postgrest schema...");
    } else {
      console.log("Policies:", data);
    }
  } catch (err) {
    console.error(err);
  }
}
getPolicies();
