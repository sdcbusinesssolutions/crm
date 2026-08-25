import { supabase } from '../lib/supabase';

const getHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || ''}`
    };
};

export const videoGuideService = {
    getGuideUrl: async (moduleName: string): Promise<string | null> => {
        try {
            const headers = await getHeaders();
            const res = await fetch(`/api/video-guides/${moduleName}`, { headers });
            if (!res.ok) throw new Error('Failed to fetch video guide');
            const data = await res.json();
            return data.video_url || null;
        } catch (e) {
            console.error('Error fetching video guide:', e);
            return null;
        }
    }
};
