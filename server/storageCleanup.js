require('dotenv').config();
const { supabaseAdmin } = require('./lib/supabaseClient');

async function cleanBucket(bucketId, folderPath, daysOld) {
    console.log(`\n🧹 Starting cleanup for bucket: [${bucketId}], folder: [${folderPath || 'root'}], older than ${daysOld} days`);
    
    try {
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() - daysOld);

        // List files in the bucket/folder
        const { data: files, error } = await supabaseAdmin.storage
            .from(bucketId)
            .list(folderPath, {
                limit: 1000,
                offset: 0,
                sortBy: { column: 'created_at', order: 'asc' }
            });

        if (error) {
            console.error(`❌ Error listing files in ${bucketId}/${folderPath}:`, error.message);
            return;
        }

        if (!files || files.length === 0) {
            console.log(`✅ No files found in ${bucketId}/${folderPath}`);
            return;
        }

        // Filter files older than threshold (and exclude directories/placeholder files)
        const filesToDelete = files
            .filter(file => {
                // Supabase sometimes returns an empty placeholder file for folders (like .emptyFolderPlaceholder)
                if (file.name === '.emptyFolderPlaceholder' || !file.created_at) return false;
                
                const fileDate = new Date(file.created_at);
                return fileDate < thresholdDate;
            })
            .map(file => folderPath ? `${folderPath}/${file.name}` : file.name);

        if (filesToDelete.length === 0) {
            console.log(`✅ No files older than ${daysOld} days found in ${bucketId}/${folderPath}`);
            return;
        }

        console.log(`🗑️ Deleting ${filesToDelete.length} files from ${bucketId}/${folderPath}...`);

        // Perform deletion
        const { data: deleted, error: deleteError } = await supabaseAdmin.storage
            .from(bucketId)
            .remove(filesToDelete);

        if (deleteError) {
            console.error(`❌ Error deleting files in ${bucketId}:`, deleteError.message);
        } else {
            console.log(`✅ Successfully deleted ${deleted.length} files.`);
        }
    } catch (err) {
        console.error(`❌ Unexpected error during cleanup of ${bucketId}:`, err);
    }
}

async function runCleanup() {
    console.log('🚀 Supabase Storage Cleanup Started...');
    
    // 1. Temp Bucket Cleanup (older than 3 days)
    await cleanBucket('temp', '', 3);
    
    // 2. Cache Bucket Cleanup (older than 1 day)
    await cleanBucket('cache', '', 1);
    
    // 3. Campaign Media -> 'campaign' folder (older than 30 days)
    await cleanBucket('campaign-media', 'campaign', 30);
    
    console.log('\n🎉 Storage Cleanup Finished Successfully!');
    process.exit(0);
}

runCleanup();
