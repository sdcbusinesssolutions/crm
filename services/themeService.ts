
import { ThemeConfig } from '../types';

const STORAGE_KEY = 'upshpoi_theme_config';

export const PRESETS: ThemeConfig[] = [
    {
        id: 'default',
        name: 'UpShpoi Default',
        buttonStyle: 'rounded',
        colors: { brand: '#ea580c', background: '#f8fafc', surface: '#ffffff', text: '#0f172a', sidebarText: '#475569', sidebarActiveBg: '#fff7ed' }
    },
    {
        id: 'ocean',
        name: 'Ocean Blue',
        buttonStyle: 'rounded',
        colors: { brand: '#0ea5e9', background: '#f8fafc', surface: '#ffffff', text: '#0c4a6e', sidebarText: '#0369a1', sidebarActiveBg: '#e0f2fe' }
    },
    {
        id: 'midnight',
        name: 'Midnight Purple',
        buttonStyle: 'rounded',
        colors: { brand: '#8b5cf6', background: '#0f172a', surface: '#1e293b', text: '#f8fafc', sidebarText: '#94a3b8', sidebarActiveBg: '#2e1065' }
    },
    {
        id: 'forest',
        name: 'Forest Green',
        buttonStyle: 'rounded',
        colors: { brand: '#10b981', background: '#f8fafc', surface: '#ffffff', text: '#064e3b', sidebarText: '#047857', sidebarActiveBg: '#d1fae5' }
    },
    {
        id: 'crimson',
        name: 'Crimson Red',
        buttonStyle: 'rounded',
        colors: { brand: '#e11d48', background: '#fef2f2', surface: '#ffffff', text: '#881337', sidebarText: '#be123c', sidebarActiveBg: '#ffe4e6' }
    },
    {
        id: 'royal',
        name: 'Royal Indigo',
        buttonStyle: 'rounded',
        colors: { brand: '#4f46e5', background: '#f8fafc', surface: '#ffffff', text: '#312e81', sidebarText: '#4338ca', sidebarActiveBg: '#e0e7ff' }
    },
    {
        id: 'sunset',
        name: 'Sunset Pink',
        buttonStyle: 'rounded',
        colors: { brand: '#db2777', background: '#fff1f2', surface: '#ffffff', text: '#831843', sidebarText: '#be185d', sidebarActiveBg: '#fce7f3' }
    }
];

export const themeService = {
    getTheme: (): ThemeConfig => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (e) {
            console.error("Failed to load theme", e);
        }
        return PRESETS[0];
    },

    saveTheme: (theme: ThemeConfig): void => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
        themeService.applyTheme(theme);
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

        // Button Radius Logic
        const radiusMap = {
            'rounded': '0.75rem', // rounded-xl (12px)
            'sharp': '0.25rem', // rounded (4px) - slightly sharp but friendly
            'pill': '9999px' // full rounded
        };
        root.style.setProperty('--radius-btn', radiusMap[theme.buttonStyle || 'rounded']);
    }
};
