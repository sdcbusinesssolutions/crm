const express = require('express');
const router = express.Router();
const axios = require('axios');
const requireAuth = require('../middleware/requireAuth');
const whatsappService = require('../services/whatsappService');
const { supabase } = require('../lib/supabaseClient');

/**
 * @route POST /api/external/send-template
 * @desc Send a WhatsApp Template Message (Robust)
 */
router.post('/send-template', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        let { to, templateName, language, components, phoneNumberId } = req.body;

        // Support Wrapper Structure
        if (req.body.template && req.body.template.name) {
            templateName = req.body.template.name;
            language = req.body.template.language?.code || language;
            components = req.body.template.components || components;
        }

        if (!to || !templateName || !language) {
            return res.status(400).json({ error: 'Missing [to, templateName, language]' });
        }

        // 1. Get Config (WABA ID is needed for template lookup)
        const config = await whatsappService.getConfig(userId, phoneNumberId);
        const wabaId = config.whatsapp_business_account_id;
        const accessToken = config.meta_access_token;

        // 2. Fetch REAL Template Definition from Meta (Source of Truth) to Start with
        let metaComponents = [];
        try {
            if (wabaId) {
                const tmplRes = await axios.get(
                    `https://graph.facebook.com/v18.0/${wabaId}/message_templates`,
                    {
                        params: { name: templateName, limit: 3 }, // Fetch a few to filter by language
                        headers: { 'Authorization': `Bearer ${accessToken}` }
                    }
                );
                const tmplDef = tmplRes.data?.data?.find(t => t.name === templateName && t.language === language);
                if (tmplDef && tmplDef.components) {
                    metaComponents = tmplDef.components;
                    console.log(`[ExtAPI] Fetched Meta Definition for ${templateName}`);
                }
            }
        } catch (fetchErr) {
            console.warn(`[ExtAPI] Failed to fetch template definition: ${fetchErr.message}`);
        }

        // 3. Construct/Patch Payload Components
        // We will build a NEW components array based on Meta's definition to ensure structure validity.
        const finalComponents = [];

        // --- HEADER ---
        const metaHeader = metaComponents.find(c => c.type === 'HEADER');
        const userHeader = components?.find(c => c.type === 'header' || c.type === 'HEADER');

        if (metaHeader) {
            if (metaHeader.format === 'TEXT') {
                // Only include if variables exist
                const hasVars = metaHeader.text && metaHeader.text.includes('{{');
                if (hasVars) {
                    // Check if user provided params
                    if (userHeader && userHeader.parameters) {
                        finalComponents.push({ type: 'header', parameters: userHeader.parameters });
                    } else {
                        // Missing params for text header - skip or error? Meta will likely error.
                        // We can't fix this without data.
                        console.warn('[ExtAPI] Template expects Header Variables, but none provided.');
                    }
                }
            } else if (['IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION'].includes(metaHeader.format)) {
                // User MUST provide header media
                if (userHeader && userHeader.parameters) {
                    finalComponents.push({ type: 'header', parameters: userHeader.parameters });
                } else {
                    console.warn(`[ExtAPI] Template expects ${metaHeader.format} Header, but none provided.`);
                }
            }
        } else if (userHeader) {
            // User provided Header but Meta says NO Header? Skip it to avoid "sub_type invalid"
            console.warn('[ExtAPI] User provided Header but Template has NONE. Skipping.');
        }

        // --- BODY ---
        const metaBody = metaComponents.find(c => c.type === 'BODY');
        const userBody = components?.find(c => c.type === 'body' || c.type === 'BODY');

        if (metaBody) {
            // Only include body if parameters are provided OR if variables exist
            // Actually, for Body, you only need to include it if you have parameters. 
            // If static text, you don't need to send the component.
            const hasVars = metaBody.text && metaBody.text.includes('{{');
            if (hasVars && userBody && userBody.parameters) {
                finalComponents.push({ type: 'body', parameters: userBody.parameters });
            } else if (hasVars && !userBody) {
                console.warn('[ExtAPI] Template expects Body Variables, but none provided.');
            }
        }

        // --- BUTTONS ---
        const metaButtonsComp = metaComponents.find(c => c.type === 'BUTTONS');
        const userButtonsComp = components?.find(c => c.type === 'BUTTONS' || c.type === 'button'); // Payload often flattens buttons? No, standard is components based.

        // Wait, standard payload has ONE 'button' component PER button?
        // No, standard payload structure is:
        // components: [ { type: 'button', sub_type: 'flow', index: 0, parameters: [...] }, { type: 'button', ... } ]

        // Check for FLOW Buttons specifically
        if (metaButtonsComp && metaButtonsComp.buttons) {
            metaButtonsComp.buttons.forEach((btn, idx) => {
                if (btn.type === 'FLOW') {
                    // Check if User provided this button
                    const userBtn = components?.find(c => c.type === 'button' && c.index === idx);

                    if (userBtn) {
                        finalComponents.push(userBtn);
                    } else {
                        // AUTO-INJECT MISSING FLOW BUTTON
                        // This fixes the "Missing Flow Button" error
                        console.log(`[ExtAPI] Auto-injecting Flow Button at index ${idx}`);
                        finalComponents.push({
                            type: 'button',
                            sub_type: 'flow',
                            index: idx,
                            parameters: [{
                                type: 'action',
                                action: { flow_token: btn.flow_id || 'unused_token' }
                            }]
                        });
                    }
                }
                // We can also auto-inject URL buttons if they require params, but tricky.
                // Assuming others are optional or user handles them.
            });

            // Re-add other USER buttons (like Quick Reply payloads) if they match index
            components?.forEach(c => {
                if (c.type === 'button' && c.sub_type !== 'flow') { // Flow handled above
                    // Validate index exists in meta
                    if (metaButtonsComp.buttons[c.index]) {
                        finalComponents.push(c);
                    }
                }
            });
        }

        // --- CAROUSEL ---
        const metaCarousel = metaComponents.find(c => c.type === 'CAROUSEL' || c.type === 'MPM');
        const userCarousel = components?.find(c => c.type === 'carousel');
        if (metaCarousel && userCarousel) finalComponents.push(userCarousel);

        // Fallback: If Meta definition fetch FAILED, trust the user's components
        const payloadComponents = (metaComponents.length > 0) ? finalComponents : components;

        // Clean Empty/Nulls
        const cleanComponents = payloadComponents ? payloadComponents.filter(c => c) : [];

        console.log('--- DEBUG EXT API (ROBUST) ---');
        console.log('Original:', JSON.stringify(components));
        console.log('Patched:', JSON.stringify(cleanComponents));

        const result = await whatsappService.sendMessage(
            userId, to, 'template',
            { name: templateName, language: { code: language }, components: cleanComponents },
            phoneNumberId,
            false,  // skipDBLog
            { walletSource: 'API_SEND' }  // Playground / external API sends
        );

        res.json({ success: true, data: result });

    } catch (error) {
        console.error('External API Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
