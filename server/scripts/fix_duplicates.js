const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function fixDuplicates() {
    const dupId = '712851615243145';
    const staleUserId = '24893f5d-5d87-4314-8232-1cec9afed1f5'; // dev@gamil.com (older, likely test)

    console.log(`Deleting duplicate config for stale user ${staleUserId}...`);

    const { error } = await supabase
        .from('whatsapp_config')
        .delete()
        .eq('phone_number_id', dupId)
        .eq('user_id', staleUserId);

    if (error) {
        console.error('Error deleting duplicate:', error);
    } else {
        console.log('✅ Deleted stale config. Routing should now be correct for the active user.');
    }
}

fixDuplicates();
