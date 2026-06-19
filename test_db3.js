const { supabaseAdmin } = require('./server/lib/supabaseClient');
async function test() {
  const { data } = await supabaseAdmin.from('conversations').select(`
                id,
                contact:contacts!contact_phone(
                    tags
                )
            `).limit(1);
  console.dir((data || []), {depth: null});
}
test();
