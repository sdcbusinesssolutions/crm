
const { supabaseAdmin } = require('./lib/supabaseClient');
async function check() {
    const { data, error } = await supabaseAdmin.from('conversations').select('*').limit(1);
    if (error) console.error(error);
    else console.log(Object.keys(data[0] || {}));
}
check();
