import { supabase } from '../lib/supabase';

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
    async getTags(): Promise<Tag[]> {
        const { data: tags, error } = await supabase
            .from('tags')
            .select('*')
            .order('name', { ascending: true });

        if (error) throw error;

        // Optional: Get counts (could be slow if many contacts)
        // For now, simpler to just list tags. 
        // A more performant way to get counts would be a separate RPC or keeping a counter.
        // We will mock count or fetch it if needed.

        return tags || [];
    },

    async saveTag(tag: Partial<Tag>): Promise<Tag> {
        // Prepare data (remove count/id if needed or handle updates)
        const tagData = {
            name: tag.name,
            description: tag.description,
            color: tag.color
        };

        if (tag.id && !tag.id.startsWith('temp-')) {
            // Update
            const { data, error } = await (supabase
                .from('tags') as any)
                .update(tagData)
                .eq('id', tag.id)
                .select()
                .single();
            if (error) throw error;
            return data;
        } else {
            // Insert
            const { data, error } = await (supabase
                .from('tags') as any)
                .insert([{
                    name: tag.name,
                    description: tag.description,
                    color: tag.color || '#10b981',
                    user_id: (await supabase.auth.getUser()).data.user?.id
                }])
                .select()
                .single();
            if (error) throw error;
            return data;
        }
    },

    async deleteTag(id: string): Promise<void> {
        const { error } = await supabase
            .from('tags')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },

    async getContactsByTag(tagName: string, page: number = 1, limit: number = 20): Promise<{ contacts: any[], total: number }> {
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        // Filter contacts where tags array contains tagName
        const { data, error, count } = await supabase
            .from('contacts')
            .select('*', { count: 'exact' })
            .contains('tags', [tagName])
            .range(from, to)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return { contacts: data || [], total: count || 0 };
    },

    async getLastContactTime(tagName: string): Promise<string | null> {
        const { data, error } = await supabase
            .from('contacts')
            .select('created_at')
            .contains('tags', [tagName])
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
            .contains('tags', [tagName]);

        if (error) {
            console.error(`Error fetching count for tag ${tagName}:`, error);
            return 0;
        }
        return count || 0;
    }
};
