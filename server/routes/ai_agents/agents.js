const express = require('express');
const router = express.Router();
const axios = require('axios');
const { supabaseAdmin } = require('../../lib/supabaseClient');

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

        if (error || !agent) throw new Error('Agent not found');

        const config = agent.model_config || {};
        const provider = config.provider || 'openai';
        const apiKey = config.api_key;

        if (!apiKey) {
            return res.status(400).json({ error: 'API Key is missing. Please configure it in the agent settings.' });
        }

        // 2. Build System Prompt with Knowledge Base
        let finalSystemPrompt = agent.system_prompt;
        
        // Inject FAQs
        if (config.faqs && config.faqs.length > 0) {
            finalSystemPrompt += "\n\n--- KNOWLEDGE BASE (FAQs) ---\nUse the following information to answer user queries. If the answer is not here, you can use your general knowledge, but prioritize these FAQs:\n";
            config.faqs.forEach(faq => {
                finalSystemPrompt += `Q: ${faq.question}\nA: ${faq.answer}\n\n`;
            });
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

        // 3. Define Tools
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
                    const customTool = {
                        type: "function",
                        function: {
                            name: tool.name,
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

        // 4. Format Messages
        const messages = [
            { role: 'system', content: finalSystemPrompt },
            ...cleanHistory,
            { role: 'user', content: message }
        ];

        // 5. Call Provider (with tool execution loop)
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
                if (provider === 'openrouter') headers['HTTP-Referer'] = 'http://localhost:3000';

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
                        const functionArgs = JSON.parse(toolCall.function.arguments);
                        let toolResult = '';
                        
                        let matchedCustomTool = null;
                        if (config.custom_tools && Array.isArray(config.custom_tools)) {
                            matchedCustomTool = config.custom_tools.find(t => t.name === functionName);
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
                const geminiMessages = currentMessages.map(m => ({
                    role: (m.role === 'system' || m.role === 'tool') ? 'user' : (m.role === 'assistant' ? 'model' : 'user'),
                    parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }]
                }));
                
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
                        matchedCustomTool = config.custom_tools.find(t => t.name === functionName);
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
                    currentMessages.push({ role: 'assistant', content: `[Function Call: ${functionName}]` });
                    currentMessages.push({ role: 'tool', content: `[Function Result]: ${toolResult}` });
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
        res.json({ reply: aiResponseText });

    } catch (error) {
        console.error('Chat Error:', error.response?.data || error.message);
        
        // Return a graceful fallback message instead of a raw API error
        const fallbackConfig = agent?.model_config || {};
        let fallbackReply = fallbackConfig.fallback_message || "I'm sorry, I'm currently experiencing high traffic and cannot answer right now. Please try again in a few minutes.";
        
        if (fallbackConfig.header_message) {
            fallbackReply = `${fallbackConfig.header_message}\n\n${fallbackReply}`;
        }
        if (fallbackConfig.footer_message) {
            fallbackReply = `${fallbackReply}\n\n${fallbackConfig.footer_message}`;
        }
        
        res.json({ reply: fallbackReply });
    }
});

module.exports = router;
