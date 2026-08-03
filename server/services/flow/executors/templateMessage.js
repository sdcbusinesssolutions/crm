const whatsappService = require('../../whatsappService');
const { supabase, supabaseAdmin } = require('../../../lib/supabaseClient');
const contextManager = require('../context');

module.exports = {
    async execute(session, node, context) {
        const { user_id, contact_phone } = session;
        const {
            templateName,
            language,
            variableMapping,
            mediaUrl,
            carouselMediaUrls,
            templateId,
            components: nodeComponents
        } = node.data;

        // 1. Determine Components
        // Prefer components stored in node data (snapshot from when user configured the node)
        // This avoids issues where DB is out of sync or missing component data.
        let templateComponents = (nodeComponents && Array.isArray(nodeComponents) && nodeComponents.length > 0)
            ? nodeComponents
            : [];

        let templateData = null;

        // 2. Fallback: Fetch from DB if node components are missing
        if (templateComponents.length === 0) {
            console.log(`[TemplateMessage] Components missing in node data. Fetching from DB for template ${templateId}...`);
            const rpcClient = supabaseAdmin || supabase;
            const { data, error } = await rpcClient
                .from('whatsapp_templates')
                .select('*')
                .eq('id', templateId)
                .single();

            if (error || !data) {
                console.error(`[TemplateMessage] Error fetching template ${templateId}:`, error);
                throw new Error(`Template ${templateId} not found.`);
            }
            templateData = data;

            // Try to get components from DB result
            if (Array.isArray(templateData.components) && templateData.components.length > 0) {
                templateComponents = templateData.components;
            }
        }

        // 3. Last Resort Fallback: Build from flat columns (legacy/flat schema)
        if (templateComponents.length === 0 && templateData) {
            console.log('[TemplateMessage] Components array empty in DB/Node. Attempting fallback to flat schema.');

            // HEADER
            // Handle both header_type (old) and header_format (new) column names
            const hFormat = templateData.header_format || templateData.header_type;
            if (hFormat && hFormat !== 'NONE' && hFormat !== 'TEXT') {
                templateComponents.push({
                    type: 'HEADER',
                    format: hFormat
                });
            } else if (hFormat === 'TEXT' && templateData.header_text && templateData.header_text.match(/{{/)) {
                // Only add TEXT header if it has variables
                templateComponents.push({
                    type: 'HEADER',
                    format: 'TEXT',
                    text: templateData.header_text
                });
            }

            // BODY
            if (templateData.body_text) {
                templateComponents.push({
                    type: 'BODY',
                    text: templateData.body_text
                });
            }

            // FOOTER - Usually static, no need to send unless variables (uncommon)

            // BUTTONS
            if (templateData.buttons && Array.isArray(templateData.buttons)) { // flat array of buttons or object?
                // Complex to map from flat DB structure without knowing exact schema version
                // But usually buttons don't need sending unless dynamic.
            }
        }

        const components = [];

        // --- HEADER ---
        const headerComp = templateComponents.find(c => c.type === 'HEADER');
        if (headerComp) {
            if (headerComp.format === 'IMAGE' || headerComp.format === 'VIDEO' || headerComp.format === 'DOCUMENT') {
                const mediaType = headerComp.format.toLowerCase();
                const param = { type: mediaType };
                if (mediaUrl) {
                    param[mediaType] = { link: mediaUrl };
                }
                components.push({
                    type: 'header',
                    parameters: [param]
                });
            } else if (headerComp.format === 'TEXT' && headerComp.text && headerComp.text.match(/{{/)) {
                // Text Header with Variables
                const hText = headerComp.text;
                const hParams = [];
                // Extract variables {{1}}...
                // Assuming header variables are {{1}} only usually? 
                // Actually, header variable is usually just {{1}}.
                // We will map it using variableMapping or logic.
                // For now, naive variable extraction:
                const hMatches = hText.match(/{{([a-zA-Z0-9_]+)}}/g);
                if (hMatches) {
                    hMatches.forEach(match => {
                        const varName = match.replace(/{{|}}/g, '');
                        // RESOLVE: Map -> then Resolve (recursively if needed)
                        const rawVal = variableMapping ? variableMapping[varName] : '';
                        const resolvedVal = contextManager.resolve(String(rawVal || ''), context, true);

                        hParams.push({
                            type: 'text',
                            text: resolvedVal || '-'
                        });
                    });
                }
                if (hParams.length > 0) {
                    components.push({
                        type: 'header',
                        parameters: hParams
                    });
                }
            }
        }

        // --- BODY ---
        const bodyComp = templateComponents.find(c => c.type === 'BODY');
        if (bodyComp && bodyComp.text) {
            const bodyText = bodyComp.text;
            console.log(`[TemplateMessage] Body Text: "${bodyText}"`);
            const params = [];

            // Detect Max Variable Index
            // e.g. {{1}}, {{2}} -> max is 2.
            const matches = bodyText.match(/{{([0-9]+)}}/g);
            let maxIndex = 0;
            if (matches) {
                matches.forEach(m => {
                    const num = parseInt(m.replace(/{{|}}/g, ''));
                    if (num > maxIndex) maxIndex = num;
                });
            }

            console.log('[TemplateMessage] DEBUG CONTEXT KEYS:', Object.keys(context));
            // Deep log context for taskReminder nodes if present
            const taskKeys = Object.keys(context).filter(k => k.startsWith('taskReminder'));
            taskKeys.forEach(k => console.log(`   > ${k}:`, JSON.stringify(context[k])));

            // If numbered variables found, iterate 1..maxIndex
            if (maxIndex > 0 && variableMapping) {
                for (let i = 1; i <= maxIndex; i++) {
                    const rawVal = variableMapping[String(i)];
                    // RESOLVE!
                    const resolvedVal = contextManager.resolve(String(rawVal !== undefined && rawVal !== null ? rawVal : ''), context, true);

                    params.push({
                        type: 'text',
                        text: resolvedVal || '-'
                    });
                }
            } else {
                // Fallback for named variables (non-standard WhatsApp but possible in local system)
                // or if regex detected named variables {{name}}
                const namedMatches = bodyText.match(/{{([a-zA-Z_]+)}}/g);
                if (namedMatches) {
                    namedMatches.forEach(match => {
                        const varName = match.replace(/{{|}}/g, '');
                        const rawVal = variableMapping ? variableMapping[varName] : '';
                        // RESOLVE!
                        const resolvedVal = contextManager.resolve(String(rawVal || ''), context, true);

                        params.push({
                            type: 'text',
                            text: resolvedVal || '-'
                        });
                    });
                }
            }

            if (params.length > 0) {
                components.push({
                    type: 'body',
                    parameters: params
                });
            }
        }

        // --- BUTTONS ---
        let buttonsList = [];

        // 1. Try to get buttons from nodeComponents
        if (nodeComponents) { // Check if nodeComponents is an array
            const buttonsComp = nodeComponents.find(c => c.type === 'BUTTONS');
            if (buttonsComp && Array.isArray(buttonsComp.buttons)) {
                buttonsList = buttonsComp.buttons;
            }
        }

        // 2. Fallback to DB templateData
        if (buttonsList.length === 0 && templateData) {
            if (Array.isArray(templateData.buttons)) {
                buttonsList = templateData.buttons;
            } else if (templateData.buttons && typeof templateData.buttons === 'object') {
                // formatting like { type: 'FORM', buttons: [...] }
                if (Array.isArray(templateData.buttons.buttons)) {
                    buttonsList = templateData.buttons.buttons;
                }
            }
        }

        if (buttonsList.length > 0) {
            buttonsList.forEach((btn, idx) => {
                if (btn.type === 'FLOW') {
                    // Flow buttons MUST be included in the payload with sub_type 'flow'
                    components.push({
                        type: 'button',
                        sub_type: 'flow',
                        index: idx
                    });
                } else if (btn.type === 'URL') {
                    // Check for dynamic URL: {{1}}
                    if (btn.url && btn.url.includes('{{')) {
                        const uMatches = btn.url.match(/{{([a-zA-Z0-9_]+)}}/g);
                        if (uMatches) {
                            const bParams = [];
                            uMatches.forEach(m => {
                                const vName = m.replace(/{{|}}/g, '');
                                const rawVal = variableMapping ? variableMapping[vName] : '';
                                const resolvedVal = contextManager.resolve(String(rawVal || ''), context, true);
                                bParams.push({
                                    type: 'text',
                                    text: resolvedVal || '-'
                                });
                            });

                            if (bParams.length > 0) {
                                components.push({
                                    type: 'button',
                                    sub_type: 'url',
                                    index: idx,
                                    parameters: bParams
                                });
                            }
                        }
                    }
                }
            });
        }

        // --- CAROUSEL ---
        const carouselComp = templateComponents.find(c => c.type === 'CAROUSEL');
        if (carouselComp && carouselComp.cards) {
            const cards = carouselComp.cards.map((card, index) => {
                const cardComponents = [];
                const cardHeader = card.components.find(c => c.type === 'HEADER');
                if (cardHeader && (cardHeader.format === 'IMAGE' || cardHeader.format === 'VIDEO')) {
                    const mediaType = cardHeader.format.toLowerCase();
                    const url = carouselMediaUrls && carouselMediaUrls[index];
                    if (url) {
                        cardComponents.push({
                            type: 'header',
                            parameters: [{
                                type: mediaType,
                                [mediaType]: { link: url }
                            }]
                        });
                    }
                }
                return {
                    card_index: index,
                    components: cardComponents
                };
            });
            components.push({
                type: 'carousel',
                cards: cards
            });
        }

        const content = {
            name: templateName,
            language: { code: language },
            components: components
        };

        console.log('[TemplateMessage] Sending Payload Components:', JSON.stringify(components, null, 2));

        const response = await whatsappService.sendMessage(user_id, contact_phone, 'template', content);

        const result = {
            status: 'sent',
            timestamp: new Date().toISOString(),
            ...response
        };

        // Check if we should wait for a response (e.g. if buttons are present and user configured "Wait for Answer")
        // Default to not waiting unless explicitly configured or inferred??
        // Usually, flows with buttons should NOT auto-advance if we want to capture the click.
        // But for standard text templates without buttons, we might just proceed.



        let shouldPause = false;

        // 1. Explicit Config
        if (node.data.saveResponse || node.data.validateResponse || node.data.ifUnresponsive) {
            shouldPause = true;
        }
        // 2. Implicit: If Flow button exists, we ALMOST ALWAYS want to wait for the flow data.
        else if (buttonsList.some(b => b.type === 'FLOW' || b.type === 'QUICK_REPLY')) {
            shouldPause = true;
            console.log('[TemplateMessage] Interactive button (FLOW or QUICK_REPLY) detected. Auto-enabling PAUSE to capture response.');
        }

        if (shouldPause) {
            // Calculate Timeout if enabled
            const timeoutUtils = require('../timeoutUtils');
            const timeoutAt = timeoutUtils.calculateTimeoutAt(node.data);

            if (timeoutAt) {
                console.log(`[TemplateMessage] Timeout set. Expires at: ${timeoutAt}`);
            }

            return {
                ...result,
                __action: 'PAUSE',
                timeoutAt: timeoutAt
            };
        }

        return result;
    }
};
