const express = require('express');
const router = express.Router();
const axios = require('axios');
const { supabaseAdmin } = require('../../lib/supabaseClient');
const NodeCache = require('node-cache');
const docCache = new NodeCache({ stdTTL: 3600 }); // Cache documents for 1 hour

// 1. Create Agent
router.post('/', async (req, res) => {
    try {
        const { name, description, system_prompt, model_config, type } = req.body;
        const user_id = req.user.id; // From requireAuth middleware

        if (!name || !system_prompt) {
            return res.status(400).json({ error: 'Name and System Prompt are required' });
        }

        const { data, error } = await supabaseAdmin
            .from('ai_agents')
            .insert({
                user_id,
                name,
                description,
                system_prompt,
                model_config: model_config || { provider: 'openai', model: 'gpt-4o' },
                type: type || 'chat',
                is_active: true
            })
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Create Agent Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 2. List Agents
router.get('/', async (req, res) => {
    try {
        const user_id = req.user.id;
        const { data, error } = await supabaseAdmin
            .from('ai_agents')
            .select('*')
            .eq('user_id', user_id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('List Agents Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 3. Get Agent
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const user_id = req.user.id;

        const { data, error } = await supabaseAdmin
            .from('ai_agents')
            .select('*')
            .eq('id', id)
            .eq('user_id', user_id)
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4. Update Agent
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const user_id = req.user.id;
        const updates = req.body;

        const { data, error } = await supabaseAdmin
            .from('ai_agents')
            .update(updates)
            .eq('id', id)
            .eq('user_id', user_id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 5. Delete Agent
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const user_id = req.user.id;

        const { error } = await supabaseAdmin
            .from('ai_agents')
            .delete()
            .eq('id', id)
            .eq('user_id', user_id);

        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// 6. Chat with Agent (Testing Playground)
router.post('/:id/chat', async (req, res) => {
    try {
        const { id } = req.params;
        const user_id = req.user.id;
        const { message, history = [] } = req.body;

        // 1. Fetch Agent Config
        const { data: agent, error } = await supabaseAdmin
            .from('ai_agents')
            .select('*')
            .eq('id', id)
            .eq('user_id', user_id)
            .single();

        if (error || !agent) {
            return res.status(404).json({ error: 'Agent not found' });
        }

        const AgentChatService = require('../../services/AgentChatService');
        const options = {
            reqOrigin: req.headers.origin,
            reqHost: req.headers.host
        };

        const result = await AgentChatService.processChat(agent, message, history, options);
        
        res.json({ reply: result.reply });

    } catch (error) {
        console.error('Chat API Error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
