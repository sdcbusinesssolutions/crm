const express = require('express');
const router = express.Router();
const axios = require('axios');
const multer = require('multer');
const { getAuthenticatedSupabase } = require('../lib/supabaseClient');
const requirePermission = require('../middleware/requirePermission');

const upload = multer({ storage: multer.memoryStorage() });
const GRAPH_API_URL = 'https://graph.facebook.com/v18.0';

// Helper to get WhatsApp Config
async function getWhatsAppConfig(supabase, userId) {
    const { data, error } = await supabase
        .from('whatsapp_config')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (error || !data) {
        throw new Error('WhatsApp configuration not found. Please configure your WhatsApp account in Settings.');
    }
    return data;
}

// Helper to get App ID for Resumable Upload
async function getAppId(accessToken) {
    try {
        const res = await axios.get(`${GRAPH_API_URL}/debug_token`, {
            params: { input_token: accessToken, access_token: accessToken }
        });
        return res.data.data.app_id;
    } catch (e) {
        console.error('Failed to get App ID:', e.message);
        return null;
    }
}

// Helper to upload template media
async function uploadTemplateMedia(fileBuffer, mimeType, accessToken, appId) {
    try {
        // 1. Start Upload Session
        const sessionRes = await axios.post(
            `${GRAPH_API_URL}/${appId}/uploads`,
            null,
            {
                params: {
                    file_length: fileBuffer.length,
                    file_type: mimeType
                },
                headers: { 'Authorization': `Bearer ${accessToken}` }
            }
        );
        const uploadSessionId = sessionRes.data.id;

        // 2. Upload File Content
        const handleRes = await axios.post(
            `${GRAPH_API_URL}/${uploadSessionId}`,
            fileBuffer,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'file_offset': 0,
                    'Content-Type': 'application/octet-stream'
                }
            }
        );
        return handleRes.data.h;
    } catch (e) {
        console.error('Media upload failed:', e.response?.data || e.message);
        return null;
    }
}

// GET /types - Get Template Types
router.get('/types', requirePermission('WhatsApp Templates', 'read'), (req, res) => {
    res.json([
        { id: 'TEXT', label: 'Text', icon: 'FileText' },
        { id: 'IMAGE', label: 'Image', icon: 'Image' },
        { id: 'VIDEO', label: 'Video', icon: 'Video' },
        { id: 'DOCUMENT', label: 'Document', icon: 'File' },
        { id: 'LOCATION', label: 'Location', icon: 'MapPin' }
    ]);
});

// GET /rules - Get Template Rules
router.get('/rules', requirePermission('WhatsApp Templates', 'read'), (req, res) => {
    res.json({
        header: { max_length: 60 },
        body: { max_length: 1024 },
        footer: { max_length: 60 },
        buttons: { max_buttons: 3 } // Simplified rule
    });
});

// GET /actions - Get Interactive Actions
router.get('/actions', requirePermission('WhatsApp Templates', 'read'), (req, res) => {
    res.json([
        { id: 'NONE', label: 'None' },
        { id: 'CALL_TO_ACTION', label: 'Call to Actions' },
        { id: 'QUICK_REPLY', label: 'Quick Replies' },
        { id: 'PRODUCT_CARD_CAROUSEL', label: 'Marketing Carousel' }, // Renamed for clarity
        { id: 'MEDIA_CARD_CAROUSEL', label: 'Media Carousel' },
        { id: 'ALL', label: 'All (Mixed)' },
        { id: 'FORM', label: 'Form' }
    ]);
});

