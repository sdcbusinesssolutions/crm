
import { ContactGroup } from '../types';

const STORAGE_KEY = 'whatsapp_contact_groups';

export const contactGroupService = {
    getGroups: async (): Promise<ContactGroup[]> => {
        await new Promise(resolve => setTimeout(resolve, 200));
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            const parsed = stored ? JSON.parse(stored) : [];
            // Normalize data
            return parsed.map((g: any) => ({
                ...g,
                status: g.status || 'Active',
                description: g.description || ''
            }));
        } catch (e) {
            return [];
        }
    },

    saveGroup: async (group: ContactGroup): Promise<void> => {
        await new Promise(resolve => setTimeout(resolve, 200));
        const groups = await contactGroupService.getGroups();
        const index = groups.findIndex(g => g.id === group.id);
        
        if (index >= 0) {
            groups[index] = group;
        } else {
            groups.push(group);
        }
        
        localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
    },

    deleteGroup: async (id: string): Promise<void> => {
        await new Promise(resolve => setTimeout(resolve, 200));
        const groups = await contactGroupService.getGroups();
        const filtered = groups.filter(g => g.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    }
};
