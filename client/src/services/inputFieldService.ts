
import { InputField } from '../types';
import { supabase } from '../lib/supabase';

const getHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
        console.warn("inputFieldService: No access token found in session!");
    }
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || ''}`
    };
};

export const inputFieldService = {
    getInputs: async (): Promise<InputField[]> => {
        try {
            const headers = await getHeaders();
            const res = await fetch('/api/fields', { headers });
            if (!res.ok) throw new Error('Failed to fetch');
            return await res.json();
        } catch (e) {
            console.error("Error fetching fields", e);
            return [];
        }
    },

    saveInput: async (input: InputField): Promise<InputField | null> => {
        try {
            const headers = await getHeaders();
            const res = await fetch('/api/fields', {
                method: 'POST',
                headers,
                body: JSON.stringify(input)
            });
            if (!res.ok) return null;
            return await res.json();
        } catch (e) {
            console.error("Error saving field", e);
            return null;
        }
    },

    deleteInput: async (id: string): Promise<void> => {
        try {
            const headers = await getHeaders();
            await fetch(`/api/fields/${id}`, {
                method: 'DELETE',
                headers
            });
        } catch (e) {
            console.error("Error deleting field", e);
        }
    }
};
