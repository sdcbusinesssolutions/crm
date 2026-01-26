const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../../lib/supabaseClient');

// Using 'user_integrations' table (provider='openai') to align with SMTP pattern.
// Credentials stored in JSONB: { apiKey: '...' }

// Get Config (Status)
router.get('/config', async (req, res) => {
    try {
        const userId = req.user.id;

        // Find existing OpenAI connection
        const { data, error } = await supabaseAdmin
            .from('user_integrations')
            .select('*')
            .eq('user_id', userId)
            .eq('provider', 'openai')
            .single();

        if (error && error.code !== 'PGRST116') throw error;

        // Return Masked Key if exists
        if (data && data.credentials && data.credentials.apiKey) {
            return res.json({
                apiKey: data.credentials.apiKey // Frontend will mask this
            });
        }
        res.json({ apiKey: null });

    } catch (error) {
        console.error('Get OpenAI Config Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Save Config
router.post('/config', async (req, res) => {
    try {
        const userId = req.user.id;
        const { apiKey } = req.body;

        if (!apiKey) return res.status(400).json({ error: 'API Key is required' });
        // NOTE: In production, encrypt this key before storage!

        // Upsert logic: 'user_integrations' usually has ID. 
        // We want 1 OpenAI key per user essentially (or list).
        // Let's check if one exists.
        const { data: existing } = await supabaseAdmin
            .from('user_integrations')
            .select('id')
            .eq('user_id', userId)
            .eq('provider', 'openai')
            .single();

        let error;
        if (existing) {
            // Update
            ({ error } = await supabaseAdmin
                .from('user_integrations')
                .update({
                    credentials: { apiKey },
                    connection_name: 'OpenAI Personal Key',
                    updated_at: new Date()
                })
                .eq('id', existing.id));
        } else {
            // Insert
            ({ error } = await supabaseAdmin
                .from('user_integrations')
                .insert({
                    user_id: userId,
                    provider: 'openai',
                    connection_name: 'OpenAI Personal Key',
                    credentials: { apiKey },
                    metadata: { type: 'ai' }
                }));
        }

        if (error) throw error;
        res.json({ success: true });

    } catch (error) {
        console.error('Save OpenAI Config Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete Config
router.delete('/config', async (req, res) => {
    try {
        const userId = req.user.id;
        const { error } = await supabaseAdmin
            .from('user_integrations')
            .delete()
            .eq('user_id', userId)
            .eq('provider', 'openai');

        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        console.error('Delete OpenAI Config Error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
