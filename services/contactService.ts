
import { Contact } from '../types';

const STORAGE_KEY = 'whatsapp_contacts';

export const contactService = {
    getContacts: async (): Promise<Contact[]> => {
        await new Promise(resolve => setTimeout(resolve, 300)); // Simulate latency
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            console.error("Failed to load contacts", e);
            return [];
        }
    },

    saveContact: async (contact: Contact): Promise<void> => {
        await new Promise(resolve => setTimeout(resolve, 300));
        const contacts = await contactService.getContacts();
        const index = contacts.findIndex(c => c.id === contact.id);

        if (index >= 0) {
            contacts[index] = contact;
        } else {
            contacts.push(contact);
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts));
    },

    bulkSaveContacts: async (newContacts: Contact[]): Promise<void> => {
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate longer processing
        const existingContacts = await contactService.getContacts();
        const merged = [...existingContacts, ...newContacts];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    },

    deleteContact: async (id: string): Promise<void> => {
        await new Promise(resolve => setTimeout(resolve, 300));
        const contacts = await contactService.getContacts();
        const filtered = contacts.filter(c => String(c.id) !== String(id));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    },

    bulkDeleteContacts: async (ids: string[]): Promise<void> => {
        await new Promise(resolve => setTimeout(resolve, 500));
        const contacts = await contactService.getContacts();
        const idSet = new Set(ids.map(String));
        const filtered = contacts.filter(c => !idSet.has(String(c.id)));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    }
};
