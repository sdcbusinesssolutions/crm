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
            `).limit(1);
  console.dir(data[0].contact, {depth: null});
}
test();
