const getAdminHeaders = () => {
    const token = localStorage.getItem('adminToken');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || ''}`
    };
};

export interface GlobalVideoGuide {
    id: string;
    module_name: string;
    video_url: string;
    is_active: boolean;
    created_at: string;
}

export const superVideoGuideService = {
    getGuides: async (): Promise<GlobalVideoGuide[]> => {
        try {
            const res = await fetch('/api/admin/super/video-guides', { headers: getAdminHeaders() });
            if (!res.ok) throw new Error('Failed to fetch global video guides');
            return await res.json();
        } catch (e) {
            console.error(e);
            return [];
        }
    },
    
    saveGuide: async (module_name: string, video_url: string, is_active: boolean = true): Promise<GlobalVideoGuide | null> => {
        try {
            const res = await fetch('/api/admin/super/video-guides', {
                method: 'POST',
                headers: getAdminHeaders(),
                body: JSON.stringify({ module_name, video_url, is_active })
            });
            if (!res.ok) throw new Error('Failed to save global video guide');
            return await res.json();
        } catch (e) {
            console.error(e);
            return null;
        }
    },

    toggleActive: async (id: string, is_active: boolean): Promise<boolean> => {
        try {
            const res = await fetch(`/api/admin/super/video-guides/${id}/toggle`, {
                method: 'PUT',
                headers: getAdminHeaders(),
                body: JSON.stringify({ is_active })
            });
            return res.ok;
        } catch (e) {
            console.error(e);
            return false;
        }
    },

    deleteGuide: async (id: string): Promise<boolean> => {
        try {
            const res = await fetch(`/api/admin/super/video-guides/${id}`, {
                method: 'DELETE',
                headers: getAdminHeaders()
            });
            return res.ok;
        } catch (e) {
            console.error(e);
            return false;
        }
    }
};
