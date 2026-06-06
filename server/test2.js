const { supabaseAdmin } = require('./lib/supabaseClient');

async function test() {
  try {
    // get a valid user and contact
    const { data: contact } = await supabaseAdmin.from('contacts').select('id, user_id').limit(1).single();
    if (!contact) {
        console.log("no contact found");
        return;
    }
    
    console.log("Using contact:", contact);

    const { data, error } = await supabaseAdmin
      .from('follow_ups')
      .insert({
        user_id: contact.user_id,
        contact_id: contact.id,
        title: 'Sequence: Followup-drip',
        description: '',
        scheduled_at: new Date().toISOString(),
        priority: 'MEDIUM',
        type: 'CALL',
        timezone: 'UTC',
        status: 'PENDING'
      })
      .select()
      .single();

    console.log("Error:", error);
    console.log("Data:", data);
  } catch(e) {
    console.error("Exception:", e);
  }
}
test();
