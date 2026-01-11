
import { Flow, Node, NodeType, Edge } from '../types';

const INITIAL_NODES: Node[] = [
  {
    id: 'on-message-node',
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

const STORAGE_KEY = 'whatsapp_flows';

// Helper for robust unique IDs
const generateId = () => `flow_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

export const flowService = {
  getFlows: async (): Promise<Flow[]> => {
    // Simulate API
    await new Promise(resolve => setTimeout(resolve, 200));
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const parsed = stored ? JSON.parse(stored) : [];
        // Normalize data: ensure all flows have required fields even if created in older versions
        return parsed.map((f: any) => ({
            ...f,
            // Normalize status to Title Case to ensure UI checks work consistently
            status: (f.status && f.status.toLowerCase() === 'published') ? 'Published' : 'Draft',
            updatedAt: f.updatedAt || new Date().toLocaleDateString(),
            description: f.description || 'No description'
        }));
    } catch (e) {
        console.error("Failed to parse flows", e);
        return [];
    }
  },

  getFlow: async (id: string): Promise<Flow | null> => {
    await new Promise(resolve => setTimeout(resolve, 200));
    const flows = await flowService.getFlows();
    return flows.find(f => f.id === id) || null;
  },

  saveFlow: async (flow: Flow): Promise<{ success: boolean }> => {
    await new Promise(resolve => setTimeout(resolve, 400));
    const flows = await flowService.getFlows();
    const index = flows.findIndex(f => f.id === flow.id);
    
    const updatedFlow = { ...flow, updatedAt: new Date().toLocaleDateString() };
    
    if (index >= 0) {
        flows[index] = updatedFlow;
    } else {
        flows.push(updatedFlow);
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(flows));
    return { success: true };
  },

  createFlow: async (): Promise<Flow> => {
    await new Promise(resolve => setTimeout(resolve, 300));
    const newFlow: Flow = {
        id: generateId(),
        name: 'Untitled Flow',
        description: 'No description',
        status: 'Draft',
        updatedAt: new Date().toLocaleDateString(),
        // Deep copy initial nodes to prevent reference sharing
        nodes: JSON.parse(JSON.stringify(INITIAL_NODES)),
        edges: []
    };
    
    const flows = await flowService.getFlows();
    flows.push(newFlow);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(flows));
    
    return newFlow;
  },

  deleteFlow: async (id: string): Promise<boolean> => {
      await new Promise(resolve => setTimeout(resolve, 300));
      const flows = await flowService.getFlows();
      const filtered = flows.filter(f => String(f.id) !== String(id));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      return true;
  }
};
