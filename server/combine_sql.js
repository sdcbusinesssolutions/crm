const fs = require('fs');
const path = require('path');

const sqlDir = path.join(__dirname, 'sql');
const outputFile = path.join(sqlDir, 'final_wallet_schema.sql');

const filesToCombine = [
    'wallet_migration.sql',            // 1. Core tables
    'wallet_migration_v2.sql',         // 2. Alters & extensions
    '223_audit_compliance.sql',        // 3. Triggers & Auditing
    'wallet_atomic_rpc_v2.sql',        // 4. RPCs (core)
    '221_wallet_reseller_transfer.sql',// 5. RPCs (reseller)
    '222_reporting_functions.sql'      // 6. Dashboards/Reports
];

let finalSql = '-- =========================================================================\n';
finalSql += '-- FULL AND FINAL WALLET ARCHITECTURE MIGRATION SCRIPT\n';
finalSql += '-- Run this entire file in your Supabase SQL Editor once.\n';
finalSql += '-- =========================================================================\n\n';

for (const file of filesToCombine) {
    const filePath = path.join(sqlDir, file);
    if (fs.existsSync(filePath)) {
        finalSql += `-- >>> BEGIN FILE: ${file} <<<\n`;
        finalSql += fs.readFileSync(filePath, 'utf8') + '\n\n';
    } else {
        console.warn(`Missing file: ${file}`);
    }
}

fs.writeFileSync(outputFile, finalSql, 'utf8');
console.log(`Successfully combined SQL scripts into: ${outputFile}`);
