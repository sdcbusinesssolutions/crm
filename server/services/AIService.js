const OpenAI = require('openai');
const { supabaseAdmin } = require('../lib/supabaseClient'); // Import Supabase Admin for DB lookups

class AIService {
    constructor() {
        this.openai = null;
        this.isConfigured = false;
        this._initialize();
    }

    _initialize() {
        const apiKey = process.env.OPENAI_API_KEY;
        if (apiKey) {
            this.openai = new OpenAI({ apiKey });
            this.isConfigured = true;
            console.log('[AIService] Initialized with API Key');
        } else {
            console.warn('[AIService] Missing OPENAI_API_KEY environment variable. AI features disabled.');
        }
    }

    /**
     * Analyze user reply and classify potential intent
     * @param {string} userReply - The text message received from user
     * @param {string[]} intents - List of possible intents
     * @param {string} mode - 'OPENAI' (Smart) or 'KEYWORD' (Basic)
     * @param {string} userId - Optional: The user ID to fetch custom API keys for
     * @returns {Promise<string>} - The classified intent
     */
    async analyzeIntent(userReply, intents = ['INTERESTED', 'NOT_INTERESTED', 'QUESTION', 'OTHER'], mode = 'KEYWORD', userId = null, connectionId = null) {
        const cleanReply = userReply?.toLowerCase().trim() || '';

        // MODE 1: KEYWORD MATCHING (Basic/Free)
        if (mode === 'KEYWORD') {
            console.log(`[AIService] Using KEYWORD mode for reply: "${cleanReply.substring(0, 20)}..."`);

            // Priority 1: Negatives (Stop/Not Interested)
            if (['stop', 'unsubscribe', 'remove', 'not interested', 'hate', 'spam', 'no thanks', 'do not call'].some(w => cleanReply.includes(w))) {
                return 'NOT_INTERESTED';
            }

            // Priority 2: Positives (Interested/Yes)
            if (['yes', 'interested', 'price', 'cost', 'buy', 'schedule', 'book', 'demo', 'call me', 'sign up'].some(w => cleanReply.includes(w))) {
                return 'INTERESTED';
            }

            // Priority 3: Deferral (Later)
            if (['later', 'busy', 'tomorrow', 'next week', 'not now', 'call back'].some(w => cleanReply.includes(w))) {
                return 'LATER';
            }

            // Priority 4: Questions
            if (cleanReply.includes('?') || ['what', 'how', 'where', 'when', 'who', 'why'].some(w => cleanReply.includes(w))) {
                return 'QUESTION';
            }

            return 'OTHER';
        }

        // MODE 2: OPENAI (Smart)
        try {
            // 1. Determine API Key
            let apiKey = process.env.OPENAI_API_KEY;
            let openaiClient = this.openai; // Default client

            if (connectionId) {
                // CASE A: Specific Connection Selected
                const { data: interaction } = await supabaseAdmin
                    .from('user_integrations')
                    .select('credentials')
                    .eq('id', connectionId)
                    .single();

                if (interaction?.credentials?.apiKey) {
                    console.log(`[AIService] Using Selected OpenAI Connection (ID: ${connectionId})`);
                    apiKey = interaction.credentials.apiKey;
                    openaiClient = new OpenAI({ apiKey });
                }
            } else if (userId) {
                // CASE B: Fallback to Any User Key
                const { data: interaction } = await supabaseAdmin
                    .from('user_integrations')
                    .select('credentials')
                    .eq('user_id', userId)
                    .eq('provider', 'openai')
                    .limit(1)
                    .maybeSingle();

                if (interaction?.credentials?.apiKey) {
                    console.log(`[AIService] Using Default User OpenAI Key for User ${userId}`);
                    apiKey = interaction.credentials.apiKey;
                    openaiClient = new OpenAI({ apiKey });
                }
            }

            if (!apiKey || !openaiClient) {
                console.warn('[AIService] No OpenAI Key found (System or User). Falling back to KEYWORD.');
                return this.analyzeIntent(userReply, intents, 'KEYWORD');
            }

            const prompt = `
            You are a sales assistant analyzing a customer's reply to a drip campaign message.
            
            Customer Reply: "${userReply}"
            
            Task: Classify this reply into exactly one of the following categories:
            ${intents.map(i => `- ${i}`).join('\n')}
            
            Rules:
            1. Return ONLY the category name. No explanation.
            2. If uncertain, choose 'OTHER'.
            3. If the user asks a question, choose 'QUESTION'.
            `;

            const completion = await openaiClient.chat.completions.create({
                model: "gpt-4o-mini", // Using a cost-effective model
                messages: [{ role: "user", content: prompt }],
                max_tokens: 10,
                temperature: 0.3,
            });

            const result = completion.choices[0].message.content.trim().toUpperCase();

            // Validate result is in allowed list
            if (intents.includes(result)) {
                return result;
            }
            return 'OTHER';

        } catch (error) {
            console.error('[AIService] OpenAI Analysis failed (falling back to KEYWORD):', error.message);
            // Fallback to keyword if API fails
            return this.analyzeIntent(userReply, intents, 'KEYWORD');
        }
    }

    /**
     * Generate a smart reply based on context
     * @param {string} context - Previous message or campaign context
     * @param {string} userReply - The user's message
     * @returns {Promise<string>} - Suggested reply
     */
    async generateReply(context, userReply) {
        if (!this.isConfigured) return null;

        try {
            const completion = await this.openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: "You are a helpful sales assistant. Draft a short, professional, and friendly response to the customer." },
                    { role: "user", content: `Context: ${context}\nCustomer: ${userReply}\n\nDraft Reply:` }
                ],
                max_tokens: 100,
                temperature: 0.7,
            });

            return completion.choices[0].message.content.trim();
        } catch (error) {
            console.error('[AIService] Reply generation failed:', error);
            return null;
        }
    }
}

module.exports = new AIService();
