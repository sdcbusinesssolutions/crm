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

        const config = agent.model_config || {};

        // 1.5 Check Working Hours (IST by default)
        if (config.working_hours && config.working_hours.enabled) {
            const { start, end, ooo_message, timezone } = config.working_hours;
            if (start && end) {
                const tz = timezone || 'Asia/Kolkata';
                const options = { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false };
                const currentTime = new Date().toLocaleTimeString('en-US', options);
                
                let isOffline = false;
                if (start <= end) {
                    isOffline = (currentTime < start || currentTime > end);
                } else {
                    // Overnight shift (e.g. 22:00 to 06:00)
                    isOffline = (currentTime > end && currentTime < start);
                }

                if (isOffline) {
                    return { 
                        success: true, 
                        outcome: 'success', 
                        response: ooo_message || "We are currently offline. Please leave a message and we'll get back to you during our working hours." 
                    };
                }
            }
        }

        // 2. Fetch Chat History
        let chatHistory = [];
        let conversationId = null;

        try {
            // Find the active conversation for this user and contact phone
            const phoneStr = String(session.contact_phone || '');
            const { data: convData } = await supabaseAdmin
                .from('conversations')
                .select('id, bot_paused_until')
                .eq('user_id', session.user_id)
                .eq('contact_phone', phoneStr)
                .order('updated_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (convData && convData.id) {
                conversationId = convData.id;
                
                // 1.8 Check if AI is paused for this conversation
                if (convData.bot_paused_until) {
                    const pausedUntil = new Date(convData.bot_paused_until);
                    if (pausedUntil > new Date()) {
                        console.log(`[aiAgent] AI is manually paused for conversation ${conversationId} until ${pausedUntil.toISOString()}`);
                        return { success: false, error: "AI is currently paused by a human agent for this customer." };
                    }
                }
                
                // Fetch recent messages for context
                const sessionLimit = (config.max_messages) ? parseInt(config.max_messages) : null;
                const contextLimit = (config.context_limit) ? parseInt(config.context_limit) : 10; // Configurable limit
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
                        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
                        const { count, error: countError } = await supabaseAdmin
                            .from('messages')
                            .select('*', { count: 'exact', head: true })
                            .eq('conversation_id', conversationId)
                            .eq('direction', 'out')
                            .gte('created_at', twentyFourHoursAgo);
                            
                        if (!countError) {
                            const aiMessageCount = count || 0;
                            if (aiMessageCount >= sessionLimit) {
                                return {
                                    success: true,
                                    outcome: 'success',
                                    response: "AI message limit reached for this session. Please hold for a human agent.",
                                };
                            }
                        }
                    }

                    // Format history for the LLM prompt (only take the latest contextLimit messages, reverse to chronological)
                    chatHistory = messagesData.slice(0, contextLimit).reverse().map(msg => {
                        let content = msg.text || '';
                        if (msg.direction === 'out') {
                            if (agent.model_config && agent.model_config.header_message) {
                                content = content.split(agent.model_config.header_message).join('').trim();
                            }
                            if (agent.model_config && agent.model_config.footer_message) {
                                content = content.split(agent.model_config.footer_message).join('').trim();
                            }
                        }
                        return {
                            role: msg.direction === 'out' ? 'assistant' : 'user',
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
            
            // Fire and forget background lead scoring
            if (conversationId) {
                AgentChatService.analyzeLead(agent, conversationId, chatHistory, activeQuery, result.reply)
                    .catch(e => console.error("[aiAgent] Analyze error:", e));
            }
            
            return payload;
        } else {
            return { success: false, outcome: 'failure', error: result.error || result.reply };
        }
    }
};