// GET / - List Templates
router.get('/', requirePermission('WhatsApp Templates', 'read'), async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { data: { user } } = await supabase.auth.getUser();

        // 1. Fetch from local DB (Selective columns for the list table)
        const { data: localTemplates, error } = await supabase
            .from('whatsapp_templates')
            .select('*')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false });

        if (error) throw error;

        // 2. Sync with Meta (Smart Sync: Only if last_synced_at is > 10 mins or forced)
        const lastSyncedAt = localTemplates[0]?.last_synced_at;
        const needsSync = req.query.sync === 'true' || !lastSyncedAt || (new Date() - new Date(lastSyncedAt) > 1000);

        if (needsSync) {
            try {
                const config = await getWhatsAppConfig(supabase, user.id);
                const { whatsapp_business_account_id: wabaId, meta_access_token: accessToken } = config;

                // Fetch live templates from Meta (with pagination)
                let metaTemplates = [];
                let nextUrl = `${GRAPH_API_URL}/${wabaId}/message_templates?fields=name,language,status,id,category,components,quality_score&limit=200`;

                while (nextUrl) {
                    try {
                        const metaRes = await axios.get(nextUrl, {
                            headers: { 'Authorization': `Bearer ${accessToken}` }
                        });

                        if (metaRes.data.data) {
                            metaTemplates = metaTemplates.concat(metaRes.data.data);
                        }

                        nextUrl = metaRes.data.paging && metaRes.data.paging.next ? metaRes.data.paging.next : null;
                    } catch (err) {
                        console.error('Error fetching template page:', err.message);
                        break; // Stop fetching on error, process what we have
                    }
                }

                const updates = [];

                // Map for faster lookup
                const metaMap = new Map();
                metaTemplates.forEach(t => {
                    metaMap.set(`${t.name}_${t.language}`, t);
                });

                // 1. Update status of existing templates
                for (const local of localTemplates) {
                    const metaMatch = metaMap.get(`${local.name}_${local.language}`);

                    if (metaMatch) {
                        const updatesPayload = {};
                        if (metaMatch.status !== local.status) updatesPayload.status = metaMatch.status;
                        if (metaMatch.category !== local.category) updatesPayload.category = metaMatch.category;
                        if (metaMatch.quality_score !== local.quality_score) updatesPayload.quality_score = metaMatch.quality_score;

                        // Sync Text Components (Body, Header, Footer)
                        let metaBody = null; let metaHeader = null; let metaFooter = null;
                        (metaMatch.components || []).forEach(c => {
                            if (c.type === 'BODY') metaBody = c.text;
                            if (c.type === 'HEADER' && c.format === 'TEXT') metaHeader = c.text;
                            if (c.type === 'FOOTER') metaFooter = c.text;
                        });

                        if (metaBody !== null && metaBody !== local.body_text) updatesPayload.body_text = metaBody;
                        if (metaHeader !== null && metaHeader !== local.header_text) updatesPayload.header_text = metaHeader;
                        if (metaFooter !== null && metaFooter !== local.footer_text) updatesPayload.footer_text = metaFooter;

                        // Sync Buttons
                        let metaButtons = { type: 'NONE' };
                        (metaMatch.components || []).forEach(c => {
                            if (c.type === 'BUTTONS') {
                                const btns = c.buttons || [];
                                if (btns.length > 0) {
                                    const hasQuickReply = btns.some(b => b.type === 'QUICK_REPLY');
                                    const hasCta = btns.some(b => b.type === 'URL' || b.type === 'PHONE_NUMBER');
                                    if (hasQuickReply && hasCta) {
                                        metaButtons = { type: 'ALL', buttons: btns.map(b => ({ type: b.type, text: b.text, url: b.url, phone_number: b.phone_number })) };
                                    } else if (hasQuickReply) {
                                        metaButtons = { type: 'QUICK_REPLY', buttons: btns.map(b => ({ type: 'QUICK_REPLY', text: b.text })) };
                                    } else if (hasCta) {
                                        metaButtons = { type: 'CALL_TO_ACTION', buttons: btns.map(b => ({ type: b.type, text: b.text, url: b.url, phone_number: b.phone_number })) };
                                    } else if (btns[0].type === 'FLOW') {
                                        metaButtons = { type: 'FORM', buttons: btns.map(b => ({ type: 'FLOW', text: b.text, flow_id: b.flow_id, flow_action: b.flow_action, navigate_screen: b.navigate_screen })) };
                                    }
                                }
                            } else if (c.type === 'CAROUSEL') {
                                metaButtons = { type: 'MEDIA_CARD_CAROUSEL', cards: (c.cards || []).map(card => {
                                    let cHeader = null; let cBody = null; let cBtns = [];
                                    (card.components || []).forEach(cc => { if (cc.type==='HEADER') cHeader=cc; if (cc.type==='BODY') cBody=cc.text; if (cc.type==='BUTTONS') cBtns=cc.buttons.map(b=>({type:b.type,text:b.text,url:b.url,phone_number:b.phone_number,flow_id:b.flow_id,flow_action:b.flow_action,navigate_screen:b.navigate_screen})); });
                                    return { header: cHeader, body: cBody, buttons: cBtns };
                                })};
                            }
                        });

                        if (JSON.stringify(metaButtons) !== JSON.stringify(local.buttons)) {
                            if (metaButtons.type === 'MEDIA_CARD_CAROUSEL') {
                                metaButtons.cards = metaButtons.cards.map((metaCard, index) => {
                                    const localCard = local.buttons?.cards?.[index];
                                    if (localCard?.header?.example && metaCard.header?.format === localCard.header.format) metaCard.header.example = localCard.header.example;
                                    return metaCard;
                                });
                            }
                            updatesPayload.buttons = metaButtons;
                        }

                        if (Object.keys(updatesPayload).length > 0) {
                            updates.push(supabase.from('whatsapp_templates').update(updatesPayload).eq('id', local.id));
                            Object.assign(local, updatesPayload);
                        }
                    }
                    if (metaMatch?.components) local.components = metaMatch.components;
                }

                // 2. Insert missing templates
                const localMap = new Map();
                localTemplates.forEach(t => localMap.set(`${t.name}_${t.language}`, true));
                const newTemplates = [];
                for (const metaT of metaTemplates) {
                    if (!localMap.has(`${metaT.name}_${metaT.language}`)) {
                        let hText = null; let bText = null; let fText = null; let btns = { type: 'NONE' }; let tType = 'TEXT';
                        (metaT.components || []).forEach(c => {
                            if (c.type==='HEADER') { if (c.format==='TEXT') hText=c.text; else tType=c.format; }
                            else if (c.type==='BODY') bText=c.text;
                            else if (c.type==='FOOTER') fText=c.text;
                            else if (c.type==='CAROUSEL') { tType='CAROUSEL'; btns={type:'MEDIA_CARD_CAROUSEL', cards:(c.cards||[]).map(card=>{let ch=null;let cb=null;let cbts=[]; (card.components||[]).forEach(cc=>{if(cc.type==='HEADER')ch=cc;if(cc.type==='BODY')cb=cc.text;if(cc.type==='BUTTONS')cbts=cc.buttons.map(b=>({type:b.type,text:b.text,url:b.url,phone_number:b.phone_number}));}); return {header:ch,body:cb,buttons:cbts};})};}
                        });
                        newTemplates.push({ user_id: user.id, name: metaT.name, language: metaT.language, category: metaT.category, template_type: tType, header_text: hText, body_text: bText, footer_text: fText, buttons: btns, status: metaT.status, quality_score: metaT.quality_score, meta_template_id: metaT.id });
                    }
                }

                if (updates.length > 0) await Promise.all(updates);
                if (newTemplates.length > 0) {
                    const { data: inserted, error: insertError } = await supabase.from('whatsapp_templates').insert(newTemplates).select();
                    if (inserted) localTemplates.push(...inserted);
                }

                // Update last_synced_at timestamp for the user
                await supabase.from('whatsapp_templates').update({ last_synced_at: new Date() }).eq('user_id', user.id);
                console.log(`Smart Sync complete for user ${user.id}.`);

            } catch (syncError) {
                console.warn('Failed to sync with Meta (returning local data):', syncError.message);
            }
        }


        // Return with column definitions for dynamic table
        res.json({
            columns: [
                { key: 'name', label: 'Name' },
                { key: 'language', label: 'Language' },
                { key: 'category', label: 'Category' },
                { key: 'status', label: 'Status' },
                { key: 'quality_score', label: 'Quality' },
                { key: 'updated_at', label: 'Updated On' },
                { key: 'actions', label: 'Actions' }
            ],
            data: localTemplates
        });
    } catch (error) {
        console.error('Error fetching templates:', error);
        res.status(500).json({ error: error.message });
    }
});

