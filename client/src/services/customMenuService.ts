import { supabase } from '../lib/supabase';

export interface CustomMenu {
    id: string;
    user_id: string;
    name: string;
    type: string;
    value: string;
    created_at: string;
}

const getHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || ''}`
    };
};

export const customMenuService = {
    getMenus: async (): Promise<CustomMenu[]> => {
        try {
            const headers = await getHeaders();
            const res = await fetch('/api/custom-menus', { headers });
            if (!res.ok) throw new Error('Failed to fetch custom menus');
            return await res.json();
        } catch (e) {
            console.error('Error fetching custom menus:', e);
            return [];
        }
    },
    
    createMenu: async (data: { name: string; type: string; value: string }): Promise<CustomMenu | null> => {
        try {
            const headers = await getHeaders();
            const res = await fetch('/api/custom-menus', {
                method: 'POST',
                headers,
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Failed to create custom menu');
            return await res.json();
        } catch (e) {
            console.error('Error creating custom menu:', e);
            return null;
        }
    },
    
    deleteMenu: async (id: string): Promise<boolean> => {
        try {
            const headers = await getHeaders();
            const res = await fetch(`/api/custom-menus/${id}`, {
                method: 'DELETE',
                headers
            });
            return res.ok;
        } catch (e) {
            console.error('Error deleting custom menu:', e);
            return false;
        }
    }
};
