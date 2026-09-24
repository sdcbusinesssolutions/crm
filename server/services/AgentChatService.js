class AgentChatService {
    async processChat(agent, message, history = [], options = {}) {
        return { success: true, reply: "I am a stub agent." };
    }

    async analyzeLead(agent, conversationId, history, userMessage, aiResponse) {
        // Stub method to prevent errors
    }
}

module.exports = new AgentChatService();
