const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Configure path to domains.csv (in root, 2 dirs up from server/scripts)
const CSV_PATH = path.join(__dirname, '../../domains.csv');

async function setupMultitenantMedia() {
    console.log('🚀 Starting Multitenant Media Storage Setup...');

    if (!fs.existsSync(CSV_PATH)) {
        console.error(`❌ domains.csv not found at ${CSV_PATH}`);
        process.exit(1);
    }

    const rawContent = fs.readFileSync(CSV_PATH, 'utf8');
    const lines = rawContent.split(/\r?\n/).filter(line => line.trim() !== '');

    // Parse Header to find indices
    const headers = lines[0].split(',').map(h => h.trim());
    const urlIndex = headers.indexOf('SupabaseUrl');
    const keyIndex = headers.indexOf('SupabaseServiceKey');
    const domainIndex = headers.indexOf('Domain');

    if (urlIndex === -1 || keyIndex === -1) {
        console.error('❌ CSV missing SupabaseUrl or SupabaseServiceKey columns');
        process.exit(1);
    }

    console.log(`Found ${lines.length - 1} entries in CSV.\n`);

    // Group by Supabase URL to avoid duplicate work
    const uniqueDatabases = new Map(); // URL -> Key

    // Process rows
    for (let i = 1; i < lines.length; i++) {
        // Basic CSV parsing (assuming no commas in values based on file view)
        const cols = lines[i].split(',');
        if (cols.length < headers.length) continue;

        const url = cols[urlIndex].trim();
        const key = cols[keyIndex].trim();
        const domain = cols[domainIndex].trim();

        if (url && key) {
            if (!uniqueDatabases.has(url)) {
                uniqueDatabases.set(url, { key, domains: [] });
            }
            uniqueDatabases.get(url).domains.push(domain);
        }
    }

    console.log(`Processing ${uniqueDatabases.size} unique Supabase instances...\n`);

    let successCount = 0;
    let failCount = 0;

    const logDir = path.join(__dirname, '../../deployment_logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

    function logToDomain(domain, message) {
        const timestamp = new Date().toISOString();
        const logFile = path.join(logDir, `${domain}_deploy.log`);
        fs.appendFileSync(logFile, `[${timestamp}] [STORAGE] ${message}\n`);
    }

    for (const [url, data] of uniqueDatabases) {
        const { key, domains } = data;
        console.log(`📡 Connecting to ${url} (used by: ${domains.join(', ')})`);

        domains.forEach(d => logToDomain(d, `Configuring Media Storage...`));

        try {
            const supabase = createClient(url, key);

            // 1. Setup Bucket
            const bucketName = 'campaign-media';

            // Expanded MIME Types (Matching user requirements: Audio, Docs, CSV, Excel, etc.)
            const allowedMimeTypes = [
                'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp',
                'video/mp4', 'video/3gpp', 'video/quicktime',
                'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/mp4', 'audio/x-m4a',
                'application/pdf', 'text/plain', 'text/csv',
                'application/vnd.ms-excel',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/vnd.ms-powerpoint',
                'application/vnd.openxmlformats-officedocument.presentationml.presentation'
            ];

            const bucketConfig = {
                public: true,
                allowedMimeTypes: allowedMimeTypes,
                fileSizeLimit: 52428800 // 50MB
            };

            const { data: buckets, error: listError } = await supabase.storage.listBuckets();

            if (listError) {
                if (listError.message && listError.message.includes('fetch failed')) {
                    console.log(`   ⚠️ Skipped bucket setup (Supabase unreachable).`);
                } else {
                    console.error(`   ❌ Failed to list buckets: ${listError.message}`);
                }
                failCount++;
                continue;
            }

            const existing = buckets.find(b => b.name === bucketName);
            if (existing) {
                console.log(`   🔄 Bucket '${bucketName}' exists. Updating configuration...`);
                // Update the bucket to ensure new MIME types are allowed
                const { error: updateError } = await supabase.storage.updateBucket(bucketName, bucketConfig);

                if (updateError) {
                    console.error(`   ❌ Failed to update bucket config: ${updateError.message}`);
                    domains.forEach(d => logToDomain(d, `❌ Bucket update failed: ${updateError.message}`));
                } else {
                    console.log(`   ✅ Bucket '${bucketName}' updated with new file types.`);
                    domains.forEach(d => logToDomain(d, `✅ Bucket '${bucketName}' updated successfully.`));
                }
            } else {
                console.log(`   ⚙️ Creating bucket '${bucketName}'...`);
                const { error: createError } = await supabase.storage.createBucket(bucketName, bucketConfig);

                if (createError) {
                    console.error(`   ❌ Failed to create bucket: ${createError.message}`);
                    domains.forEach(d => logToDomain(d, `❌ Bucket creation failed: ${createError.message}`));
                    failCount++;
                    continue; // Correctly skip success increment on failure
                } else {
                    console.log(`   ✅ Bucket '${bucketName}' created successfully.`);
                    domains.forEach(d => logToDomain(d, `✅ Bucket '${bucketName}' created successfully.`));
                }
            }

            successCount++;

        } catch (err) {
            console.error(`   ❌ Unexpected error: ${err.message}`);
            domains.forEach(d => logToDomain(d, `❌ Critical Setup Error: ${err.message}`));
            failCount++;
        }
        console.log('---');
    }

    console.log(`\n🎉 Setup Complete. Success: ${successCount}, Failed: ${failCount}`);

    // Read and display the SQL
    try {
        const sqlPath = path.join(__dirname, '../sql/setup_campaign_media.sql');
        const sqlContent = fs.readFileSync(sqlPath, 'utf8');
        console.log('\n----------------------------------------------------------------');
        console.log('📝 DATABASE ACTION REQUIRED');
        console.log('----------------------------------------------------------------');
        console.log('Please copy and run the following SQL in the Supabase SQL Editor for EACH of the unique databases listed above:');
        console.log('----------------------------------------------------------------');
        console.log(sqlContent);
        console.log('----------------------------------------------------------------');
    } catch (err) {
        if (err.code !== 'ENOENT') {
            console.error('Failed to read SQL file:', err.message);
        }
    }
}

setupMultitenantMedia();
