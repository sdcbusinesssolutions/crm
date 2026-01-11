const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Uploads directory creation removed for Serverless/Netlify compatibility

const { supabaseAdmin } = require('../lib/supabaseClient');

// Configure storage (Memory for direct upload to Supabase)
const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// POST /api/upload
router.post('/', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const userId = req.user ? req.user.id : 'anonymous';
        const dateStr = new Date().toISOString().split('T')[0];
        const fileExt = path.extname(req.file.originalname);
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;

        // path: userId/outbound/date/filename
        const fileName = `${userId}/outbound/${dateStr}/${uniqueSuffix}${fileExt}`;

        // Upload to Supabase Storage
        const { data, error } = await supabaseAdmin
            .storage
            .from('campaign-media')
            .upload(fileName, req.file.buffer, {
                contentType: req.file.mimetype,
                upsert: false
            });

        if (error) {
            throw error;
        }

        // Get Public URL
        const { data: publicUrlData } = supabaseAdmin
            .storage
            .from('campaign-media')
            .getPublicUrl(fileName);

        res.json({
            success: true,
            url: publicUrlData.publicUrl,
            filename: fileName,
            mimetype: req.file.mimetype,
            // Echo back contextual params for frontend mapping
            variable_key: req.body.variable_key,
            card_index: req.body.card_index
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