const { logTemplateEvent } = require('../utils/logger');

// POST /create - Create Template
router.post('/create', requirePermission('WhatsApp Templates', 'read_write'), upload.any(), async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { data: { user } } = await supabase.auth.getUser();
        const config = await getWhatsAppConfig(supabase, user.id);
        const { whatsapp_business_account_id: wabaId, meta_access_token: accessToken } = config;

        let { name, language, category, type, header, body, footer, actions, variableSamples } = req.body;

        // Parse JSON fields from FormData
        if (typeof actions === 'string') {
            try { actions = JSON.parse(actions); } catch (e) { actions = { type: 'NONE' }; }
        }
        if (typeof variableSamples === 'string') {
            try { variableSamples = JSON.parse(variableSamples); } catch (e) { variableSamples = []; }
        }

        // Ensure variableSamples is an array
        if (!Array.isArray(variableSamples)) variableSamples = [];

        // Construct Meta Payload
        const components = [];

        // Helper block to generate Body component
        const generateBodyComponent = () => {
            const bodyComponent = { type: 'BODY', text: body };
            const paramFormat = req.body.parameter_format || 'positional';

            if (paramFormat === 'named') {
                // Named Parameters Logic
                let namedSamples = [];
                if (Array.isArray(variableSamples)) {
                    namedSamples = variableSamples.filter(s => typeof s === 'object' && s.param_name && s.example);
                }
                if (namedSamples.length > 0) {
                    bodyComponent.example = { body_text_named_params: namedSamples };
                }
            } else {
                // Positional Parameters Logic
                const bodyVars = body.match(/{{(\d+)}}/g);
                if (bodyVars && bodyVars.length > 0) {
                    const requiredCount = bodyVars.length;
                    let positionalSamples = Array.isArray(variableSamples)
                        ? variableSamples.filter(s => typeof s === 'string' || typeof s === 'number')
                        : [];
                    while (positionalSamples.length < requiredCount) {
                        positionalSamples.push('sample');
                    }
                    positionalSamples = positionalSamples.map(x => (!x || x.toString().trim() === '') ? 'sample' : x);
                    bodyComponent.example = { body_text: [positionalSamples] };
                }
            }
            return bodyComponent;
        };

        // Determine App ID (Prioritize DB config, fallback to API)
        let appId = config.meta_app_id;
        if (!appId) {
            appId = await getAppId(accessToken);
        }

        if (actions && actions.type === 'MEDIA_CARD_CAROUSEL') {
            // --- CAROUSEL TEMPLATE LOGIC ---

            // 1. ADD BODY (Required for Carousel)
            if (body) {
                components.push(generateBodyComponent());
            }

            // 2. ADD CAROUSEL CARDS
            const cards = actions.cards || [];
            if (cards.length < 2 || cards.length > 10) {
                throw new Error('Carousel must have between 2 and 10 cards.');
            }

            const carouselCards = [];

            if (!appId) throw new Error('Could not determine App ID for media upload. Please ensure your WhatsApp Config has a "Meta App ID".');

            for (let i = 0; i < cards.length; i++) {
                const card = cards[i];
                const cardComponents = [];

                // A. Card HEADER (Media)
                // In frontend, cards have headerFile. fieldname is 'card_{index}_headerFile'
                const fileKey = `card_${i}_headerFile`;
                const mediaFile = req.files.find(f => f.fieldname === fileKey);

                // Assuming all cards in a Media Carousel MUST have a header image/video
                // The Type defaults to IMAGE in builder, but let's check
                const cardHeaderType = card.header?.type || 'IMAGE'; // Default to IMAGE

                if (mediaFile) {
                    let uploadMimeType = mediaFile.mimetype;
                    if (cardHeaderType === 'VIDEO') uploadMimeType = 'video/mp4';
                    else if (cardHeaderType === 'IMAGE' && !['image/jpeg', 'image/png'].includes(uploadMimeType)) uploadMimeType = 'image/jpeg';

                    try {
                        const handle = await uploadTemplateMedia(mediaFile.buffer, uploadMimeType, accessToken, appId);
                        if (!handle) throw new Error('Failed to get media handle');

                        cardComponents.push({
                            type: 'HEADER',
                            format: cardHeaderType,
                            example: { header_handle: [handle] }
                        });
                    } catch (e) {
                        throw new Error(`Failed to upload media for card ${i + 1}: ${e.message}`);
                    }
                } else {
                    throw new Error(`Missing media file for Card ${i + 1}`);
                }

                // B. Card BODY (Optional)
                if (card.body) {
                    cardComponents.push({ type: 'BODY', text: card.body });
                }

                // C. Card BUTTONS
                if (card.buttons && card.buttons.length > 0) {
                    const mappedButtons = card.buttons.map(b => {
                        if (b.type === 'QUICK_REPLY') return { type: 'QUICK_REPLY', text: b.text };
                        if (b.type === 'URL') return { type: 'URL', text: b.text, url: b.url };
                        if (b.type === 'PHONE_NUMBER') return { type: 'PHONE_NUMBER', text: b.text, phone_number: b.phone_number };
                        return null; // Should not happen
                    }).filter(Boolean);

                    if (mappedButtons.length > 0) {
                        cardComponents.push({
                            type: 'BUTTONS',
                            buttons: mappedButtons
                        });
                    }
                }

                carouselCards.push({ components: cardComponents });
            }

            components.push({
                type: 'CAROUSEL',
                cards: carouselCards
            });

        } else {
            // --- STANDARD TEMPLATE LOGIC ---

            // 1. HEADER COMPONENT
            const isMediaTemplate = ['IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION'].includes(type);

            if (header || isMediaTemplate) {
                if (type === 'TEXT') {
                    // Text Header
                    const headerComponent = { type: 'HEADER', format: 'TEXT', text: header };
                    // Handle Header Variables
                    const headerVars = header ? header.match(/{{(\d+)}}/g) : null;
                    if (headerVars && headerVars.length > 0) {
                        headerComponent.example = {
                            header_text: headerVars.map(() => 'sample')
                        };
                    }
                    components.push(headerComponent);
                } else if (type === 'LOCATION') {
                    components.push({ type: 'HEADER', format: 'LOCATION' });
                } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(type)) {
                    // Media Header
                    const headerComponent = { type: 'HEADER', format: type };
                    // Check for file (Standard single file)
                    // If req.files has items, find one that is NOT a card file? Or just take first if not carousel?
                    // In standard mode, we likely just appended 'headerFile' or similar, but verify TemplateBuilder using 'headerFile'
                    const mediaFile = req.files.find(f => f.fieldname === 'headerFile');

                    if (mediaFile) {
                        try {
                            let uploadMimeType = mediaFile.mimetype;
                            if (type === 'VIDEO') uploadMimeType = 'video/mp4';
                            else if (type === 'IMAGE' && !['image/jpeg', 'image/png'].includes(uploadMimeType)) uploadMimeType = 'image/jpeg';
                            else if (type === 'DOCUMENT') uploadMimeType = 'application/pdf';

                            if (appId) {
                                const handle = await uploadTemplateMedia(mediaFile.buffer, uploadMimeType, accessToken, appId);
                                if (handle) {
                                    headerComponent.example = { header_handle: [handle] };
                                } else {
                                    throw new Error('Failed to retrieve media handle from Meta.');
                                }
                            } else {
                                throw new Error('Could not determine App ID for media upload. Please ensure your WhatsApp Config has a "Meta App ID".');
                            }
                        } catch (uploadError) {
                            return res.status(400).json({ error: `Media upload failed: ${uploadError.message}` });
                        }
                    } else {
                        return res.status(400).json({ error: `${type} templates require a sample file to be uploaded.` });
                    }
                    components.push(headerComponent);
                }
            }

            // 2. BODY COMPONENT
            if (body) {
                components.push(generateBodyComponent());
            }

            // 3. FOOTER COMPONENT
            if (footer) {
                components.push({ type: 'FOOTER', text: footer });
            }

            // 4. BUTTONS COMPONENT
            if (actions && actions.type !== 'NONE') {
                if (actions.type === 'QUICK_REPLY' && actions.buttons) {
                    components.push({
                        type: 'BUTTONS',
                        buttons: actions.buttons.map(b => ({ type: 'QUICK_REPLY', text: b.text }))
                    });
                } else if (actions.type === 'CALL_TO_ACTION' && actions.buttons) {
                    components.push({
                        type: 'BUTTONS',
                        buttons: actions.buttons.map(b => ({
                            type: b.type,
                            text: b.text,
                            url: b.url,
                            phone_number: b.phone_number
                        }))
                    });
                } else if (actions.type === 'FORM' && actions.buttons && actions.buttons.length > 0) {
                    const flowButton = actions.buttons[0];
                    if (flowButton && flowButton.flow_id) {
                        components.push({
                            type: 'BUTTONS',
                            buttons: [{
                                type: 'FLOW',
                                text: flowButton.text || 'Fill Form',
                                flow_id: flowButton.flow_id,
                                flow_action: 'navigate',
                                navigate_screen: flowButton.navigate_screen || 'screen_start'
                            }]
                        });
                    }
                } else if (actions.type === 'ALL' && actions.buttons) {
                    components.push({
                        type: 'BUTTONS',
                        buttons: actions.buttons.map(b => {
                            if (b.type === 'QUICK_REPLY') return { type: 'QUICK_REPLY', text: b.text };
                            if (b.type === 'URL') return { type: 'URL', text: b.text, url: b.url };
                            if (b.type === 'PHONE_NUMBER') return { type: 'PHONE_NUMBER', text: b.text, phone_number: b.phone_number };
                            return null;
                        }).filter(Boolean)
                    });
                }
            }
        }

        const payload = {
            name,
            language,
            category,
            components
        };

        // Send to Meta
        const logData = { name, language, category, payload };
        console.log('Sending template to Meta:', JSON.stringify(payload, null, 2));

        // Log to File
        try {
            logTemplateEvent('CREATE_TEMPLATE', logData);
        } catch (ignore) { }

        let metaResponse;
        try {
            metaResponse = await axios.post(
                `${GRAPH_API_URL}/${wabaId}/message_templates`,
                payload,
                { headers: { 'Authorization': `Bearer ${accessToken}` } }
            );
            console.log('[Meta Response] Template Created Success:', JSON.stringify(metaResponse.data, null, 2));
        } catch (metaError) {
            console.error('[Meta Response] Template Creation Failed:', metaError.response?.data || metaError.message);
            const metaErrorMsg = metaError.response?.data?.error?.message || metaError.message;
            const metaErrorUserMsg = metaError.response?.data?.error?.error_user_msg;

            // Provide helpful feedback for common errors
            if (metaErrorMsg.includes('words ratio exceeds limit') || (metaErrorUserMsg && metaErrorUserMsg.includes('ratio'))) {
                throw new Error("Meta Policy: The template has too many variables relative to the text length. Please add more text to your message body.");
            }

            throw new Error(metaErrorUserMsg || metaErrorMsg);
        }

        const metaTemplateId = metaResponse.data.id;

        // Save to DB
        const { data: savedTemplate, error: dbError } = await supabase
            .from('whatsapp_templates')
            .insert({
                user_id: user.id,
                name,
                language,
                category,
                template_type: type,
                header_text: header,
                body_text: body,
                footer_text: footer,
                buttons: actions,
                status: 'PENDING',
                meta_template_id: metaTemplateId
            })
            .select()
            .single();

        if (dbError) throw dbError;

        res.json(savedTemplate);

    } catch (error) {
        console.error('Error creating template:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// POST /preview - Generate Preview (Mock or Real)
router.post('/preview', requirePermission('WhatsApp Templates', 'read'), (req, res) => {
    // Just return what's needed for the frontend to render. 
    // The frontend handles the actual visual rendering.
    res.json({
        preview_html: `<div class="preview">...</div>`,
        data: req.body
    });
});

// GET /:id - Get Template Details
router.get('/:id', requirePermission('WhatsApp Templates', 'read'), async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { id } = req.params;

        // 1. Fetch from Local DB
        const { data, error } = await supabase
            .from('whatsapp_templates')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Template not found' });

        // 2. Fetch Latest from Meta to get 'components' (Crucial for Edit Mode)
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const config = await getWhatsAppConfig(supabase, user.id);
            const { meta_access_token: accessToken } = config;

            // Use meta_template_id if available, otherwise search by name isn't ideal for single ID view without WABA ID context easily available (though we have it in config).
            // Usually meta_template_id is reliable if created via API.
            if (data.meta_template_id) {
                const metaRes = await axios.get(`${GRAPH_API_URL}/${data.meta_template_id}`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });

                if (metaRes.data && metaRes.data.components) {
                    data.components = metaRes.data.components;
                    console.log(`[GET /:id] Attached live components from Meta for template: ${data.name}`);
                }
            } else {
                // Fallback: If no ID, maybe search by name? (Optional, skipping for now to avoid complexity)
                console.warn(`[GET /:id] No meta_template_id for template ${data.name}, skipping Meta fetch.`);
            }

        } catch (metaError) {
            console.warn('[GET /:id] Failed to fetch live data from Meta:', metaError.message);
            // Non-blocking: return local data
        }

        res.json(data);
    } catch (error) {
        console.error('Error fetching template:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /:id - Update Template
router.put('/:id', requirePermission('WhatsApp Templates', 'read_write'), upload.any(), async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { data: { user } } = await supabase.auth.getUser();
        const config = await getWhatsAppConfig(supabase, user.id);
        const { whatsapp_business_account_id: wabaId, meta_access_token: accessToken } = config;
        const { id } = req.params;

        let { category, header, body, footer, actions, type, variableSamples } = req.body;

        // Parse JSON fields from FormData (Important because FormData converts to strings)
        if (typeof actions === 'string') {
            try { actions = JSON.parse(actions); } catch (e) { actions = { type: 'NONE' }; }
        }
        if (typeof variableSamples === 'string') {
            try { variableSamples = JSON.parse(variableSamples); } catch (e) { variableSamples = []; }
        }

        // Fetch existing to get Meta ID
        const { data: existing, error: fetchError } = await supabase
            .from('whatsapp_templates')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !existing) return res.status(404).json({ error: 'Template not found' });

        // Construct Meta Payload
        const components = [];

        // Helper block to generate Body component (Reused logic)
        const generateBodyComponent = () => {
            const bodyComponent = { type: 'BODY', text: body };
            const paramFormat = req.body.parameter_format || 'positional';

            if (paramFormat === 'named') {
                let namedSamples = [];
                if (Array.isArray(variableSamples)) {
                    namedSamples = variableSamples.filter(s => typeof s === 'object' && s.param_name && s.example);
                }
                if (namedSamples.length > 0) {
                    bodyComponent.example = { body_text_named_params: namedSamples };
                }
            } else {
                const bodyVars = body.match(/{{(\d+)}}/g);
                if (bodyVars && bodyVars.length > 0) {
                    const requiredCount = bodyVars.length;
                    let positionalSamples = Array.isArray(variableSamples)
                        ? variableSamples.filter(s => typeof s === 'string' || typeof s === 'number')
                        : [];
                    while (positionalSamples.length < requiredCount) {
                        positionalSamples.push('sample');
                    }
                    positionalSamples = positionalSamples.map(x => (!x || x.toString().trim() === '') ? 'sample' : x);
                    bodyComponent.example = { body_text: [positionalSamples] };
                }
            }
            return bodyComponent;
        };

        if (actions && actions.type === 'MEDIA_CARD_CAROUSEL') {
            // --- CAROUSEL UPDATE LOGIC ---
            if (body) {
                components.push(generateBodyComponent());
            }

            const cards = actions.cards || [];
            // For carousel updates, we need to handle media uploads again if they changed, 
            // OR reuse existing handles if not provided. 
            // BUT, for simplicity in this context, we assume the user is just updating text/buttons usually.
            // If they upload NEW media, we handle it.

            // NOTE: Meta API Update for Carousel: We must provide the FULL structure.

            const carouselCards = [];
            const appId = await getAppId(accessToken);

            for (let i = 0; i < cards.length; i++) {
                const card = cards[i];
                const cardComponents = [];

                // 1. Header (Media)
                const fileKey = `card_${i}_headerFile`;
                const mediaFile = req.files.find(f => f.fieldname === fileKey);
                const cardHeaderType = card.header?.type || 'IMAGE';

                if (mediaFile && appId) {
                    // Upload NEW file
                    let uploadMimeType = mediaFile.mimetype;
                    if (cardHeaderType === 'VIDEO') uploadMimeType = 'video/mp4';
                    else if (cardHeaderType === 'IMAGE' && !['image/jpeg', 'image/png'].includes(uploadMimeType)) uploadMimeType = 'image/jpeg';

                    const handle = await uploadTemplateMedia(mediaFile.buffer, uploadMimeType, accessToken, appId);
                    if (handle) {
                        cardComponents.push({ type: 'HEADER', format: cardHeaderType, example: { header_handle: [handle] } });
                    }
                } else {
                    // If no new file, we can't really "keep" the old handle easily without knowing what it was.
                    // Meta doesn't return handles in GET.
                    // HOWEVER, if we are just updating TEXT, we might be able to omit the example? 
                    // NO, Meta requires examples for media headers always.
                    // IMPORTANT: If user didn't upload a new file, we ideally shouldn't be here unless we stored the handle (which we don't).
                    // FOR NOW: If no file is uploaded, we might fail or send without example if allowed (often not).
                    // Let's assume for updates, if they don't upload a file, we send the header format BUT maybe we can't send example?
                    // Meta error: "Image/Video templates must include a media sample."

                    // Fallback: If no new file, check if we can reuse the existing structure? 
                    // We don't have the existing structure's handle.
                    // For now, we will add the Header component. If it fails due to missing example, user must re-upload.
                    cardComponents.push({ type: 'HEADER', format: cardHeaderType });
                }

                if (card.body) cardComponents.push({ type: 'BODY', text: card.body });

                if (card.buttons && card.buttons.length > 0) {
                    const mappedButtons = card.buttons.map(b => {
                        if (b.type === 'QUICK_REPLY') return { type: 'QUICK_REPLY', text: b.text };
                        if (b.type === 'URL') return { type: 'URL', text: b.text, url: b.url };
                        if (b.type === 'PHONE_NUMBER') return { type: 'PHONE_NUMBER', text: b.text, phone_number: b.phone_number };
                        return null;
                    }).filter(Boolean);
                    if (mappedButtons.length > 0) cardComponents.push({ type: 'BUTTONS', buttons: mappedButtons });
                }
                carouselCards.push({ components: cardComponents });
            }
            components.push({ type: 'CAROUSEL', cards: carouselCards });

        } else {
            // --- STANDARD UPDATE LOGIC ---
            if (header) {
                if (type === 'TEXT') {
                    const headerComponent = { type: 'HEADER', format: 'TEXT', text: header };
                    const headerVars = header ? header.match(/{{(\d+)}}/g) : null;
                    if (headerVars && headerVars.length > 0) {
                        headerComponent.example = { header_text: headerVars.map(() => 'sample') };
                    }
                    components.push(headerComponent);
                } else if (['IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION'].includes(type)) {
                    const headerComponent = { type: 'HEADER', format: type };
                    // Handle New File Upload
                    const mediaFile = req.files.find(f => f.fieldname === 'headerFile');
                    if (mediaFile) {
                        const appId = await getAppId(accessToken);
                        if (appId) {
                            let uploadMimeType = mediaFile.mimetype;
                            if (type === 'VIDEO') uploadMimeType = 'video/mp4';
                            else if (type === 'IMAGE' && !['image/jpeg', 'image/png'].includes(uploadMimeType)) uploadMimeType = 'image/jpeg';
                            else if (type === 'DOCUMENT') uploadMimeType = 'application/pdf';

                            const handle = await uploadTemplateMedia(mediaFile.buffer, uploadMimeType, accessToken, appId);
                            if (handle) headerComponent.example = { header_handle: [handle] };
                        }
                    }
                    components.push(headerComponent);
                }
            }

            if (body) {
                components.push(generateBodyComponent());
            }
            if (footer) components.push({ type: 'FOOTER', text: footer });

            if (actions && actions.type !== 'NONE') {
                if (actions.type === 'QUICK_REPLY' && actions.buttons) {
                    components.push({ type: 'BUTTONS', buttons: actions.buttons.map(b => ({ type: 'QUICK_REPLY', text: b.text })) });
                } else if (actions.type === 'CALL_TO_ACTION' && actions.buttons) {
                    components.push({ type: 'BUTTONS', buttons: actions.buttons.map(b => ({ type: b.type, text: b.text, url: b.url, phone_number: b.phone_number })) });
                } else if (actions.type === 'FORM' && actions.buttons && actions.buttons.length > 0) {
                    const flowButton = actions.buttons[0];
                    if (flowButton && flowButton.flow_id) {
                        components.push({
                            type: 'BUTTONS',
                            buttons: [{
                                type: 'FLOW',
                                text: flowButton.text || 'Fill Form',
                                flow_id: flowButton.flow_id,
                                flow_action: 'navigate',
                                navigate_screen: flowButton.navigate_screen || 'screen_start'
                            }]
                        });
                    }
                } else if (actions.type === 'ALL' && actions.buttons) {
                    components.push({
                        type: 'BUTTONS',
                        buttons: actions.buttons.map(b => {
                            if (b.type === 'QUICK_REPLY') return { type: 'QUICK_REPLY', text: b.text };
                            if (b.type === 'URL') return { type: 'URL', text: b.text, url: b.url };
                            if (b.type === 'PHONE_NUMBER') return { type: 'PHONE_NUMBER', text: b.text, phone_number: b.phone_number };
                            return null;
                        }).filter(Boolean)
                    });
                }
            }
        }

        // Send to Meta
        const logData = { id, category, payload: { components } };
        console.log('Updating template in Meta:', JSON.stringify({ category, components }, null, 2));
        try {
            logTemplateEvent('UPDATE_TEMPLATE', logData);
        } catch (ignore) { }

        try {
            await axios.post(`${GRAPH_API_URL}/${existing.meta_template_id}`, {
                category,
                components
            }, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            console.log('[Meta Response] Template Update Success');
        } catch (metaError) {
            console.error('Meta update failed:', metaError.response?.data || metaError.message);
            const metaErrorMsg = metaError.response?.data?.error?.message || metaError.message;
            const metaErrorUserMsg = metaError.response?.data?.error?.error_user_msg;
            throw new Error(metaErrorUserMsg || metaErrorMsg);
        }

        // Update DB
        const { data: updated, error: dbError } = await supabase
            .from('whatsapp_templates')
            .update({
                category,
                header_text: header,
                body_text: body,
                footer_text: footer,
                buttons: actions,
                status: 'PENDING' // Resets to pending on edit
            })
            .eq('id', id)
            .select()
            .single();

        if (dbError) throw dbError;

        res.json(updated);

    } catch (error) {
        console.error('Error updating template:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /:id - Delete Template
router.delete('/:id', requirePermission('WhatsApp Templates', 'all_access'), async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { data: { user } } = await supabase.auth.getUser();
        const config = await getWhatsAppConfig(supabase, user.id);
        const { whatsapp_business_account_id: wabaId, meta_access_token: accessToken } = config;
        const { id } = req.params;

        // Log Removal Intent
        try {
            logTemplateEvent('DELETE_TEMPLATE', { id });
        } catch (e) { }

        // Get template from DB to get name (Meta deletes by name or ID+Name)
        const { data: template, error: fetchError } = await supabase
            .from('whatsapp_templates')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !template) return res.status(404).json({ error: 'Template not found' });

        // Delete from Meta
        // Meta API: DELETE /<WABA_ID>/message_templates?name=<NAME>
        // Or DELETE /<WABA_ID>/message_templates?hsm_id=<ID>&name=<NAME>
        try {
            await axios.delete(`${GRAPH_API_URL}/${wabaId}/message_templates`, {
                params: { name: template.name }, // Deleting by name is the standard way
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
        } catch (metaError) {
            console.warn('Meta delete failed (might already be deleted):', metaError.response?.data || metaError.message);
        }

        // Delete from DB
        const { error: deleteError } = await supabase
            .from('whatsapp_templates')
            .delete()
            .eq('id', id);

        if (deleteError) throw deleteError;

        res.json({ success: true });

    } catch (error) {
        console.error('Error deleting template:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /:id/duplicate - Duplicate Template
router.post('/:id/duplicate', requirePermission('WhatsApp Templates', 'read_write'), async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { data: { user } } = await supabase.auth.getUser();
        const config = await getWhatsAppConfig(supabase, user.id);
        const { whatsapp_business_account_id: wabaId, meta_access_token: accessToken } = config;
        const { id } = req.params;

        // 1. Fetch existing template
        const { data: original, error: fetchError } = await supabase
            .from('whatsapp_templates')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !original) return res.status(404).json({ error: 'Template not found' });

        const newName = `${original.name}_copy_${Date.now().toString().slice(-4)}`; // Ensure uniqueness

        // 2. Construct Meta Payload
        const components = [];
        if (original.header_text) {
            if (original.template_type === 'TEXT') {
                components.push({ type: 'HEADER', format: 'TEXT', text: original.header_text });
            } else if (['IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION'].includes(original.template_type)) {
                components.push({ type: 'HEADER', format: original.template_type });
            }
        }
        if (original.body_text) components.push({ type: 'BODY', text: original.body_text });
        if (original.footer_text) components.push({ type: 'FOOTER', text: original.footer_text });

        const actions = original.buttons;
        if (actions && actions.type !== 'NONE') {
            if (actions.type === 'QUICK_REPLY' && actions.buttons) {
                components.push({ type: 'BUTTONS', buttons: actions.buttons.map(b => ({ type: 'QUICK_REPLY', text: b.text })) });
            } else if (actions.type === 'CALL_TO_ACTION' && actions.buttons) {
                components.push({ type: 'BUTTONS', buttons: actions.buttons.map(b => ({ type: b.type, text: b.text, url: b.url, phone_number: b.phone_number })) });
            } else if (actions.type === 'ALL' && actions.buttons) {
                components.push({
                    type: 'BUTTONS',
                    buttons: actions.buttons.map(b => {
                        if (b.type === 'QUICK_REPLY') return { type: 'QUICK_REPLY', text: b.text };
                        if (b.type === 'URL') return { type: 'URL', text: b.text, url: b.url };
                        if (b.type === 'PHONE_NUMBER') return { type: 'PHONE_NUMBER', text: b.text, phone_number: b.phone_number };
                        return null;
                    }).filter(Boolean)
                });
            }
        }

        const payload = {
            name: newName,
            language: original.language,
            category: original.category,
            components
        };

        // 3. Send to Meta
        console.log('Duplicating template to Meta:', JSON.stringify(payload, null, 2));
        try {
            logTemplateEvent('DUPLICATE_TEMPLATE', { originalId: id, newName, payload });
        } catch (e) { }

        let metaResponse;
        try {
            metaResponse = await axios.post(
                `${GRAPH_API_URL}/${wabaId}/message_templates`,
                payload,
                { headers: { 'Authorization': `Bearer ${accessToken}` } }
            );
        } catch (metaError) {
            console.error('Meta duplicate failed:', metaError.response?.data || metaError.message);
            throw new Error(metaError.response?.data?.error?.message || 'Failed to duplicate template in Meta');
        }

        // 4. Save to DB
        const { data: savedTemplate, error: dbError } = await supabase
            .from('whatsapp_templates')
            .insert({
                user_id: user.id,
                name: newName,
                language: original.language,
                category: original.category,
                template_type: original.template_type,
                header_text: original.header_text,
                body_text: original.body_text,
                footer_text: original.footer_text,
                buttons: original.buttons,
                status: 'PENDING',
                meta_template_id: metaResponse.data.id
            })
            .select()
            .single();

        if (dbError) throw dbError;

        res.json(savedTemplate);

    } catch (error) {
        console.error('Error duplicating template:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
