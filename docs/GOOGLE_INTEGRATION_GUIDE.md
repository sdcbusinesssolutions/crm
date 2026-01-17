# Google Integration & Troubleshooting Guide

## 1. Overview
This integration allows users to connect their Google Account to use **Google Sheets** as a data source for WhatsApp Flows. 
It enables features like:
- Fetching Spreadsheet names.
- fetching Column headers.
- Reading/Writing cell data (future).

## 2. Authentication Flow (OAuth2)
The integration uses the **Authorization Code Flow**:

1.  **Auth URL Generation** (`/api/integrations/google/auth-url`):
    *   Generates a Google consent URL with scopes: `spreadsheets`, `userinfo.email`, `userinfo.profile`.
2.  **Redirect & Code Capture**:
    *   User approves access -> Redirects to `APP_URL/google-callback`.
    *   Frontend captures the `code` parameter.
3.  **Token Exchange** (`/api/integrations/google/exchange`):
    *   Frontend POSTs the `code` to the backend.
    *   Backend exchanges the code for `access_token` and `refresh_token`.
    *   Backend fetches User Profile (Email) to name the connection.
    *   Credentials are stored securely in `user_integrations` table (encrypted/jsonb).

---

## 3. Critical Architecture Fixes (The "Invalid Host" Bug)

### The Problem
In certain Dockerized environments (specifically when running `googleapis` Node SDK behind restricted networks or specific Docker networking configurations), the library throws the following error during Token Exchange:

> **Error**: `Invalid host defined options`
> **Source**: `gaxios` (Google's internal HTTP client) -> Node's `http` module.

This occurs because `gaxios` attempts to respect environment variables like `HTTP_PROXY`, `HTTPS_PROXY`, or `NO_PROXY`. If these are set by the container runtime (even incorrectly, e.g., pointing to an internal docker DNS that Node can't resolve cleanly), strict node validation fails.

### The Solution (Implemented in `google.js`)

We implemented a **Multi-Layered Fix** to ensure reliability:

#### Layer 1: Aggressive Proxy Cleanup
Before initiating any Google API call, the code explicitly detects and **deletes** proxy-related environment variables from the current process:
```javascript
const proxyVars = ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy'];
proxyVars.forEach(v => {
    if (process.env[v]) delete process.env[v];
});
```

#### Layer 2: Axios Fallback (Token Exchange)
If the standard `oauth2Client.getToken(code)` method fails (likely due to the `gaxios` host error), the system automatically catches the error and switches to a **Manual Axios Request**:
*   **Endpoint**: `https://oauth2.googleapis.com/token`
*   **Method**: `POST`
*   **Reason**: `Axios` is more robust against environment noise and handles proxies differently than `gaxios`.

#### Layer 3: Direct Axios Call (User Info)
For fetching user details, we completely bypassed the `googleapis` library and use `Axios` directly:
*   **Endpoint**: `https://www.googleapis.com/oauth2/v2/userinfo`
*   **Auth**: `Bearer <access_token>`

---

## 4. Required Configuration
To ensure the integration works, the following environment variables are required in `.env` (passed to the container):

*   `GOOGLE_CLIENT_ID`: From Google Cloud Console.
*   `GOOGLE_CLIENT_SECRET`: From Google Cloud Console.
*   `GOOGLE_REDIRECT_URL`: Must match exactly what is registered in Google Console (e.g., `https://your-domain.com/google-callback`).

## 5. Debugging
Check the logs in `server/logs/campaign_requests.log` or the Docker logs.
Look for:
*   `[Google Exchange] Proxy detected` (Warning)
*   `[Google Exchange] oauth2Client.getToken failed. Attempting Axios fallback...` (Info - Good!)
*   `[Google Exchange] Axios fallback SUCCESS!` (Success)

## 6. Gmail Integration Note
The same logic (Axios Fallback) should be applied to the **Gmail Integration** (`server/routes/integrations/gmail.js`) if similar errors are observed there, as it shares the same underlying `googleapis` dependency.
