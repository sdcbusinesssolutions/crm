const fs = require('fs');
const path = require('path');

function printInstructions() {
    const sqlPath = path.resolve(__dirname, '../../db_sql/add_campaign_location.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('----------------------------------------------------------------');
    console.log('Automated migration failed due to missing permissions (SUPABASE_SERVICE_KEY).');
    console.log('Please run the following SQL manually in your Supabase SQL Editor:');
    console.log('----------------------------------------------------------------');
    console.log(sql);
    console.log('----------------------------------------------------------------');
}

printInstructions();
