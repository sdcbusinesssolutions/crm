const axios = require('axios');
const OpenAI = require('openai');
const { supabaseAdmin } = require('../../../lib/supabaseClient');

class AIAgentExecutor {
    async execute(session, node, context) {
        console.log(`[AIAgentExecutor] Executing node ${node.id}`);

        const { systemPrompt, model = 'gpt-4o', outputVariableName = 'ai_response', mode = 'chat', assistantId } = node.data;

        // Initialize OpenAI if Key is present
        let openai = null;
        if (process.env.OPENAI_API_KEY) {
            openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        }

        try {
            // =======================================================
            // MODE: OPENAI ASSISTANT (Knowledge Base)
            // =======================================================
            if (mode === 'assistant' && assistantId) {
                if (!openai) throw new Error("OPENAI_API_KEY is required for Assistant Mode.");

                console.log(`[AIAgentExecutor] Running in ASSISTANT mode. ID: ${assistantId}`);

                // 1. Get or Create Thread ID
                // Check if this specific node already created a thread in this session
                let threadId = context[node.id]?.openai_thread_id;

                if (!threadId) {
                    console.log(`[AIAgentExecutor] Creating new thread...`);
                    const thread = await openai.beta.threads.create();
                    threadId = thread.id;
                } else {
                    console.log(`[AIAgentExecutor] Using existing thread: ${threadId}`);
                }

                // 2. Get User Message (Last Inbound Text)
                const convId = await this.getConversationId(session);
                let userMessage = "Hello";
                if (convId) {
                    const { data: lastMsg } = await supabaseAdmin
                        .from('messages')
                        .select('text')
                        .eq('direction', 'in')
                        .eq('conversation_id', convId)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle(); // maybeSingle avoids error if no messages

                    if (lastMsg && lastMsg.text) userMessage = lastMsg.text;
                }

                console.log(`[AIAgentExecutor] Sending to Assistant: "${userMessage}"`);

                // 3. Add Message to Thread
                await openai.beta.threads.messages.create(threadId, {
                    role: "user",
                    content: userMessage
                });

                // 4. Run Assistant and Poll
                console.log(`[AIAgentExecutor] Starting Run...`);
                // createAndPoll is available in recent OpenAI Node SDKs
                // It polls until terminal status (completed, failed, cancelled, expired, etc)
                const run = await openai.beta.threads.runs.createAndPoll(threadId, {
                    assistant_id: assistantId
                });

                let responseText = '';

                if (run.status === 'completed') {
                    const messages = await openai.beta.threads.messages.list(run.thread_id);
                    // Open users typically want the *latest* assistant message
                    // messages.data is ordered descending by created_at by default
                    const assistantMsg = messages.data.find(m => m.role === 'assistant');

                    if (assistantMsg && assistantMsg.content?.[0]?.type === 'text') {
                        responseText = assistantMsg.content[0].text.value;
                        // Clean up citations regex 【...】
                        responseText = responseText.replace(/【\d+:\d+†source】/g, '');
                        console.log(`[AIAgentExecutor] Assistant Response: "${responseText.substring(0, 50)}..."`);
                    } else {
                        responseText = "(No text response from Assistant)";
                    }
                } else {
                    console.error(`[AIAgentExecutor] Assistant Run Failed. Status: ${run.status}`);
                    // Try to get error details if failed
                    if (run.last_error) {
                        console.error(`[AIAgentExecutor] Error Details: ${JSON.stringify(run.last_error)}`);
                    }
                    responseText = "I'm sorry, I couldn't process that request right now.";
                }

                return {
                    [outputVariableName]: responseText,
                    response: responseText,
                    openai_thread_id: threadId // Save thread ID to context for next turn
                };

            }

            // =======================================================
            // MODE: CHAT COMPLETION (Standard)
            // =======================================================
            else {
                return await this.executeChatCompletion(session, node, model, systemPrompt, outputVariableName, openai, context);
            }

        } catch (e) {
            console.error('[AIAgentExecutor] Error:', e.message);
            return {
                [outputVariableName]: "Error: " + e.message,
                response: "Error: " + e.message
            };
        }
    }

    async getConversationId(session) {
        // Optimization: Use session.contact_phone directly if possible, or query
        const { data: conv } = await supabaseAdmin
            .from('conversations')
            .select('id')
            .eq('user_id', session.user_id)
            .eq('contact_phone', session.contact_phone)
            .maybeSingle();
        return conv?.id;
    }

    async executeChatCompletion(session, node, model, systemPrompt, outputVariableName, openaiClient, context) {
        // 1. Fetch History
        const convId = await this.getConversationId(session);
        let chatHistory = [];

        if (convId) {
            const { data: messages } = await supabaseAdmin
                .from('messages')
                .select('direction, text, type, created_at')
                .eq('conversation_id', convId)
                .order('created_at', { ascending: false })
                .limit(10);
            if (messages) {
                chatHistory = messages.reverse().map(m => ({
                    role: m.direction === 'in' ? 'user' : 'assistant',
                    content: m.text || (m.type === 'image' ? '[Image]' : '[Media]')
                }));
            }
        }

        const messages = [];
        if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
        messages.push(...chatHistory);

        let responseText = '';

        if (model.includes('gemini')) {
            responseText = await this.callGemini(model, messages);
        } else {
            // Use OpenAI SDK or Fallback
            if (openaiClient) {
                try {
                    const completion = await openaiClient.chat.completions.create({
                        messages: messages,
                        model: model || 'gpt-4o',
                    });
                    responseText = completion.choices[0].message.content;
                } catch (err) {
                    console.error('[AIAgentExecutor] OpenAI SDK Error (Chat):', err.message);
                    throw err;
                }
            } else {
                responseText = await this.callOpenAI_Legacy(model, messages);
            }
        }

        console.log(`[AIAgentExecutor] Chat Response: "${responseText.substring(0, 50)}..."`);

        return {
            [outputVariableName]: responseText,
            response: responseText
        };
    }

    // Legacy axios call if OpenAI SDK fails or key missing (fallback)
    async callOpenAI_Legacy(model, messages) {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

        const res = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: model || 'gpt-4o',
            messages: messages
        }, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });

        return res.data.choices[0].message.content;
    }

    async callGemini(model, messages) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

        const contents = [];
        let systemInstruction = null;

        for (const msg of messages) {
            if (msg.role === 'system') {
                systemInstruction = { parts: [{ text: msg.content }] };
            } else {
                contents.push({
                    role: msg.role === 'user' ? 'user' : 'model',
                    parts: [{ text: msg.content }]
                });
            }
        }

        const modelName = model || 'gemini-1.5-pro';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

        const body = { contents };
        if (systemInstruction) body.system_instruction = systemInstruction;

        const res = await axios.post(url, body);
        return res.data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";
    }
}

module.exports = new AIAgentExecutor();
