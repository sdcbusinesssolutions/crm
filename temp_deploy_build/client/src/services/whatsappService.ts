
import { WhatsAppNumber } from '../types';

const STORAGE_KEY = 'whatsapp_numbers';

export const whatsappService = {
    getNumbers: async (): Promise<WhatsAppNumber[]> => {
        await new Promise(resolve => setTimeout(resolve, 300)); // Simulate latency
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            console.error("Failed to load WhatsApp numbers", e);
            return [];
        }
    },

    saveNumber: async (num: WhatsAppNumber): Promise<void> => {
        await new Promise(resolve => setTimeout(resolve, 300));
        const numbers = await whatsappService.getNumbers();
        const index = numbers.findIndex(n => n.id === num.id);
        
        if (index >= 0) {
            numbers[index] = num;
        } else {
            numbers.push(num);
        }
        
        localStorage.setItem(STORAGE_KEY, JSON.stringify(numbers));
    },

    deleteNumber: async (id: string): Promise<void> => {
        await new Promise(resolve => setTimeout(resolve, 300));
        const numbers = await whatsappService.getNumbers();
        const filtered = numbers.filter(n => String(n.id) !== String(id));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    }
};
