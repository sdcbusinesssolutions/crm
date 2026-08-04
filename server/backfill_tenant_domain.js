require('dotenv').config({path: './.env'});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
  console.log('Fetching profiles...');
  const { data: profiles, error: pErr } = await supabase.from('profiles').select('id, signup_domain');
  if (pErr) throw pErr;
  
  console.log(`Found ${profiles.length} profiles`);
  
  let updated = 0;
  for (const p of profiles) {
    if (p.signup_domain) {
      const { data, error } = await supabase
        .from('wallet_transactions')
        .update({ tenant_domain: p.signup_domain })
        .eq('user_id', p.id)
        .is('tenant_domain', null);
      if (error) {
        console.error('Error updating for user', p.id, error.message);
      } else {
        // data might be null if no rows were updated, or it might be array
      }
      updated++;
      if (updated % 10 === 0) console.log(`Processed ${updated}/${profiles.length} profiles`);
    }
  }
  console.log('Done backfilling tenant_domain.');
}
run();
