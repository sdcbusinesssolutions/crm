const { supabaseAdmin } = require('../../../lib/supabaseClient');
const axios = require('axios');

// Helper: Get AI Response (Unified Interface)
// Supports: OpenAI, (Future: Claude, Gemini via adapters)
// Helper: Get AI Response (Unified Interface)
async function generateAIResponse(agentConfig, userMessage, context = [], knowledgeContext = "") {
    try {
        const { system_prompt, model_config, user_id } = agentConfig;

        // 1. Construct Messages
        const messages = [
            { role: "system", content: `${system_prompt}\n\nRELEVANT KNOWLEDGE:\n${knowledgeContext || "None"}` },
            ...context, // Previous conversation history
            { role: "user", content: userMessage }
        ];

        // 2. Call Provider
        if (!model_config || model_config.provider === 'openai') {
            // Priority: 1. ENV, 2. User integration_vault
            let apiKey = process.env.OPENAI_API_KEY;

            if (!apiKey && user_id) {
                // Fetch from User Integrations (smtp/openai/etc table)
                const { data } = await supabaseAdmin
                    .from('user_integrations')
                    .select('credentials')
                    .eq('user_id', user_id)
                    .eq('provider', 'openai')
                    .single();

                if (data && data.credentials && data.credentials.apiKey) {
                    apiKey = data.credentials.apiKey;
                }
            }

            if (!apiKey) throw new Error("OpenAI API Key not configured. Please add it in Integrations.");

            // Using direct axios call (Proxy Safe)
            const url = 'https://api.openai.com/v1/chat/completions';

            const response = await axios.post(url, {
                model: model_config.model || "gpt-3.5-turbo",
                messages: messages,
                temperature: model_config.temperature || 0.7
            }, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                proxy: false // Bypass "Invalid Host" proxy
            });

            let reply = response.data.choices[0].message.content;
            
            if (model_config) {
                // Clean up if LLM hallucinated the header/footer from history context
                if (model_config.header_message && reply.includes(model_config.header_message)) {
                    reply = reply.split(model_config.header_message).join('').trim();
                }
                if (model_config.footer_message && reply.includes(model_config.footer_message)) {
                    reply = reply.split(model_config.footer_message).join('').trim();
                }

                if (model_config.header_message) {
                    reply = `${model_config.header_message}\n\n${reply}`;
                }
                if (model_config.footer_message) {
                    reply = `${reply}\n\n${model_config.footer_message}`;
                }
            }

            return {
                success: true,
                reply: reply,
                usage: response.data.usage
            };
        } else {
            throw new Error(`Unsupported AI Provider: ${model_config.provider}`);
        }

    } catch (error) {
        console.error("AI Generation Error:", error.response?.data || error.message);
        
        let fallbackReply = agentConfig.model_config?.fallback_message || "I'm sorry, I'm currently experiencing high traffic and cannot answer right now. Please try again in a few minutes.";
        if (agentConfig.model_config?.header_message) {
            fallbackReply = `${agentConfig.model_config.header_message}\n\n${fallbackReply}`;
        }
        if (agentConfig.model_config?.footer_message) {
            fallbackReply = `${fallbackReply}\n\n${agentConfig.model_config.footer_message}`;
        }
        
        return { success: true, reply: fallbackReply };
    }
}

module.exports = {
    async execute(session, node, context) {
        const { agentId, userQuery, historyLimit } = node.data;

        if (!agentId) {
            return { success: false, error: "Missing Agent ID" };
        }

        // 1. Fetch Agent Configuration
        const { data: agent, error } = await supabaseAdmin
            .from('ai_agents')
            .select('*')
            .eq('id', agentId)
            .single();

        if (error || !agent) return { success: false, error: "Agent not found" };

        // 2. Retrieve Knowledge Base
        let knowledgeContext = "";
        try {
            const { data: docs } = await supabaseAdmin
                .from('ai_knowledge_base')
                .select('*')
                .eq('agent_id', agentId)
                .limit(5); // Limit to 5 docs for context window safety (MVP)

            if (docs && docs.length > 0) {
                const docContents = await Promise.all(docs.map(async (doc) => {
                    if (['.txt', '.md', '.csv', '.json'].includes(doc.file_type)) {
                        // Download content
                        const { data, error } = await supabaseAdmin.storage
                            .from('agent_documents')
                            .download(doc.file_path);

                        if (!error && data) {
                            const text = await data.text();
                            return `--- FILE: ${doc.file_name} ---\n${text.slice(0, 5000)}\n--- END FILE ---\n`;
                        }
                    }
                    return `--- FILE: ${doc.file_name} (Content not loaded: ${doc.file_type}) ---\n`;
                }));
                knowledgeContext = docContents.join("\n");
            }
        } catch (e) {
            console.warn("Failed to load knowledge base:", e.message);
        }

        // 3. Generate Response
        let chatHistory = [];
        let conversationId = null;

        try {
            // Find the active conversation for this user and contact phone
            const phoneStr = String(session.contact_phone || '');
            const { data: convData } = await supabaseAdmin
                .from('conversations')
                .select('id')
                .eq('user_id', session.user_id)
                .eq('contact_phone', phoneStr)
                .order('updated_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (convData && convData.id) {
                conversationId = convData.id;
                
                // Fetch recent messages for context
                const sessionLimit = (agent.model_config && agent.model_config.max_messages) ? parseInt(agent.model_config.max_messages) : null;
                const contextLimit = 10; // Only feed the last 10 messages to the LLM to save tokens
                const fetchLimit = sessionLimit ? Math.max(sessionLimit, contextLimit) : contextLimit;
                
                const { data: messagesData } = await supabaseAdmin
                    .from('messages')
                    .select('text, direction')
                    .eq('conversation_id', conversationId)
                    .order('created_at', { ascending: false })
                    .limit(fetchLimit);

                if (messagesData && messagesData.length > 0) {
                    // Check max messages session limit
                    if (sessionLimit) {
                        const aiMessageCount = messagesData.filter(m => m.direction === 'outgoing').length;
                        if (aiMessageCount >= sessionLimit) {
                            return {
                                success: true,
                                outcome: 'success',
                                response: "AI message limit reached for this session. Please hold for a human agent.",
                            };
                        }
                    }

                    // Format history for the LLM prompt (only take the latest contextLimit messages, reverse to chronological)
                    chatHistory = messagesData.slice(0, contextLimit).reverse().map(msg => {
                        let content = msg.text || '';
                        if (msg.direction === 'outgoing') {
                            if (agent.model_config && agent.model_config.header_message) {
                                content = content.split(agent.model_config.header_message).join('').trim();
                            }
                            if (agent.model_config && agent.model_config.footer_message) {
                                content = content.split(agent.model_config.footer_message).join('').trim();
                            }
                        }
                        return {
                            role: msg.direction === 'outgoing' ? 'assistant' : 'user',
                            content: content
                        };
                    }).filter(m => m.content.trim() !== '');
                }
            }
        } catch (e) {
            console.error("[aiAgent] Failed to fetch chat history:", e.message);
        }

        const result = await generateAIResponse(agent, userQuery || "Hello", chatHistory, knowledgeContext);

        if (result.success) {
            return {
                success: true,
                outcome: 'success',
                response: result.reply,
                // Save to variable if configured in Node
            };
        } else {
            return { success: false, outcome: 'failure', error: result.error };
        }
    }
};
