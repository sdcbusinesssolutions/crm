import React, { createContext, useContext, useEffect, useState } from 'react';

interface DomainSettings {
    brand_name: string;
    logo_url: string | null;
    favicon_url?: string | null;
    primary_color: string;
    secondary_color?: string;
    support_email?: string;
}

interface ThemeContextType {
    settings: DomainSettings;
    loading: boolean;
}

const defaultSettings: DomainSettings = {
    brand_name: 'App',
    logo_url: null,
    primary_color: '#ea580c', // Fallback Orange (original app color)
};

const ThemeContext = createContext<ThemeContextType>({
    settings: defaultSettings,
    loading: true,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [settings, setSettings] = useState<DomainSettings>(defaultSettings);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                // Determine domain (handle localhost with environment var fallback or mocked)
                let domain = window.location.hostname;
                if (domain.includes('localhost')) {
                    // For dev, try to read from env or default to clickube
                    domain = 'clickube.com';
                }

                const res = await fetch(`/api/public-settings?domain=${domain}`);
                if (res.ok) {
                    const data = await res.json();
                    setSettings(data);

                    // Apply CSS Variables Dynamically
                    if (data.primary_color) {
                        document.documentElement.style.setProperty('--color-brand-600', data.primary_color);
                        // Simple logic to generate lighter/darker shades could go here
                        // For now we assume the main brand color is what matters
                    }

                    // Update Title
                    if (data.brand_name) {
                        document.title = data.brand_name;
                    }

                    // Update Favicon (Optional)
                    if (data.favicon_url) {
                        const link: any = document.querySelector("link[rel*='icon']") || document.createElement('link');
                        link.type = 'image/x-icon';
                        link.rel = 'shortcut icon';
                        link.href = data.favicon_url;
                        document.getElementsByTagName('head')[0].appendChild(link);
                    }
                }
            } catch (err) {
                console.error('Failed to load theme:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchSettings();
    }, []);

    return (
        <ThemeContext.Provider value={{ settings, loading }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);
