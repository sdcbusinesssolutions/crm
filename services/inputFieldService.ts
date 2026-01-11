
import { InputField } from '../types';

const STORAGE_KEY = 'whatsapp_input_fields';

export const inputFieldService = {
    getInputs: async (): Promise<InputField[]> => {
        await new Promise(resolve => setTimeout(resolve, 200));
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            return [];
        }
    },

    saveInput: async (input: InputField): Promise<void> => {
        await new Promise(resolve => setTimeout(resolve, 200));
        const inputs = await inputFieldService.getInputs();
        const index = inputs.findIndex(i => i.id === input.id);
        
        if (index >= 0) {
            inputs[index] = input;
        } else {
            inputs.push(input);
        }
        
        localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs));
    },

    deleteInput: async (id: string): Promise<void> => {
        await new Promise(resolve => setTimeout(resolve, 200));
        const inputs = await inputFieldService.getInputs();
        const filtered = inputs.filter(i => i.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    }
};
