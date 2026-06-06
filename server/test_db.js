const { supabaseAdmin } = require('./lib/supabaseClient');
async function run() {
  const { data, error } = await supabaseAdmin.from('user_wallets').select('*').limit(1);
  console.log(error ? error : "Table exists!");
}
run();
