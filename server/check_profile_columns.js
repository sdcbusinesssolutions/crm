const { supabaseAdmin } = require('./lib/supabaseClient');

async function checkColumns() {
    console.log('Checking profiles columns...');
    const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching profiles:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log('Columns:', Object.keys(data[0]));
    } else {
        console.log('No profiles found, cannot determine columns easily without metadata query.');
        // Fallback: Try to insert/update a dummy column to see if it fails? 
        // Better: Query information_schema if possible, but Supabase client might not allow direct SQL easily unless via rpc.
    }
}

checkColumns();
