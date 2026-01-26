const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../../lib/supabaseClient');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const upload = multer({ dest: 'uploads/temp/' });

// 1. Upload Knowledge Base
router.post('/:agentId/knowledge', upload.single('file'), async (req, res) => {
    try {
        const { agentId } = req.params;
        const user_id = req.user.id;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Verify ownership
        const { data: agent } = await supabaseAdmin.from('ai_agents').select('id').eq('id', agentId).eq('user_id', user_id).single();
        if (!agent) {
            fs.unlinkSync(file.path); // Clean up
            return res.status(404).json({ error: 'Agent not found' });
        }

        // Check file type
        const fileExt = path.extname(file.originalname).toLowerCase();
        const allowed = ['.pdf', '.txt', '.docx', '.csv', '.md'];
        if (!allowed.includes(fileExt)) {
            fs.unlinkSync(file.path);
            return res.status(400).json({ error: 'Invalid file type' });
        }

        // Read file content (Simplistic - for real production we'd use vector DB or store in Storage Bucket)
        // For MVP: We will store text content or file path in a separate 'ai_knowledge' table
        // Or better: Store in Supabase Storage and link it.

        // Let's assume we read text for small files (txt/md) or just store metadata for now.
        // Reading text from PDF/Docx requires parsing libraries (pdf-parse, mammoth).
        // I'll stick to basic file metadata storage for the "Knowledge Base" list feature.

        // Upload to Supabase Storage
        const fileContent = fs.readFileSync(file.path);
        const storagePath = `agents/${agentId}/${Date.now()}_${file.originalname}`;

        const { error: uploadError } = await supabaseAdmin.storage
            .from('agent_documents')
            .upload(storagePath, fileContent, {
                contentType: file.mimetype,
                upsert: false
            });

        fs.unlinkSync(file.path); // Clean up temp

        if (uploadError) throw uploadError;

        // Insert into DB
        const { data: doc, error: dbError } = await supabaseAdmin
            .from('ai_knowledge_base')
            .insert({
                agent_id: agentId,
                user_id: user_id,
                file_name: file.originalname,
                file_path: storagePath,
                file_type: fileExt,
                file_size: file.size
            })
            .select()
            .single();

        if (dbError) throw dbError;

        res.json(doc);

    } catch (error) {
        console.error('Upload Knowledge Error:', error);
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: error.message });
    }
});

// 2. List Knowledge
router.get('/:agentId/knowledge', async (req, res) => {
    try {
        const { agentId } = req.params;
        const user_id = req.user.id;

        const { data, error } = await supabaseAdmin
            .from('ai_knowledge_base')
            .select('*')
            .eq('agent_id', agentId)
            .eq('user_id', user_id);

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. Delete Knowledge
router.delete('/:agentId/knowledge/:docId', async (req, res) => {
    try {
        const { agentId, docId } = req.params;
        const user_id = req.user.id;

        // Get doc to find storage path
        const { data: doc } = await supabaseAdmin
            .from('ai_knowledge_base')
            .select('file_path')
            .eq('id', docId)
            .eq('agent_id', agentId)
            .single();

        if (doc) {
            // Delete from Storage
            await supabaseAdmin.storage.from('agent_documents').remove([doc.file_path]);
        }

        // Delete from DB
        const { error } = await supabaseAdmin
            .from('ai_knowledge_base')
            .delete()
            .eq('id', docId)
            .eq('agent_id', agentId)
            .eq('user_id', user_id);

        if (error) throw error;
        res.json({ success: true });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
