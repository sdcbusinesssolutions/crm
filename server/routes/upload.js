const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const sharp = require('sharp'); // Make sure to npm install sharp

const { supabaseAdmin } = require('../lib/supabaseClient');

// Configure storage (Memory for direct upload to Supabase)
const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    limits: { fileSize: 16 * 1024 * 1024 } // 16MB limit matches WhatsApp Video Max Limit
});

// POST /api/upload
router.post('/', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Security: Block anonymous uploads
        if (!req.user || !req.user.id) {
            return res.status(401).json({ error: 'Unauthorized: User authentication required.' });
        }

        const userId = req.user.id;
        const dateStr = new Date().toISOString().split('T')[0];
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;

        let buffer = req.file.buffer;
        let mimetype = req.file.mimetype;
        let fileExt = path.extname(req.file.originalname).toLowerCase();

        // ✅ WhatsApp Safe Compression
        // WhatsApp API only accepts image/jpeg and image/png for image messages.
        // WebP is strictly for stickers. Converting to WebP will break your campaigns.
        if (mimetype.startsWith('image/') && mimetype !== 'image/gif') {
            buffer = await sharp(buffer)
                .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 80, progressive: true }) // Highly compressed JPEG
                .toBuffer();
            mimetype = 'image/jpeg';
            fileExt = '.jpg';
        }

        // path: userId/outbound/date/filename
        const fileName = `${userId}/outbound/${dateStr}/${uniqueSuffix}${fileExt}`;

        // Upload to Supabase Storage
        const { error } = await supabaseAdmin
            .storage
            .from('campaign-media')
            .upload(fileName, buffer, {
                contentType: mimetype,
                upsert: false,
                cacheControl: '31536000' // 1 Year Cache for ALL media to eliminate egress
            });

        if (error) throw error;

        // ✅ Get Public URL
        // We MUST use a public URL. If we use a 1-hour Signed URL here, 
        // scheduled campaigns will fail because the URL will expire before they run!
        const { data: publicUrlData } = supabaseAdmin
            .storage
            .from('campaign-media')
            .getPublicUrl(fileName);

        res.json({
            success: true,
            url: publicUrlData.publicUrl,
            filename: fileName,
            mimetype: mimetype,
            variable_key: req.body.variable_key,
            card_index: req.body.card_index
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
