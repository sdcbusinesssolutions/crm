const { supabaseAdmin } = require('./server/lib/supabaseClient');
async function run() {
  const { data, error } = await supabaseAdmin.from('conversations').select('id, tags').contains('tags', ['TestTag']).limit(1);
  console.log('Error:', error);
  console.log('Data:', data);
}
run();
