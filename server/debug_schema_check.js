const { supabaseAdmin } = require('./lib/supabaseClient');

async function inspectSchema() {
    console.log('Inspecting sheet_automations table...');

    // We can't easily select from information_schema via the JS client standard library usually, 
    // unless we use rpc or if we just try to select * and see what we get (empty).
    // Or we can try to insert a dummy row with all keys and see the error.
    // Better: Try to select all columns (just 1 row) to deduce structure if data exists, 
    // but better to just run a raw query if possible? No, can't run raw SQL.

    // Valid workaround: Check for explicit columns by selecting them.
    const { data, error } = await supabaseAdmin
        .from('sheet_automations')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error selecting from table:', error);
        return;
    }

    console.log('Select successful. Data:', data);

    if (data.length > 0) {
        console.log('Columns found:', Object.keys(data[0]));
    } else {
        console.log('Table exists but is empty. Cannot deduce columns easily without headers.');
        // If empty, we can just drop and recreate safely? 
        // Or we can try to insert a row and see if it fails.
    }
}

inspectSchema();
