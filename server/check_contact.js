const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
    const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .limit(10);
        
    console.log("Error:", error);
    console.log("Data length:", data?.length);
    console.log("Data:", JSON.stringify(data, null, 2));
}

check();
