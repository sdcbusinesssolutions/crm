const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupMediaStorage() {
    console.log('🚀 Starting Campaign Media Storage Setup...');

    // 1. Create 'campaign-media' Bucket
    const bucketName = 'campaign-media';
    console.log(`\n📦 Checking Storage Bucket: ${bucketName}...`);

    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
        console.error('❌ Error listing buckets:', listError.message);
    } else {
        const bucketExists = buckets.find(b => b.name === bucketName);
        if (bucketExists) {
            console.log(`✅ Bucket '${bucketName}' already exists.`);
        } else {
            console.log(`Creating bucket '${bucketName}'...`);
            const { data, error } = await supabase.storage.createBucket(bucketName, {
                public: true, // Set to true for public access (e.g., for WhatsApp usage)
                allowedMimeTypes: ['image/*', 'video/*', 'application/pdf'],
                fileSizeLimit: 52428800 // 50MB
            });

            if (error) {
                console.error(`❌ Failed to create bucket '${bucketName}':`, error.message);
            } else {
                console.log(`✅ Bucket '${bucketName}' created successfully.`);
            }
        }
    }

    // 2. Read and Display SQL for Table Creation
    const sqlPath = path.join(__dirname, '../sql/setup_campaign_media.sql');
    try {
        const sqlContent = fs.readFileSync(sqlPath, 'utf8');
        console.log('\n----------------------------------------------------------------');
        console.log('📝 DATABASE TABLE SETUP REQUIRED');
        console.log('----------------------------------------------------------------');
        console.log('Due to client limitations, you must run the SQL schema manually (unless you have a specific runner).');
        console.log(`SQL File: ${sqlPath}`);
        console.log('\nCopy and run the following in your Supabase SQL Editor:');
        console.log('----------------------------------------------------------------');
        console.log(sqlContent);
        console.log('----------------------------------------------------------------');
    } catch (err) {
        console.error('❌ Error reading SQL file:', err.message);
    }

    console.log('\n✨ Setup Script Complete.');
}

setupMediaStorage();
