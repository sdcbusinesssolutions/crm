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

            const reply = response.data.choices[0].message.content;
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
        return { success: false, error: error.message };
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
        // We don't have conversation history in 'session' easily accessible formatted for AI usually.
        // We rely on single-turn or passed context variable.
        const chatHistory = []; // TODO: Extract from session if needed

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
