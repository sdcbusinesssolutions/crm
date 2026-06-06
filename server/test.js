const { supabaseAdmin } = require('./lib/supabaseClient');

async function test() {
  try {
    const { data, error } = await supabaseAdmin
      .from('follow_ups')
      .insert({
        user_id: 'dummy-user-id', // Use a real user ID or just let it fail to see the error
        contact_id: '95d33c42-6373-452d-8df8-c8356c867a74', // A valid UUID format
        title: 'Test',
        description: 'Test',
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
