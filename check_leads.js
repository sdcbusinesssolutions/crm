const { supabaseAdmin } = require('./server/lib/supabaseClient');

async function checkLeads() {
    try {
        const { data, error } = await supabaseAdmin.from('leads').select('*').limit(1);
        if (error) throw error;
        console.log('Leads Columns:', Object.keys(data[0] || {}));
    } catch (e) {
        console.error(e);
    }
}

checkLeads();
