const express = require('express');
const router = express.Router();
const { getAuthenticatedSupabase, supabaseAdmin } = require('../lib/supabaseClient');

// GET / - List all quick replies
router.get('/', async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { data, error } = await supabase
            .from('quick_replies')
            .select('*')
            .order('updated_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error fetching quick replies:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /:id - Get a single quick reply
router.get('/:id', async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { id } = req.params;
        const { data, error } = await supabase
            .from('quick_replies')
            .select('*')
            .eq('id', id)
            .single();
        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST / - Create a new quick reply
router.post('/', async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { name, nodes, edges } = req.body;

        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;

        const { data, error } = await supabase
            .from('quick_replies')
            .insert([{
                user_id: user.id,
                name: name || 'Untitled Reply',
                nodes: nodes || [],
                edges: edges || []
            }])
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (error) {
        console.error('Error creating quick reply:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /:id - Update a quick reply
router.put('/:id', async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { id } = req.params;
        const { name, nodes, edges } = req.body;

        const updates = {
            updated_at: new Date().toISOString()
        };
        if (name !== undefined) updates.name = name;
        if (nodes !== undefined) updates.nodes = nodes;
        if (edges !== undefined) updates.edges = edges;

        const { data, error } = await supabase
            .from('quick_replies')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error updating quick reply:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /:id - Delete a quick reply
router.delete('/:id', async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { id } = req.params;

        const { error } = await supabase
            .from('quick_replies')
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting quick reply:', error);
        res.status(500).json({ error: error.message });
    }
});

// Helper to build WhatsApp payload from node data (Synced with Flow Builder Executors)
function buildWhatsAppPayload(node) {
    const type = node.type;
    const d = node.data || {};
    let msgType = 'text';
    let content = {};

    console.log(`[QuickReply] Building payload for type: ${type}`);

    if (type === 'textMessage') {
        msgType = 'text';
        content = { body: d.message || '(empty)' };

    } else if (type === 'mediaMessage') {
        msgType = d.mediaType?.toLowerCase() || 'image';
        // Support both direct URL and Media ID
        if (d.url) content.link = d.url;
        if (d.mediaId) content.id = d.mediaId;
        
        if (d.caption && !['audio', 'sticker'].includes(msgType)) {
            content.caption = d.caption;
        }

    } else if (type === 'quickReplyMessage') {
        msgType = 'interactive';
        content = {
            type: 'button',
            body: { text: d.body || '(no body)' },
            action: {
                buttons: (d.buttons || []).slice(0, 3).map(btn => ({
                    type: 'reply',
                    reply: { id: btn.id, title: btn.title }
                }))
            }
        };
        if (d.footer) content.footer = { text: d.footer };
        if (d.headerType && d.headerType !== 'None') {
            const ht = d.headerType.toLowerCase();
            content.header = { type: ht };
            if (ht === 'text') {
                content.header.text = d.headerText;
            } else {
                // Support both link and ID for media headers
                const mediaUrl = d.headerUrl || d.url;
                const mediaId = d.headerId || d.mediaId;
                if (mediaUrl) content.header[ht] = { link: mediaUrl };
                if (mediaId) content.header[ht] = { id: mediaId };
            }
        }

    } else if (type === 'listMessage') {
        msgType = 'interactive';
        content = {
            type: 'list',
            body: { text: d.body || '(no body)' },
            action: {
                button: d.buttonText || 'Menu',
                sections: (d.sections || []).map(s => ({
                    title: s.title,
                    rows: (s.items || []).map(item => ({
                        id: item.id,
                        title: item.title,
                        description: item.description || ''
                    }))
                }))
            }
        };
        if (d.header) content.header = { type: 'text', text: d.header };
        if (d.footer) content.footer = { text: d.footer };

    } else if (type === 'ctaMessage') {
        msgType = 'interactive';
        content = {
            type: 'cta_url',
            body: { text: d.body || '(no body)' },
            action: { name: 'cta_url', parameters: { display_text: d.displayText, url: d.url } }
        };
        if (d.footer) content.footer = { text: d.footer };
        
        // Handle CTA Headers
        if (d.headerType && d.headerType !== 'None') {
            const ht = d.headerType.toLowerCase();
            content.header = { type: ht };
            if (ht === 'text') {
                content.header.text = d.headerText;
            } else {
                const mediaUrl = d.headerUrl || d.url;
                const mediaId = d.headerId || d.mediaId;
                if (mediaUrl) content.header[ht] = { link: mediaUrl };
                if (mediaId) content.header[ht] = { id: mediaId };
            }
        }

    } else if (type === 'sendFlow') {
        msgType = 'interactive';
        content = {
            type: 'flow',
            header: d.headerText ? { type: 'text', text: d.headerText } : undefined,
            body: { text: d.bodyText || 'Please complete this form' },
            footer: d.footerText ? { text: d.footerText } : undefined,
            action: {
                name: 'flow',
                parameters: {
                    flow_message_version: '3',
                    flow_token: `test_token_${Date.now()}`,
                    flow_id: d.flowId,
                    flow_cta: d.ctaText || 'Open Form'
                }
            }
        };

    } else if (type === 'carouselMessage') {
        msgType = 'interactive';
        const firstHeaderType = (d.cards && d.cards[0]?.headerType) || 'image';
        content = {
            type: 'carousel',
            body: { text: d.body || 'Check out these items' },
            action: {
                cards: (d.cards || []).slice(0, 10).map((card, index) => ({
                    card_index: index,
                    type: 'cta_url',
                    header: {
                        type: firstHeaderType.toLowerCase(),
                        [firstHeaderType.toLowerCase()]: { link: card.mediaUrl }
                    },
                    body: { text: card.bodyText || ' ' },
                    action: {
                        name: 'cta_url',
                        parameters: { display_text: card.buttonText, url: card.buttonUrl }
                    }
                }))
            }
        };

    } else {
        throw new Error(`Test send not supported for type: ${type}`);
    }

    return { msgType, content };
}

// POST /test-direct — Test an unsaved quick reply (direct payload)
router.post('/test-direct', async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { to, node } = req.body;
        if (!to || !node) return res.status(400).json({ error: 'Missing "to" or "node" data.' });

        console.log(`[Test-Direct] Starting test send to ${to}...`);
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        
        const whatsappService = require('../services/whatsappService');
        const { msgType, content } = buildWhatsAppPayload(node);

        const result = await whatsappService.sendMessage(
            user.id, to.replace(/\D/g, ''), msgType, content,
            null, false,
            { walletSource: msgType === 'template' ? 'INBOX_SEND' : undefined }
        );
        console.log(`[Test-Direct] Success. Meta ID: ${result?.messages?.[0]?.id}`);
        
        res.json({ success: true, sentTo: to.replace(/\D/g, ''), type: msgType });

    } catch (error) {
        console.error('Test direct error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// POST /:id/test-send — Send a quick reply to a test number (by ID)
router.post('/:id/test-send', async (req, res) => {
    try {
        const { id } = req.params;
        const { to } = req.body;
        if (!to) return res.status(400).json({ error: 'Missing "to" phone number.' });

        console.log(`[Test-Send] Starting test for saved reply ${id} to ${to}...`);
        const supabase = getAuthenticatedSupabase(req);
        
        // Fetch the reply
        const { data: reply, error } = await supabase
            .from('quick_replies')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !reply) {
            console.error(`[Test-Send] Quick reply not found: ${id}`);
            return res.status(404).json({ error: 'Quick reply not found.' });
        }

        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        
        const node = reply.nodes?.[0];
        
        if (!node) {
            console.error(`[Test-Send] Reply ${id} has no nodes!`);
            return res.status(400).json({ error: 'Quick reply has no nodes.' });
        }

        const whatsappService = require('../services/whatsappService');
        const { msgType, content } = buildWhatsAppPayload(node);

        const result = await whatsappService.sendMessage(
            user.id, to.replace(/\D/g, ''), msgType, content,
            null, false,
            { walletSource: msgType === 'template' ? 'INBOX_SEND' : undefined }
        );
        console.log(`[Test-Send] Success. Meta ID: ${result?.messages?.[0]?.id}`);

        res.json({ success: true, sentTo: to.replace(/\D/g, ''), type: msgType });

    } catch (error) {
        console.error('Test send error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
