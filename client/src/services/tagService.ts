import { supabase } from '../lib/supabase';
import { tokenService } from './tokenService';

export interface Tag {
    id: string;
    name: string;
    description?: string;
    color?: string;
    created_at?: string;
    updated_at?: string;
    count?: number; // Optional count of contacts
}

export const tagService = {
    async getAuthHeaders() {
        const token = tokenService.getAccessToken();
        if (token) {
            return {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            };
        }
        
        // Fallback to Supabase session for owners if token is missing
        const { data: { session } } = await supabase.auth.getSession();
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token || ''}`
        };
    },

    async getTags(): Promise<Tag[]> {
        try {
            const headers = await this.getAuthHeaders();
            const res = await fetch('/api/tags', { headers });
            if (!res.ok) throw new Error('Failed to fetch tags');
            return await res.json();
        } catch (e) {
            console.error("Error fetching tags", e);
            return [];
        }
    },

    async saveTag(tag: Partial<Tag>): Promise<Tag> {
        try {
            const headers = await this.getAuthHeaders();
            const tagData = {
                name: tag.name,
                description: tag.description,
                color: tag.color
            };

            const isUpdate = tag.id && !tag.id.startsWith('temp-');
            const url = isUpdate ? `/api/tags/${tag.id}` : '/api/tags';
            
            // If it's a temporary tag we're customizing (e.g. from a legacy contact), 
            // the backend handles the 'temp-' prefix automatically in PUT by inserting it.
            const method = tag.id ? 'PUT' : 'POST'; 
            
            const response = await fetch(tag.id ? `/api/tags/${tag.id}` : '/api/tags', {
                method,
                headers,
                body: JSON.stringify(tagData)
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || 'Failed to save tag');
            }

            return await response.json();
        } catch (e) {
            console.error("Error saving tag:", e);
            throw e;
        }
    },

    async deleteTag(id: string): Promise<void> {
        try {
            const headers = await this.getAuthHeaders();
            const response = await fetch(`/api/tags/${id}`, {
                method: 'DELETE',
                headers
            });
            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || 'Failed to delete tag');
            }
        } catch (e) {
            console.error("Error deleting tag:", e);
            throw e;
        }
    },

    async getContactsByTag(tagName: string, page: number = 1, limit: number = 20): Promise<{ contacts: any[], total: number }> {
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        // Filter contacts where tags array contains tagName
        const { data, error, count } = await supabase
            .from('contacts')
            .select('*', { count: 'exact' })
            .filter('tags', 'cs', JSON.stringify([tagName]))
            .range(from, to)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return { contacts: data || [], total: count || 0 };
    },

    async getLastContactTime(tagName: string): Promise<string | null> {
        const { data, error } = await supabase
            .from('contacts')
            .select('created_at')
            .filter('tags', 'cs', JSON.stringify([tagName]))
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error(`Error fetching last contact time for tag ${tagName}:`, error);
            return null;
        }
        return (data as any)?.created_at || null;
    },
    
    async getContactCount(tagName: string): Promise<number> {
        const { count, error } = await supabase
            .from('contacts')
            .select('*', { count: 'exact', head: true })
            .filter('tags', 'cs', JSON.stringify([tagName]));

        if (error) {
            console.error(`Error fetching count for tag ${tagName}:`, error);
            return 0;
        }
        return count || 0;
    }
};
