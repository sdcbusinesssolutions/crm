const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById('560fe563-3f17-4784-94fd-25af552f1a4f');
        
    console.log("Profiles Error:", userError);
    if(userData && userData.user) {
        console.log(JSON.stringify(userData.user.user_metadata, null, 2));
    }
}

check();
