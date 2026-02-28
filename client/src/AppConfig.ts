
// Define the shape of our config
interface AppConfigType {
    VITE_SUPABASE_URL: string;
    VITE_SUPABASE_ANON_KEY: string;
    VITE_CLIENT_URL: string;
    VITE_API_URL?: string;
    VITE_MASTER_URL?: string;
    VITE_BRIDGE_DOMAIN?: string;
}

// Declare the window property
declare global {
    interface Window {
        env?: AppConfigType;
    }
}

// Helper to get config values with fallback to import.meta.env (for local dev)
export const AppConfig = {
    get VITE_SUPABASE_URL() {
        return window.env?.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || '';
    },
    get VITE_SUPABASE_ANON_KEY() {
        return window.env?.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    },
    get VITE_CLIENT_URL() {
        const raw = window.env?.VITE_CLIENT_URL || import.meta.env.VITE_CLIENT_URL || '';
        // __DYNAMIC_ORIGIN__ is a sentinel set by entrypoint.sh in multi-domain mode.
        // It means "use whatever domain the browser is actually on right now."
        // This ensures clickube.com, apiautomation.in, etc. all get their OWN origin.
        if (raw === '__DYNAMIC_ORIGIN__' || !raw) {
            return window.location.origin;
        }
        return raw;
    },
    get VITE_API_URL() {
        return window.env?.VITE_API_URL || import.meta.env.VITE_API_URL || '';
    },
    get VITE_MASTER_URL() {
        return window.env?.VITE_MASTER_URL || import.meta.env.VITE_MASTER_URL || '';
    },
    get VITE_BRIDGE_DOMAIN() {
        return window.env?.VITE_BRIDGE_DOMAIN || import.meta.env.VITE_BRIDGE_DOMAIN || '';
    }
};
