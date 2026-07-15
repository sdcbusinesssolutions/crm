const { supabaseAdmin } = require('../lib/supabaseClient');
const axios = require('axios');

class CampaignAIService {
    static async generateBulkRows(userId, baseConfig, userPrompt) {
        // 1. Get user integrations
        const { data: integrations } = await supabaseAdmin
            .from('user_integrations')
            .select('provider, credentials')
            .eq('user_id', userId)
            .in('provider', ['openrouter', 'openai', 'gemini']);

        // 2. Get ai_agents fallback (in case they configured it in the Agent builder)
        const { data: agents } = await supabaseAdmin
            .from('ai_agents')
            .select('model_config')
            .eq('user_id', userId);

        let provider = null;
        let apiKey = null;

        if (integrations && integrations.length > 0) {
            // prioritize openrouter > openai > gemini
            const pref = integrations.find(i => i.provider === 'openrouter') 
                || integrations.find(i => i.provider === 'openai') 
                || integrations.find(i => i.provider === 'gemini');
            if (pref) {
                provider = pref.provider;
                apiKey = pref.credentials?.apiKey;
            }
        }

        // Fallback to AI Agents
        if (!apiKey && agents && agents.length > 0) {
            const agentWithKey = agents.find(a => a.model_config?.api_key);
            if (agentWithKey) {
                provider = agentWithKey.model_config.provider || 'openai';
                apiKey = agentWithKey.model_config.api_key;
            }
        }

        // Fallback to system env
        if (!apiKey) {
            if (process.env.OPENROUTER_API_KEY) {
                provider = 'openrouter';
                apiKey = process.env.OPENROUTER_API_KEY;
            } else if (process.env.OPENAI_API_KEY) {
                provider = 'openai';
                apiKey = process.env.OPENAI_API_KEY;
            } else if (process.env.GEMINI_API_KEY) {
                provider = 'gemini';
                apiKey = process.env.GEMINI_API_KEY;
            }
        }

        if (!apiKey) {
            throw new Error('No AI Provider configured. Please add OpenRouter, OpenAI, or Gemini integration.');
        }

        const systemPrompt = `You are an Expert Digital Marketing AI Assistant. Your task is to help the user scale their Facebook/WhatsApp ad campaigns through bulk duplication.
The user will provide you with a "Base Campaign Template" (which includes their default location, age, and budget) and a specific request.
You must return ONLY a raw JSON array of "AdSet" objects based on their request. 
Each object in the array must perfectly match this schema:
{
  "id": "A unique string (e.g. adset_1)",
  "name": "A descriptive name (e.g. Mumbai - 18-35)",
  "location": "The city, state, or country",
  "age": "The age range formatted as MIN-MAX (e.g. 18-65)",
  "budget": "A numeric string for the daily budget (e.g. 500)",
  "creativesCount": 4
}
Rules:
1. Always generate exactly the number of variations the user asks for.
2. If testing cities, keep the age and budget the same as the base template, but change the location and name.
3. If testing age groups, keep the location the same, but change the age and name.
4. Output ONLY valid, raw JSON array. NO MARKDOWN. NO CODE BLOCKS. Start with [ and end with ].`;

        let baseLocation = baseConfig.targetCountries;
        if (Array.isArray(baseLocation)) {
            baseLocation = baseLocation.length > 0 ? baseLocation[0].name || baseLocation[0] : 'Delhi';
        }

        const userMessage = `Base Template:
Location: ${baseLocation}
Age: ${baseConfig.minAge || 18}-${baseConfig.maxAge || 65}
Budget: ${baseConfig.dailyBudget || 500}

User Request: "${userPrompt}"`;

        let resultText = '';

        if (provider === 'openai' || provider === 'openrouter') {
            const endpoint = provider === 'openai' ? 'https://api.openai.com/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions';
            const defaultModel = provider === 'openai' ? 'gpt-4o' : 'openai/gpt-4o';
            
            const payload = {
                model: defaultModel,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userMessage }
                ],
                temperature: 0.7
            };

            const headers = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
            if (provider === 'openrouter') {
                headers['HTTP-Referer'] = 'http://localhost:3000';
                headers['X-Title'] = 'WPCode AI Generator';
            }

            const response = await axios.post(endpoint, payload, { headers });
            resultText = response.data.choices[0].message.content;
        } else if (provider === 'gemini') {
            const payload = {
                contents: [
                    { role: 'user', parts: [{ text: systemPrompt + "\n\n" + userMessage }] }
                ]
            };
            const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, payload);
            resultText = response.data.candidates[0].content.parts[0].text;
        }

        // Clean up markdown block if the model included it despite the instructions
        resultText = resultText.trim();
        if (resultText.startsWith('```json')) resultText = resultText.substring(7);
        else if (resultText.startsWith('```')) resultText = resultText.substring(3);
        if (resultText.endsWith('```')) resultText = resultText.substring(0, resultText.length - 3);

        return JSON.parse(resultText.trim());
    }
}
module.exports = CampaignAIService;
