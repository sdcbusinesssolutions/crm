
let accessToken: string | null = null;

export const tokenService = {
    setAccessToken: (token: string | null) => {
        accessToken = token;
    },
    getAccessToken: (): string | null => {
        // 1. Check for staff token first
        const staffToken = localStorage.getItem('staffToken');
        if (staffToken) return staffToken;
        
        // 2. Fallback to owner access token (memory or Supabase)
        return accessToken;
    },
    clearAccessToken: () => {
        accessToken = null;
        localStorage.removeItem('staffToken');
        localStorage.removeItem('staffData');
    }
};
