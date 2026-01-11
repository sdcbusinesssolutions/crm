import { Conversation, Message } from '../types';
import { tokenService } from './tokenService';

const API_BASE = '/api/inbox';

const getAuthHeaders = () => {
    const token = tokenService.getAccessToken();
    if (!token) throw new Error('Not authenticated');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
};

export const inboxService = {
    getConversations: async (): Promise<Conversation[]> => {
        try {
            const headers = getAuthHeaders();
            const response = await fetch(`${API_BASE}/conversations`, { headers });
            if (!response.ok) throw new Error('Failed to fetch conversations');
            return await response.json();
        } catch (e) {
            console.error("Failed to load conversations", e);
            return [];
        }
    },

    getMessages: async (conversationId: string): Promise<Message[]> => {
        try {
            const headers = getAuthHeaders();
            const response = await fetch(`${API_BASE}/messages/${conversationId}`, { headers });
            if (!response.ok) throw new Error('Failed to fetch messages');
            return await response.json();
        } catch (e) {
            console.error("Failed to load messages", e);
            return [];
        }
    },

    sendMessage: async (conversationId: string, data: { text?: string, type?: string, media_url?: string }): Promise<Message | null> => {
        try {
            const headers = getAuthHeaders();
            const response = await fetch(`${API_BASE}/messages/${conversationId}`, {
                method: 'POST',
                headers,
                body: JSON.stringify(data)
            });

            if (!response.ok) throw new Error('Failed to send message');
            return await response.json();
        } catch (e) {
            console.error("Failed to send message", e);
            return null;
        }
    },

    uploadMedia: async (file: File): Promise<string | null> => {
        try {
            const formData = new FormData();
            formData.append('file', file);

            const token = tokenService.getAccessToken();
            if (!token) throw new Error('Not authenticated');

            const response = await fetch(`${API_BASE}/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (!response.ok) throw new Error('Failed to upload media');
            const data = await response.json();
            return data.url;
        } catch (e) {
            console.error("Failed to upload media", e);
            return null;
        }
    },

    markAsRead: async (conversationId: string): Promise<boolean> => {
        try {
            const headers = getAuthHeaders();
            const response = await fetch(`${API_BASE}/conversations/${conversationId}/read`, {
                method: 'POST',
                headers
            });
            return response.ok;
        } catch (e) {
            console.error("Failed to mark as read", e);
            return false;
        }
    }
};
