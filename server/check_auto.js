const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
    const { data, error } = await supabase
        .from('sheet_automations')
        .select('*')
        .eq('id', '4a1e4635-4645-402b-8112-a97cfc329c69')
        .single();
    
    if (error) {
        // try with the other id mentioned in url
        console.log("Not found with 402b. Trying 407b");
        const res2 = await supabase
            .from('sheet_automations')
            .select('*')
            .eq('id', '4a1e4635-4545-407b-8112-a97cfc329c69')
            .single();
        console.log(JSON.stringify(res2.data.template_config, null, 2));
    } else {
        console.log(JSON.stringify(data.template_config, null, 2));
    }
}
check();
