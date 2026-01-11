
let accessToken: string | null = null;

export const tokenService = {
    setAccessToken: (token: string | null) => {
        accessToken = token;
    },
    getAccessToken: (): string | null => {
        return accessToken;
    },
    clearAccessToken: () => {
        accessToken = null;
    }
};
