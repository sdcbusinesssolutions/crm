import { Flow, Node, NodeType, AnyNodeData } from '../types';
import { tokenService } from './tokenService';

const API_URL = '/api/quick-replies';

const getAuthHeaders = async () => {
    const token = tokenService.getAccessToken();
    if (!token) throw new Error('Not authenticated');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
};

let quickRepliesCache: Flow[] | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 30000; // 30 seconds

export const quickReplyService = {
    getQuickReplies: async (forceRefresh: boolean = false): Promise<Flow[]> => {
        const now = Date.now();
        if (!forceRefresh && quickRepliesCache && (now - lastFetchTime < CACHE_DURATION)) {
            return quickRepliesCache;
        }

        try {
            const headers = await getAuthHeaders();
            const response = await fetch(API_URL, { headers });
            if (!response.ok) throw new Error('Failed to fetch quick replies');
            const data = await response.json();

            const processedData = data.map((f: any) => ({
                ...f,
                status: 'Published',
                updatedAt: new Date(f.updated_at).toLocaleString(),
            }));

            quickRepliesCache = processedData;
            lastFetchTime = now;
            return processedData;
        } catch (e) {
            console.error("Failed to fetch quick replies", e);
            return quickRepliesCache || [];
        }
    },

    createQuickReply: async (name: string, type: NodeType, data: AnyNodeData): Promise<Flow> => {
        try {
            const headers = await getAuthHeaders();
            const newNode: Node = {
                id: `${type}-${Date.now()}`,
                type,
                position: { x: 0, y: 0 },
                data: {
                    label: name,
                    ...data
                }
            };

            const body = {
                name,
                nodes: [newNode],
                edges: []
            };

            const response = await fetch(API_URL, {
                method: 'POST',
                headers,
                body: JSON.stringify(body)
            });

            if (!response.ok) throw new Error('Failed to create quick reply');
            const f = await response.json();
            quickRepliesCache = null; // Invalidate cache
            return f;
        } catch (e) {
            console.error("Failed to create quick reply", e);
            throw e;
        }
    },

    updateQuickReply: async (id: string, name: string, data: AnyNodeData): Promise<Flow> => {
        try {
            const headers = await getAuthHeaders();
            // Fetch current to maintain IDs using the quick-replies endpoint
            const response1 = await fetch(`${API_URL}/${id}`, { headers });
            const current = await response1.json();
            
            const newNode: Node = {
                ...current.nodes[0],
                data: {
                    ...current.nodes[0].data,
                    ...data,
                    label: name
                }
            };

            const body = {
                name,
                nodes: [newNode],
                edges: current.edges || []
            };

            const response2 = await fetch(`${API_URL}/${id}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(body)
            });

            if (!response2.ok) throw new Error('Failed to update quick reply');
            const f = await response2.json();
            quickRepliesCache = null; // Invalidate cache
            return f;
        } catch (e) {
            console.error("Failed to update quick reply", e);
            throw e;
        }
    },

    deleteQuickReply: async (id: string): Promise<boolean> => {
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/${id}`, {
                method: 'DELETE',
                headers
            });

            if (!response.ok) throw new Error('Failed to delete quick reply');
            quickRepliesCache = null; // Invalidate cache
            return true;
        } catch (e) {
            console.error("Failed to delete quick reply", e);
            return false;
        }
    },

    sendQuickReply: async (id: string, to: string): Promise<boolean> => {
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/${id}/test-send`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ to })
            });

            if (!response.ok) throw new Error('Failed to send quick reply');
            return true;
        } catch (e) {
            console.error("Failed to send quick reply", e);
            return false;
        }
    }
};
