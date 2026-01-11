
const { supabaseAdmin } = require('./server/lib/supabaseClient');

async function listBuckets() {
    const { data, error } = await supabaseAdmin.storage.listBuckets();
    if (error) {
        console.error('Error listing buckets:', error);
    } else {
        console.log('Buckets:', JSON.stringify(data, null, 2));
    }
}

listBuckets();
