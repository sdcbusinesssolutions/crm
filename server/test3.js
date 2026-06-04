const { supabaseAdmin } = require('./lib/supabaseClient');

async function test() {
  try {
    const { data: contact } = await supabaseAdmin.from('contacts').select('id, user_id').limit(1).single();
    
    const { data, error } = await supabaseAdmin
      .from('follow_ups')
      .insert({
        user_id: contact.user_id,
        contact_id: '00000000-0000-0000-0000-000000000000', // Non-existent UUID
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
  } catch(e) {
    console.error("Exception:", e);
  }
}
test();
