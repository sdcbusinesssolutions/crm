const { supabaseAdmin } = require('./lib/supabaseClient');

async function fixBucket() {
    console.log('Inspecting bucket campaign-media...');
    try {
        const { data: bucket, error: getError } = await supabaseAdmin.storage.getBucket('campaign-media');

        if (getError) {
            console.error('Error getting bucket:', getError);
            if (getError.message && getError.message.toLowerCase().includes('not found')) {
                console.log('Bucket not found, creating...');
                // Create with NO restrictions (null)
                const { data: createData, error: createError } = await supabaseAdmin.storage.createBucket('campaign-media', {
                    public: true,
                    allowedMimeTypes: null,
                    fileSizeLimit: 52428800 // 50MB
                });
                if (createError) console.error('Error creating bucket:', createError);
                else console.log('Bucket created successfully with no restrictions.');
                return;
            }
        }

        console.log('Current Bucket Config allowedMimeTypes:', bucket ? bucket.allowed_mime_types : 'Unknown');

        // Explicitly set allowedMimeTypes to common document and image types + null (if supported) 

        const allowedTypes = [
            'image/x-png', 'image/png', 'image/jpg', 'image/jpeg', 'image/gif', 'image/webp',
            'video/mp4', 'video/quicktime',
            'application/pdf',
            'application/msword', // .doc
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain',
            'text/csv'
        ];

        console.log('Updating bucket to allow specific PDF/Doc types...');
        const { data, error } = await supabaseAdmin.storage.updateBucket('campaign-media', {
            public: true,
            allowedMimeTypes: allowedTypes, // Trying explicit list first to be sure
            fileSizeLimit: 52428800 // 50MB
        });

        if (error) {
            console.error('Error updating bucket:', error);
        } else {
            console.log('Bucket updated successfully with explicit allowed MIME types including PDF.');
        }

    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

fixBucket();
