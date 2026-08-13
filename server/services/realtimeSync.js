class RealtimeSync {
    constructor() {
        this.io = null;
    }

    init(io) {
        this.io = io;
        console.log('[RealtimeSync] Initialized local Socket.IO emitter (Supabase Realtime disabled for cost savings).');
    }

    emitMessage(userId, message, eventType = 'INSERT') {
        if (!this.io || !userId) return;
        this.io.to(userId).emit('postgres_changes_messages', { eventType, new: message });
    }

    emitConversation(userId, conversation, eventType = 'UPDATE') {
        if (!this.io || !userId) return;
        this.io.to(userId).emit('postgres_changes_conversations', { eventType, new: conversation });
    }

    emitQuickReply(userId, quickReply, eventType = 'INSERT') {
        if (!this.io || !userId) return;
        this.io.to(userId).emit('postgres_changes_quick_replies', { eventType, new: quickReply });
    }

    emitTaskAlarm(userId, taskData) {
        if (!this.io || !userId) return;
        this.io.to(userId).emit('task_alarm', taskData);
    }

    async isUserConnected(userId) {
        if (!this.io || !userId) return false;
        try {
            const sockets = await this.io.in(userId).fetchSockets();
            return sockets.length > 0;
        } catch (e) {
            console.error('[RealtimeSync] Error checking user connection:', e);
            return false;
        }
    }
}

// Export as singleton so any route can import it and emit events
module.exports = new RealtimeSync();
