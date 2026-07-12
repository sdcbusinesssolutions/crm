const axios = require('axios');
const { supabaseAdmin } = require('../lib/supabaseClient');
const NodeCache = require('node-cache');
const docCache = new NodeCache({ stdTTL: 0 }); // Cache documents indefinitely (until server restart)

class AgentChatService {
    /**
     * Process a chat interaction with an AI agent.
     * @param {Object} agent - The agent configuration object from the database.
     * @param {string} message - The user's message.
     * @param {Array} history - The chat history array [{role, content}].
     * @param {Object} options - Additional options { contact_phone, reqOrigin, reqHost }.
     * @returns {Promise<Object>} - { success: true, reply: aiResponseText }
     */
    async processChat(agent, message, history = [], options = {}) {
        let agentConfig = agent.model_config || {};
        
        try {
            const config = agentConfig;
            const provider = config.provider || 'openai';
            let apiKey = config.api_key;

            // Fallback for API Key if not set in Agent Config (e.g. from user_integrations)
            if (!apiKey && agent.user_id && provider === 'openai') {
                apiKey = process.env.OPENAI_API_KEY;
                if (!apiKey) {
                    const { data: integration } = await supabaseAdmin
                        .from('user_integrations')
                        .select('credentials')
                        .eq('user_id', agent.user_id)
                        .eq('provider', 'openai')
                        .maybeSingle();

                    if (integration && integration.credentials && integration.credentials.apiKey) {
                        apiKey = integration.credentials.apiKey;
                    }
                }
            }

            if (!apiKey) {
                throw new Error('API Key is missing. Please configure it in the agent settings or integrations.');
            }

            // 1. Build System Prompt with Knowledge Base
            let finalSystemPrompt = agent.system_prompt;
            
            // Inject FAQs
            if (config.faqs && config.faqs.length > 0) {
                finalSystemPrompt += "\n\n--- KNOWLEDGE BASE (FAQs) ---\nUse the following information to answer user queries. If the answer is not here, you can use your general knowledge, but prioritize these FAQs:\n";
                config.faqs.forEach(faq => {
                    finalSystemPrompt += `Q: ${faq.question}\nA: ${faq.answer}\n\n`;
                });
            }
            
            // Inject Document Knowledge (RAG)
            try {
                const { data: docs } = await supabaseAdmin.from('ai_knowledge_base').select('file_path').eq('agent_id', agent.id);
                if (docs && docs.length > 0) {
                    let docTextString = '';
                    for (const doc of docs) {
                        const cacheKey = `doc_${doc.file_path}`;
                        let cachedText = docCache.get(cacheKey);
                        if (!cachedText) {
                            // Using createSignedUrl + axios is 100% reliable in Node.js, avoiding the SDK's Blob parsing bugs
                            const { data: urlData, error: urlError } = await supabaseAdmin.storage
                                .from('agent_documents')
                                .createSignedUrl(doc.file_path + '.txt', 60); // 60 seconds expiry

                            if (urlError) {
                                console.error('[RAG] Failed to get signed URL for document:', doc.file_path + '.txt', urlError);
                            } else if (urlData && urlData.signedUrl) {
                                try {
                                    const response = await axios.get(urlData.signedUrl);
                                    cachedText = response.data;
                                    // Make sure it's a string
                                    if (typeof cachedText !== 'string') {
                                        cachedText = JSON.stringify(cachedText);
                                    }
                                    docCache.set(cacheKey, cachedText);
                                } catch (axiosErr) {
                                    console.error('[RAG] Failed to download document via axios:', doc.file_path + '.txt', axiosErr.message);
                                }
                            }
                        }
                        if (cachedText) {
                            docTextString += cachedText + '\n\n';
                        }
                    }
                    if (docTextString) {
                        finalSystemPrompt += "\n\n--- UPLOADED DOCUMENTS KNOWLEDGE ---\nUse the following extracted document text to answer queries accurately. Do not mention that you read this from a document, just provide the answer:\n\n" + docTextString;
                    }
                }
            } catch (err) {
                console.error('Failed to inject document knowledge:', err);
            }
            
            // Inject Answer Formatting & Identity Rules
            finalSystemPrompt += "\n\n--- BEHAVIOR & FORMATTING RULES ---\n";
            
            if (config.response_length === 'short') {
                finalSystemPrompt += "- Keep responses brief, concise, and to the point.\n";
            } else if (config.response_length === 'descriptive') {
                finalSystemPrompt += "- Provide descriptive, detailed, and comprehensive responses.\n";
            }
            
            if (config.bot_tone) {
                finalSystemPrompt += `- Adopt a ${config.bot_tone.replace('_', ' ')} tone.\n`;
            }
            
            if (config.bot_gender && config.bot_gender !== 'neutral') {
                finalSystemPrompt += `- Adopt a ${config.bot_gender} persona.\n`;
            }
            
            if (config.use_emojis) {
                finalSystemPrompt += "- Use emojis naturally in your responses.\n";
            } else if (config.use_emojis === false) {
                finalSystemPrompt += "- Do NOT use emojis.\n";
            }
            
            if (config.use_bullet_points) {
                finalSystemPrompt += "- Format lists using bullet points where appropriate for readability.\n";
            } else if (config.use_bullet_points === false) {
                finalSystemPrompt += "- Do NOT use bullet points.\n";
            }
            
            if (config.stop_keywords) {
                finalSystemPrompt += `- CRITICAL: If the user says any of the following words (${config.stop_keywords}), you must immediately acknowledge their request to stop and end the conversation.\n`;
            }

            // 2. Define Tools
            const tools = [];
            const geminiTools = [];
            
            if (config.webhook_url) {
                const webhookTool = {
                    type: "function",
                    function: {
                        name: "trigger_webhook",
                        description: "Trigger an external webhook to perform an action or automation.",
                        parameters: { type: "object", properties: { payload: { type: "string", description: "JSON string payload to send to the webhook." } }, required: ["payload"] }
                    }
                };
                tools.push(webhookTool);
                geminiTools.push(webhookTool.function);
            }

            if (config.custom_tools && Array.isArray(config.custom_tools)) {
                config.custom_tools.forEach(tool => {
                    if (tool.name && tool.url) {
                        const safeName = tool.name.replace(/[^a-zA-Z0-9_-]/g, '_');
                        const customTool = {
                            type: "function",
                            function: {
                                name: safeName,
                                description: tool.description || `Trigger the ${tool.name} webhook.`,
                                parameters: { type: "object", properties: { payload: { type: "string", description: "JSON string payload to send." } } }
                            }
                        };
                        tools.push(customTool);
                        geminiTools.push(customTool.function);
                    }
                });
            }
            
            if (config.transfer_number) {
                const transferTool = {
                    type: "function",
                    function: {
                        name: "transfer_to_human",
                        description: "Transfer the conversation to a human agent.",
                        parameters: { type: "object", properties: { reason: { type: "string", description: "Reason for transferring." } }, required: ["reason"] }
                    }
                };
                tools.push(transferTool);
                geminiTools.push(transferTool.function);
            }

            // Clean history of headers and footers so LLM doesn't learn them as patterns
            const cleanHistory = history.map(msg => {
                if (msg.role === 'assistant') {
                    let text = msg.content || '';
                    if (config.header_message) text = text.split(config.header_message).join('').trim();
                    if (config.footer_message) text = text.split(config.footer_message).join('').trim();
                    return { ...msg, content: text };
                }
                return msg;
            });

            // 3. Format Messages
            const messages = [
                { role: 'system', content: finalSystemPrompt },
                ...cleanHistory,
                { role: 'user', content: message }
            ];

            // 4. Call Provider (with tool execution loop)
            let aiResponseText = '';
            let currentMessages = [...messages];
            let maxTurns = 5;
            let turn = 0;

            while (turn < maxTurns) {
                turn++;
                
                if (provider === 'openai' || provider === 'openrouter') {
                    const endpoint = provider === 'openai' ? 'https://api.openai.com/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions';
                    const defaultModel = provider === 'openai' ? 'gpt-4o' : 'openai/gpt-4o';
                    
                    const payload = {
                        model: config.model_id || defaultModel,
                        messages: currentMessages,
                        temperature: config.temperature !== undefined ? parseFloat(config.temperature) : 0.7
                    };
                    if (tools.length > 0) payload.tools = tools;

                    const headers = { 'Authorization': `Bearer ${apiKey}` };
                    if (provider === 'openrouter') {
                        headers['HTTP-Referer'] = options.reqOrigin || (options.reqHost ? `https://${options.reqHost}` : 'http://localhost:3000');
                        headers['X-Title'] = process.env.APP_NAME || 'AI Agent';
                    }

                    const response = await axios.post(endpoint, payload, { headers });
                    
                    if (response.data.error) {
                        throw new Error(`AI Provider Error: ${response.data.error.message || JSON.stringify(response.data.error)}`);
                    }
                    if (!response.data.choices || !response.data.choices[0]) {
                        throw new Error(`Unexpected API response format: ${JSON.stringify(response.data)}`);
                    }
                    
                    const responseMessage = response.data.choices[0].message;

                    if (responseMessage.tool_calls) {
                        currentMessages.push(responseMessage); // Add assistant tool call
                        
                        for (const toolCall of responseMessage.tool_calls) {
                            const functionName = toolCall.function.name;
                            let functionArgs = {};
                            try {
                                if (toolCall.function.arguments) {
                                    functionArgs = JSON.parse(toolCall.function.arguments);
                                }
                            } catch (e) {
                                console.warn("Failed to parse tool arguments:", toolCall.function.arguments);
                            }
                            let toolResult = '';
                            
                            let matchedCustomTool = null;
                            if (config.custom_tools && Array.isArray(config.custom_tools)) {
                                matchedCustomTool = config.custom_tools.find(t => {
                                    const safeName = t.name.replace(/[^a-zA-Z0-9_-]/g, '_');
                                    return safeName === functionName;
                                });
                            }
                            
                            if (matchedCustomTool) {
                                try {
                                    const webhookRes = await axios.post(matchedCustomTool.url, functionArgs);
                                    toolResult = JSON.stringify(webhookRes.data || { success: true });
                                } catch (e) {
                                    toolResult = JSON.stringify({ error: e.message });
                                }
                            } else if (functionName === 'trigger_webhook') {
                                try {
                                    const webhookRes = await axios.post(config.webhook_url, functionArgs);
                                    toolResult = JSON.stringify(webhookRes.data || { success: true });
                                } catch (e) {
                                    toolResult = JSON.stringify({ error: e.message });
                                }
                            } else if (functionName === 'transfer_to_human') {
                                toolResult = `Transfer initiated to ${config.transfer_number}. Reason: ${functionArgs.reason}`;
                            }
                            
                            currentMessages.push({
                                tool_call_id: toolCall.id,
                                role: "tool",
                                name: functionName,
                                content: toolResult
                            });
                        }
                        continue; // Loop again to get final answer
                    } else {
                        aiResponseText = responseMessage.content;
                        break;
                    }
                    
                } else if (provider === 'gemini') {
                    const geminiMessages = [];
                    let lastRole = null;
                    
                    for (const m of currentMessages) {
                        if (m._gemini_function_call) {
                            geminiMessages.push({ role: 'model', parts: [{ functionCall: m._gemini_function_call }] });
                            lastRole = 'model';
                            continue;
                        }
                        if (m._gemini_function_response) {
                            geminiMessages.push({ role: 'user', parts: [{ functionResponse: m._gemini_function_response }] });
                            lastRole = 'user';
                            continue;
                        }
                        
                        let role = (m.role === 'system' || m.role === 'tool') ? 'user' : (m.role === 'assistant' ? 'model' : 'user');
                        let part = { text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) };
                        
                        if (role === lastRole) {
                            geminiMessages[geminiMessages.length - 1].parts.push(part);
                        } else {
                            geminiMessages.push({ role, parts: [part] });
                            lastRole = role;
                        }
                    }
                    
                    const payload = { contents: geminiMessages };
                    if (geminiTools.length > 0) {
                        payload.tools = [{ functionDeclarations: geminiTools }];
                    }

                    const geminiModel = config.model_id || 'gemini-2.5-flash';
                    const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`, payload);
                    
                    if (!response.data.candidates || !response.data.candidates[0]) {
                        throw new Error(`Unexpected Gemini response format: ${JSON.stringify(response.data)}`);
                    }
                    
                    const part = response.data.candidates[0].content.parts[0];
                    
                    if (part.functionCall) {
                        const functionName = part.functionCall.name;
                        const functionArgs = part.functionCall.args;
                        let toolResult = '';
                        
                        let matchedCustomTool = null;
                        if (config.custom_tools && Array.isArray(config.custom_tools)) {
                            matchedCustomTool = config.custom_tools.find(t => {
                                const safeName = t.name.replace(/[^a-zA-Z0-9_-]/g, '_');
                                return safeName === functionName;
                            });
                        }
                        
                        if (matchedCustomTool) {
                            try {
                                const webhookRes = await axios.post(matchedCustomTool.url, functionArgs);
                                toolResult = JSON.stringify(webhookRes.data || { success: true });
                            } catch (e) {
                                toolResult = JSON.stringify({ error: e.message });
                            }
                        } else if (functionName === 'trigger_webhook') {
                            try {
                                const webhookRes = await axios.post(config.webhook_url, functionArgs);
                                toolResult = JSON.stringify(webhookRes.data || { success: true });
                            } catch (e) {
                                toolResult = JSON.stringify({ error: e.message });
                            }
                        } else if (functionName === 'transfer_to_human') {
                            toolResult = `Transfer initiated to ${config.transfer_number}. Reason: ${functionArgs.reason}`;
                        }
                        
                        // Add model's tool call and user's tool response
                        currentMessages.push({ 
                            role: 'assistant', 
                            content: `[Function Call: ${functionName}]`,
                            _gemini_function_call: { name: functionName, args: functionArgs }
                        });
                        
                        let toolResponseObj = { result: toolResult };
                        try { toolResponseObj = JSON.parse(toolResult); } catch (e) {}
                        
                        currentMessages.push({ 
                            role: 'tool', 
                            content: `[Function Result]: ${toolResult}`,
                            _gemini_function_response: { name: functionName, response: { name: functionName, content: toolResponseObj } }
                        });
                        continue;
                    } else {
                        aiResponseText = part.text;
                        break;
                    }
                    
                } else if (provider === 'claude') {
                    const response = await axios.post('https://api.anthropic.com/v1/messages', {
                        model: config.model_id || 'claude-3-opus-20240229',
                        messages: history.concat({ role: 'user', content: message }),
                        system: finalSystemPrompt,
                        max_tokens: 1024,
                        temperature: config.temperature !== undefined ? parseFloat(config.temperature) : 0.7
                    }, {
                        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }
                    });
                    aiResponseText = response.data.content[0].text;
                    break;
                }
            }

            if (!aiResponseText || aiResponseText.trim() === '') {
                aiResponseText = config.fallback_message || "I'm sorry, I'm having a bit of trouble processing that right now. Could you please provide more details or try a different time?";
            } else {
                // Clean up if LLM hallucinated the header/footer from history context
                if (config.header_message && aiResponseText.includes(config.header_message)) {
                    aiResponseText = aiResponseText.split(config.header_message).join('').trim();
                }
                if (config.footer_message && aiResponseText.includes(config.footer_message)) {
                    aiResponseText = aiResponseText.split(config.footer_message).join('').trim();
                }
                
                // Prepend header if exists
                if (config.header_message) {
                    aiResponseText = `${config.header_message}\n\n${aiResponseText}`;
                }
                // Append footer if exists
                if (config.footer_message) {
                    aiResponseText = `${aiResponseText}\n\n${config.footer_message}`;
                }
            }

            console.log("\n\n[DEBUG AI RESPONSE]:", JSON.stringify(aiResponseText));
            return { success: true, reply: aiResponseText };

        } catch (error) {
            const errorDetails = error.response?.data || error.message;
            console.error('Chat Error:', errorDetails);
            
            const fallbackConfig = agentConfig || {};
            
            // Trigger Error Webhook if defined in Tools
            try {
                if (fallbackConfig.custom_tools && Array.isArray(fallbackConfig.custom_tools)) {
                    const errorTool = fallbackConfig.custom_tools.find(t => t.name === 'error_handler');
                    if (errorTool && errorTool.url) {
                        // Send error silently in background
                        axios.post(errorTool.url, { 
                            error: errorDetails,
                            agent_id: agent.id,
                            event: "llm_api_failure",
                            contact_phone: options.contact_phone || "0000000000",
                            timestamp: new Date().toISOString()
                        })
                        .then(() => console.log("✅ Successfully triggered error_handler webhook!"))
                        .catch(e => console.error("Error sending to error_handler webhook:", e.message));
                    }
                }
            } catch (webhookErr) {
                console.error("Failed to process error tool:", webhookErr);
            }

            // Return a graceful fallback message instead of a raw API error
            let fallbackReply = fallbackConfig.fallback_message || "I'm sorry, I'm currently experiencing high traffic and cannot answer right now. Please try again in a few minutes.";
            
            if (fallbackConfig.header_message) {
                fallbackReply = `${fallbackConfig.header_message}\n\n${fallbackReply}`;
            }
            if (fallbackConfig.footer_message) {
                fallbackReply = `${fallbackReply}\n\n${fallbackConfig.footer_message}`;
            }
            
            return { success: false, reply: fallbackReply, error: errorDetails };
        }
    } // End of processChat

    /**
     * Analyze the conversation to score the lead and generate a summary.
     * This is designed to be run asynchronously in the background.
     */
    async analyzeLead(agent, conversationId, history, userMessage, aiResponse) {
        try {
            const config = agent.model_config || {};
            const provider = config.provider || 'openai';
            let apiKey = config.api_key;
            
            if (!apiKey && agent.user_id && provider === 'openai') {
                apiKey = process.env.OPENAI_API_KEY;
            }

            if (!apiKey || provider !== 'openai') return; // Currently only supporting OpenAI for analysis

            // Prepare conversation transcript
            let transcript = history.map(h => `${h.role === 'user' ? 'Lead' : 'AI'}: ${h.content}`).join('\n');
            transcript += `\nLead: ${userMessage}\nAI: ${aiResponse}`;

            const systemPrompt = `You are a Lead Scoring AI. Analyze the conversation transcript and return a JSON object with:
- "status": exactly one of "HOT", "WARM", "COLD", or "JUNK".
- "summary": A concise 1-2 sentence summary of the lead's intent and qualification.

Rules for status:
- HOT: Very interested, ready to buy, requested pricing, demo, or immediate contact.
- WARM: Interested but has questions, exploring options, not ready immediately.
- COLD: Just browsing, not a fit, unresponsive, or explicitly said no.
- JUNK: Spam, nonsensical, or wrong number.

Return ONLY valid JSON format.`;

            const payload = {
                model: 'gpt-4o-mini', // Fast and cheap for analysis
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: transcript }
                ],
                response_format: { type: 'json_object' },
                temperature: 0.1
            };

            const response = await axios.post('https://api.openai.com/v1/chat/completions', payload, {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });

            if (response.data.choices && response.data.choices[0]) {
                const analysisResult = JSON.parse(response.data.choices[0].message.content);
                
                if (analysisResult.status && analysisResult.summary) {
                    await supabaseAdmin
                        .from('conversations')
                        .update({
                            lead_status: analysisResult.status,
                            lead_summary: analysisResult.summary
                        })
                        .eq('id', conversationId);
                }
            }
        } catch (error) {
            console.error('[AgentChatService] Lead analysis failed:', error.message);
        }
    }
}

module.exports = new AgentChatService();
