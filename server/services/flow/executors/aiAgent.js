const { supabaseAdmin } = require('../../../lib/supabaseClient');
const AgentChatService = require('../../AgentChatService');

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

        // 2. Fetch Chat History
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

        // 3. Generate Unified Response
        const options = {
            contact_phone: session.contact_phone
        };
        
        let activeQuery = userQuery;
        
        // If user left query blank or it failed to resolve, use the latest user message from history
        if (!activeQuery || activeQuery.trim() === '') {
            const lastUserMsg = chatHistory.slice().reverse().find(m => m.role === 'user');
            if (lastUserMsg) {
                activeQuery = lastUserMsg.content;
            } else {
                activeQuery = "Hello";
            }
        }
        
        const result = await AgentChatService.processChat(agent, activeQuery, chatHistory, options);

        if (result.success) {
            const payload = {
                success: true,
                outcome: 'success',
                response: result.reply,
            };
            
            if (node.data.outputVariableName) {
                const varName = node.data.outputVariableName.trim();
                if (varName) {
                    payload[varName] = result.reply;
                }
            }
            
            return payload;
        } else {
            return { success: false, outcome: 'failure', error: result.error || result.reply };
        }
    }
};
