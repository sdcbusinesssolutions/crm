require('dotenv').config({path: '../../.env'});
const { supabaseAdmin } = require('./lib/supabaseClient');

async function check() {
    const { data } = await supabaseAdmin.from('profiles').select('id, email, role, signup_domain').ilike('email', '%cloudospire%');
    console.log("cloudospire emails:", data);
    
    const { data: data2 } = await supabaseAdmin.from('profiles').select('id, email, role, signup_domain').eq('role', 'super_admin');
    console.log("super admins:", data2);
}
check();
