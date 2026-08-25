import { CustomMenu } from './customMenuService';

const getAdminHeaders = () => {
    const token = localStorage.getItem('adminToken');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || ''}`
    };
};

export const adminCustomMenuService = {
    getMenus: async (): Promise<CustomMenu[]> => {
        try {
            const headers = getAdminHeaders();
            const res = await fetch('/api/admin/custom-menus', { headers });
            if (!res.ok) throw new Error('Failed to fetch admin custom menus');
            return await res.json();
        } catch (e) {
            console.error('Error fetching admin custom menus:', e);
            return [];
        }
    },
    
    createMenu: async (data: { name: string; type: string; value: string }): Promise<CustomMenu | null> => {
        try {
            const headers = getAdminHeaders();
            const res = await fetch('/api/admin/custom-menus', {
                method: 'POST',
                headers,
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Failed to create admin custom menu');
            return await res.json();
        } catch (e) {
            console.error('Error creating admin custom menu:', e);
            return null;
        }
    },
    
    deleteMenu: async (id: string): Promise<boolean> => {
        try {
            const headers = getAdminHeaders();
            const res = await fetch(`/api/admin/custom-menus/${id}`, {
                method: 'DELETE',
                headers
            });
            return res.ok;
        } catch (e) {
            console.error('Error deleting admin custom menu:', e);
            return false;
        }
    }
};
