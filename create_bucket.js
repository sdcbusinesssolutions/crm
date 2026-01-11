
const { supabaseAdmin } = require('./server/lib/supabaseClient');

async function setupBucket() {
    console.log('Creating bucket "campaign-media"...');
    const { data, error } = await supabaseAdmin.storage.createBucket('campaign-media', {
        public: true,
        fileSizeLimit: 10485760, // 10MB
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'video/mp4']
    });

    if (error) {
        console.error('Error creating bucket:', error);
        // If it exists, it's fine
        if (error.message.includes('already exists')) {
            console.log('Bucket already exists.');
        }
    } else {
        console.log('Bucket created:', data);
    }
}

setupBucket();
