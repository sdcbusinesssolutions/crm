const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../../lib/supabaseClient');

// Using 'user_integrations' table (provider='openai') to align with SMTP pattern.
// Credentials stored in JSONB: { apiKey: '...' }

// Get Config (Single - Legacy)
router.get('/config', async (req, res) => {
    try {
        const userId = req.user.id;

        // Find existing OpenAI connection
        const { data, error } = await supabaseAdmin
            .from('user_integrations')
            .select('*')
            .eq('user_id', userId)
            .eq('provider', 'openai')
            .limit(1)
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

// LIST ALL OpenAI Connections
router.get('/list', async (req, res) => {
    try {
        const userId = req.user.id;
        const { data, error } = await supabaseAdmin
            .from('user_integrations')
            .select('id, connection_name, created_at, credentials')
            .eq('user_id', userId)
            .eq('provider', 'openai');

        if (error) throw error;

        // Mask keys
        const cleanList = (data || []).map(item => ({
            id: item.id,
            name: item.connection_name || 'OpenAI Key',
            created_at: item.created_at,
            maskedKey: item.credentials?.apiKey ? `...${item.credentials.apiKey.slice(-4)}` : 'Missing'
        }));

        res.json(cleanList);
    } catch (error) {
        console.error('List OpenAI Config Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Save Config
router.post('/config', async (req, res) => {
    try {
        const userId = req.user.id;
        const { apiKey, apiName } = req.body;

        console.log(`[OpenAI Config] Saving for User: ${userId} | Name: ${apiName}`);

        if (!apiKey) return res.status(400).json({ error: 'API Key is required' });

        // 1. Fetch ALL existing keys for this user
        const { data: existingRows, error: fetchErr } = await supabaseAdmin
            .from('user_integrations')
            .select('id, connection_name')
            .eq('user_id', userId)
            .eq('provider', 'openai');

        if (fetchErr) {
            console.error('[OpenAI Config] Fetch Error:', fetchErr);
            throw fetchErr;
        }

        const nameToUse = apiName || 'OpenAI Personal Key';
        let resultError = null;

        if (existingRows && existingRows.length > 0) {
            const targetId = existingRows[0].id;

            // Optimization: unexpected duplicates validation
            const conflict = existingRows.find(r => r.connection_name === nameToUse && r.id !== targetId);
            if (conflict) {
                return res.status(400).json({ error: `Connection name "${nameToUse}" is already in use.` });
            }

            console.log(`[OpenAI Config] Updating existing key: ${targetId}`);

            const { error } = await supabaseAdmin
                .from('user_integrations')
                .update({
                    credentials: { apiKey },
                    connection_name: nameToUse,
                    updated_at: new Date()
                })
                .eq('id', targetId);
            resultError = error;
        } else {
            // INSERT new
            console.log(`[OpenAI Config] Inserting new key`);
            const { error } = await supabaseAdmin
                .from('user_integrations')
                .insert({
                    user_id: userId,
                    provider: 'openai',
                    connection_name: nameToUse,
                    credentials: { apiKey },
                    metadata: { type: 'ai' }
                });
            resultError = error;
        }

        if (resultError) {
            console.error('[OpenAI Config] DB Write Error:', resultError);
            throw resultError;
        }

        res.json({ success: true });

    } catch (error) {
        console.error('Save OpenAI Config Error:', error);
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Connection name already exists. Please pick a different name.' });
        }
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
