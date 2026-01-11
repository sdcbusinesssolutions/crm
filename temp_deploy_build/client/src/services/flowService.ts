
import { Flow, Node, NodeType, Edge } from '../types';
import { tokenService } from './tokenService';

const getInitialNodes = (): Node[] => [
  {
    id: `OnMessage-${Date.now()}`,
    type: NodeType.OnMessage,
    position: { x: 50, y: 50 },
    data: {
      label: 'On Message',
      messageType: 'Text',
      keywords: [],
      phoneNumbers: []
    },
  }
];

const API_URL = '/api/flows';

const getAuthHeaders = async () => {
  const token = tokenService.getAccessToken();
  if (!token) throw new Error('Not authenticated');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

export const flowService = {
  getFlows: async (): Promise<Flow[]> => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(API_URL, { headers });
      if (!response.ok) throw new Error('Failed to fetch flows');
      const data = await response.json();

      return data.map((f: any) => ({
        ...f,
        status: (f.status && f.status.toLowerCase() === 'published') ? 'Published' : 'Draft',
        updatedAt: new Date(f.updated_at).toLocaleString(),
        description: f.description || 'No description'
      }));
    } catch (e) {
      console.error("Failed to fetch flows", e);
      return [];
    }
  },

  getFlow: async (id: string): Promise<Flow | null> => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/${id}`, { headers });
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error('Failed to fetch flow');
      }
      const f = await response.json();
      return {
        ...f,
        status: (f.status && f.status.toLowerCase() === 'published') ? 'Published' : 'Draft',
        updatedAt: new Date(f.updated_at).toLocaleDateString(),
        description: f.description || 'No description'
      };
    } catch (e) {
      console.error("Failed to fetch flow", e);
      return null;
    }
  },

  saveFlow: async (flow: Flow): Promise<{ success: boolean }> => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/${flow.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          name: flow.name,
          description: flow.description,
          status: flow.status,
          nodes: flow.nodes,
          edges: flow.edges
        })
      });

      if (!response.ok) throw new Error('Failed to save flow');
      return { success: true };
    } catch (e) {
      console.error("Failed to save flow", e);
      return { success: false };
    }
  },

  createFlow: async (initialData?: Partial<Flow>): Promise<Flow> => {
    try {
      const headers = await getAuthHeaders();
      const newFlowData = {
        name: 'Untitled Flow',
        description: 'No description',
        status: 'Draft',
        nodes: getInitialNodes(),
        edges: [],
        ...initialData
      };

      const response = await fetch(API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(newFlowData)
      });

      if (!response.ok) throw new Error('Failed to create flow');
      const f = await response.json();

      return {
        ...f,
        status: (f.status && f.status.toLowerCase() === 'published') ? 'Published' : 'Draft',
        updatedAt: new Date(f.updated_at).toLocaleDateString(),
        description: f.description || 'No description'
      };
    } catch (e) {
      console.error("Failed to create flow", e);
      throw e;
    }
  },

  deleteFlow: async (id: string): Promise<boolean> => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE',
        headers
      });

      if (!response.ok) throw new Error('Failed to delete flow');
      return true;
    } catch (e) {
      console.error("Failed to delete flow", e);
      return false;
    }
  }
};
