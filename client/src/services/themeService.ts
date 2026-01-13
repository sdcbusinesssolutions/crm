
import { ThemeConfig } from '../types';
import { tokenService } from './tokenService';

export const PRESETS: ThemeConfig[] = [
    {
        id: 'default',
        name: 'Default',
        buttonStyle: 'rounded',
        maxFileSize: 16,
        sidebarDisplay: 'both',
        appNameType: 'text',
        colors: { brand: '#ea580c', background: '#f8fafc', surface: '#ffffff', text: '#0f172a', sidebarText: '#475569', sidebarActiveBg: '#fff7ed', border: '#e2e8f0', inputBg: '#ffffff' }
    },
    {
        id: 'ocean',
        name: 'Ocean Blue',
        buttonStyle: 'rounded',
        colors: { brand: '#0ea5e9', background: '#f8fafc', surface: '#ffffff', text: '#0c4a6e', sidebarText: '#0369a1', sidebarActiveBg: '#e0f2fe', border: '#e2e8f0', inputBg: '#ffffff' }
    },
    {
        id: 'midnight',
        name: 'Midnight Purple',
        buttonStyle: 'rounded',
        colors: { brand: '#8b5cf6', background: '#0f172a', surface: '#1e293b', text: '#f8fafc', sidebarText: '#94a3b8', sidebarActiveBg: '#2e1065', border: '#334155', inputBg: '#0f172a' }
    },
    {
        id: 'forest',
        name: 'Forest Green',
        buttonStyle: 'rounded',
        colors: { brand: '#10b981', background: '#f8fafc', surface: '#ffffff', text: '#064e3b', sidebarText: '#047857', sidebarActiveBg: '#d1fae5', border: '#e2e8f0', inputBg: '#ffffff' }
    },
    {
        id: 'crimson',
        name: 'Crimson Red',
        buttonStyle: 'rounded',
        colors: { brand: '#e11d48', background: '#fef2f2', surface: '#ffffff', text: '#881337', sidebarText: '#be123c', sidebarActiveBg: '#ffe4e6', border: '#e2e8f0', inputBg: '#ffffff' }
    },
    {
        id: 'royal',
        name: 'Royal Indigo',
        buttonStyle: 'rounded',
        colors: { brand: '#4f46e5', background: '#f8fafc', surface: '#ffffff', text: '#312e81', sidebarText: '#4338ca', sidebarActiveBg: '#e0e7ff', border: '#e2e8f0', inputBg: '#ffffff' }
    },
    {
        id: 'sunset',
        name: 'Sunset Pink',
        buttonStyle: 'rounded',
        colors: { brand: '#db2777', background: '#fff1f2', surface: '#ffffff', text: '#831843', sidebarText: '#be185d', sidebarActiveBg: '#fce7f3', border: '#e2e8f0', inputBg: '#ffffff' }
    },
    {
        id: 'slate',
        name: 'Slate Minimal',
        buttonStyle: 'sharp',
        colors: { brand: '#475569', background: '#f8fafc', surface: '#ffffff', text: '#0f172a', sidebarText: '#334155', sidebarActiveBg: '#e2e8f0', border: '#e2e8f0', inputBg: '#ffffff' }
    }
];

const API_URL = '/api/settings/branding';
const STORAGE_KEY = 'theme_config_cache';

let cachedTheme: ThemeConfig | null = null;
let loadingPromise: Promise<ThemeConfig> | null = null;

const getAuthHeaders = () => {
    const token = tokenService.getAccessToken();
    if (!token) throw new Error('Not authenticated');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
};

export const themeService = {
    getTheme: async (): Promise<ThemeConfig> => {
        if (cachedTheme) return cachedTheme;

        // 1. Check LocalStorage for immediate fallback (prevents FOUC on reload)
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                // We use this immediately but still trigger background fetch to update?
                // For simplicity, we trust local storage and let the background poller update it eventually.
                // Or better: Use it as initial value if fetch fails.

                // Let's optimize: Return cached immediately if available, but maybe we want fresh data?
                // Given the interval polling in Sidebar, it's safer to return stored data first roughly.
                // However, standard pattern: Try fetch, if fail -> fallback.
            } catch (e) {
                console.error("Invalid theme in local storage");
            }
        }

        // Request Deduplication
        if (loadingPromise) return loadingPromise;

        loadingPromise = (async () => {
            try {
                const headers = getAuthHeaders();
                const response = await fetch(API_URL, { headers });
                if (!response.ok) throw new Error('Failed to fetch theme');

                const data = await response.json();
                if (data && data.id) {
                    cachedTheme = data;
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); // Cache it
                    return data;
                }
                throw new Error('Invalid theme data');
            } catch (e) {
                console.error("Failed to load theme", e);

                // Fallback to LocalStorage if fetch fails
                if (stored) {
                    try {
                        const parsed = JSON.parse(stored);
                        cachedTheme = parsed;
                        return parsed;
                    } catch (err) { }
                }

                return PRESETS[0];
            } finally {
                loadingPromise = null;
            }
        })();

        return loadingPromise;
    },

    saveTheme: async (theme: ThemeConfig): Promise<boolean> => {
        cachedTheme = theme;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(theme)); // Update Cache
        themeService.applyTheme(theme);

        try {
            const headers = getAuthHeaders();
            const response = await fetch(API_URL, {
                method: 'PUT',
                headers,
                body: JSON.stringify(theme)
            });

            if (!response.ok) throw new Error('Failed to save theme');
            return true;
        } catch (e) {
            console.error("Failed to save theme", e);
            return false;
        }
    },

    applyTheme: (theme: ThemeConfig): void => {
        const root = document.documentElement;

        // Helper to hex-to-rgb for Tailwind opacity modifiers
        const hexToRgb = (hex: string) => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}` : '0 0 0';
        };

        // Colors
        root.style.setProperty('--color-brand', theme.colors.brand);
        root.style.setProperty('--color-brand-rgb', hexToRgb(theme.colors.brand));
        root.style.setProperty('--color-bg', theme.colors.background);
        root.style.setProperty('--color-surface', theme.colors.surface);
        root.style.setProperty('--color-text', theme.colors.text);
        root.style.setProperty('--color-sidebar-text', theme.colors.sidebarText);
        root.style.setProperty('--color-sidebar-active-bg', theme.colors.sidebarActiveBg);
        root.style.setProperty('--color-border', theme.colors.border || '#e2e8f0');
        root.style.setProperty('--color-input-bg', theme.colors.inputBg || '#ffffff');

        // Button Radius Logic
        const radiusMap = {
            'rounded': '0.75rem', // rounded-xl (12px)
            'sharp': '0.25rem', // rounded (4px) - slightly sharp but friendly
            'pill': '9999px' // full rounded
        };
        root.style.setProperty('--radius-btn', radiusMap[theme.buttonStyle || 'rounded']);

        // Favicon Application
        if (theme.faviconUrl) {
            let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
            if (!link) {
                link = document.createElement('link');
                link.rel = 'icon';
                document.head.appendChild(link);
            }
            link.href = theme.faviconUrl;
        }
    }
};
