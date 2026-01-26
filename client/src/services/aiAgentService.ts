import { supabase } from '../lib/supabase';

// We will use the custom backend API proxy/routes I created.
// Endpoints: /api/ai-agents
// Since we used 'supabaseAdmin' on backend, we can access via authenticated API calls.
// The frontend uses Supabase Auth, so we can use the session token.

const API_BASE = '/api/ai-agents';

export interface Agent {
    id: string;
    name: string;
    description?: string;
    type: 'chat' | 'voice' | 'call';
    system_prompt: string;
    model_config: any;
    created_at: string;
}

export interface KnowledgeDoc {
    id: string;
    file_name: string;
    file_type: string;
    created_at: string;
}

export const aiAgentService = {
    async getSessionToken() {
        const { data } = await supabase.auth.getSession();
        return data.session?.access_token;
    },

    async getHeaders() {
        const token = await this.getSessionToken();
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    },

    async listAgents(): Promise<Agent[]> {
        const headers = await this.getHeaders();
        const res = await fetch(API_BASE, { headers });
        if (!res.ok) throw new Error('Failed to fetch agents');
        return res.json();
    },

    async createAgent(agent: Partial<Agent>): Promise<Agent> {
        const headers = await this.getHeaders();
        const res = await fetch(API_BASE, {
            method: 'POST',
            headers,
            body: JSON.stringify(agent)
        });
        if (!res.ok) throw new Error('Failed to create agent');
        return res.json();
    },

    async updateAgent(id: string, updates: Partial<Agent>): Promise<Agent> {
        const headers = await this.getHeaders();
        const res = await fetch(`${API_BASE}/${id}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(updates)
        });
        if (!res.ok) throw new Error('Failed to update agent');
        return res.json();
    },

    async deleteAgent(id: string): Promise<void> {
        const headers = await this.getHeaders();
        const res = await fetch(`${API_BASE}/${id}`, {
            method: 'DELETE',
            headers
        });
        if (!res.ok) throw new Error('Failed to delete agent');
    },

    async uploadKnowledge(agentId: string, file: File): Promise<KnowledgeDoc> {
        const token = await this.getSessionToken();
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch(`${API_BASE}/${agentId}/knowledge`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
                // Content-Type not set for FormData, browser does it with boundary
            },
            body: formData
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Upload failed');
        }
        return res.json();
    },

    async listKnowledge(agentId: string): Promise<KnowledgeDoc[]> {
        const headers = await this.getHeaders();
        const res = await fetch(`${API_BASE}/${agentId}/knowledge`, { headers });
        if (!res.ok) throw new Error('Failed to list knowledge');
        return res.json();
    },

    async deleteKnowledge(agentId: string, docId: string): Promise<void> {
        const headers = await this.getHeaders();
        const res = await fetch(`${API_BASE}/${agentId}/knowledge/${docId}`, {
            method: 'DELETE',
            headers
        });
        if (!res.ok) throw new Error('Failed to delete knowledge');
    }
};
