
let accessToken: string | null = null;

export const tokenService = {
    setAccessToken: (token: string | null) => {
        accessToken = token;
    },
    getAccessToken: (): string | null => {
        // 1. Check for owner access token (memory) first
        if (accessToken && accessToken !== 'null' && accessToken !== 'undefined') return accessToken;
        
        // 2. Fallback to staff token
        const staffToken = localStorage.getItem('staffToken');
        if (staffToken && staffToken !== 'null' && staffToken !== 'undefined') return staffToken;
        
        return null;
    },
    getAuthHeader: async () => {
        const token = tokenService.getAccessToken();
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token || ''}`
        };
    },
    getAuthHeaderSync: () => {
        const token = tokenService.getAccessToken();
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token || ''}`
        };
    },
    clearAccessToken: () => {
        accessToken = null;
        localStorage.removeItem('staffToken');
        localStorage.removeItem('staffData');
    }
};
