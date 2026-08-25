const getAdminHeaders = () => {
    const token = localStorage.getItem('adminToken');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || ''}`
    };
};

export interface TenantVideoGuide {
    id: string;
    module_name: string;
    global_video_url: string;
    override_video_url: string | null;
    has_override: boolean;
}

export const tenantVideoGuideService = {
    getGuides: async (): Promise<TenantVideoGuide[]> => {
        try {
            const res = await fetch('/api/admin/video-guides', { headers: getAdminHeaders() });
            if (!res.ok) throw new Error('Failed to fetch tenant video guides');
            return await res.json();
        } catch (e) {
            console.error(e);
            return [];
        }
    },
    
    saveOverride: async (module_name: string, video_url: string): Promise<any> => {
        try {
            const res = await fetch('/api/admin/video-guides', {
                method: 'POST',
                headers: getAdminHeaders(),
                body: JSON.stringify({ module_name, video_url })
            });
            if (!res.ok) throw new Error('Failed to save video guide override');
            return await res.json();
        } catch (e) {
            console.error(e);
            return null;
        }
    },

    removeOverride: async (module_name: string): Promise<boolean> => {
        try {
            const res = await fetch(`/api/admin/video-guides/${module_name}`, {
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
