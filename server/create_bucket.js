const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

async function createBucket() {
    console.log("Creating bucket 'agent_documents'...");
    const { data, error } = await supabaseAdmin.storage.createBucket('agent_documents', {
        public: false, // private bucket
        allowedMimeTypes: ['text/plain', 'application/pdf', 'text/csv', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/markdown'],
        fileSizeLimit: 10485760 // 10MB
    });
    
    if (error) {
        console.error("Error creating bucket:", error);
    } else {
        console.log("Bucket created successfully:", data);
    }
}

createBucket();
