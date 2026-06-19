const { supabaseAdmin } = require('./server/lib/supabaseClient');
async function test() {
  const { data } = await supabaseAdmin.from('conversations').select(`
                *,
                contact:contacts!contact_phone(
                    id,
                    name,
                    phone,
                    tags,
                    color
                )
            `);
  console.dir((data || []).slice(0,1), {depth: null});
}
test();
