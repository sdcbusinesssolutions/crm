const { supabaseAdmin } = require('./server/lib/supabaseClient');
async function run() {
  const { data, error } = await supabaseAdmin.storage.from('campaign-media').upload('test.ogg', Buffer.from('dummy'), { contentType: 'audio/ogg' });
  console.log('OGG Upload:', error ? error.message : 'Success');
}
run();
