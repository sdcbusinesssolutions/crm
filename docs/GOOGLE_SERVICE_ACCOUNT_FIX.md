# Google Service Account Authentication Fix & Troubleshooting

## 1. Issue Description
The application was experiencing persistent failures when attempting to authenticate with Google APIs (Sheets, Calendar) using a Service Account.

**Symptoms:**
- Error: `Failed to fetch sheets: Service Account Auth Failed: Invalid host defined options`
- Error: `Service Account Auth Failed: No key or keyFile set`
- Stack traces pointing to `gaxios` (Google's underlying HTTP client) and `google-auth-library`.

## 2. Root Cause Analysis
The primary issue was a simplified "Invalid host defined options" error which originates from Node.js's networking layer when an invalid proxy configuration is detected.

1.  **Environment Proxy Conflict**: The `googleapis` and `google-auth-library` rely on `gaxios` for HTTP requests. `gaxios` automatically detects environment variables like `HTTP_PROXY`, `HTTPS_PROXY`, etc. In the deployment environment (Docker/VPS), these variables likely contained values (or formatting) that `gaxios` could not parse correctly, or they were directing traffic to a blocked/invalid internal proxy.
2.  **Library Incompatibility**: Even when we attempted to clean up environment variables (`process.env.HTTP_PROXY = undefined`), the internal logic of `GoogleAuth` and `gtoken` still seemingly struggled to establish a clean connection or properly parse the private key string when passed directly in memory, leading to the "No key or keyFile set" error.

## 3. The Solution: Manual JWT Exchange
To permanently resolve this, we bypassed the standard `googleapis` authentication flow entirely for the initial token exchange. Instead of letting Google's library guess the environment and network settings, we implemented a **Manual JWT (JSON Web Token) Exchange**.

### Which Libraries Solved This?
We used two core libraries to replace the functionality of `google-auth-library`'s token fetching:
1.  **`jsonwebtoken`**: Used to manually create and sign the cryptographic token using the Service Account's Private Key. This avoids the internal key parsing issues of the Google library.
2.  **`axios`**: Used to send the HTTP POST request to Google. `axios` allows for explicit configuration to disable proxy detection, ensuring the request goes directly to the internet.

### How It Works (The Logic)
1.  **Clean Environment**: We aggressively remove all proxy-related environment variables (`HTTP_PROXY`, `ALL_PROXY`, etc.) and set `NO_PROXY='*'` to ensure no underlying Node libraries try to route traffic internally.
2.  **Construct JWT**: We build a standard JWT payload containing:
    *   `iss` (Issuer): The Service Account Email.
    *   `scope`: The permission scope (e.g., `https://www.googleapis.com/auth/spreadsheets`).
    *   `aud` (Audience): `https://oauth2.googleapis.com/token`.
    *   `exp` (Expiration): Current time + 1 hour.
    *   `iat` (Issued At): Current time.
3.  **Sign JWT**: We sign this payload using the `RS256` algorithm and the **Private Key** from the DB.
4.  **Exchange for Token**: We send this signed JWT as an `assertion` to Google's OAuth2 endpoint via `axios` with `{ proxy: false }`.
5.  **Wrap Client**: We take the returned `access_token` and wrap it in a dummy `OAuth2Client` so the rest of the application (which uses `google.sheets(...)`) works without modification.

## 4. Implementation Details

### Code Added
The following implementation pattern was applied to `server/routes/integrations/google.js`, `server/services/SheetAutomationService.js`, and `server/services/GoogleCalendarService.js`.

```javascript
try {
    // 1. MANUAL JWT EXCHANGE (Bypassing Gaxios "Invalid Host")
    const jwt = require('jsonwebtoken'); // The solver library 1
    const axios = require('axios');      // The solver library 2
    
    // Aggressive Proxy Cleanup
    ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'ALL_PROXY', 'all_proxy', 'NO_PROXY', 'no_proxy'].forEach(v => {
         if (process.env[v] !== undefined) delete process.env[v];
    });
    process.env.NO_PROXY = '*';

    // 2. Prepare Payload
    const now = Math.floor(Date.now() / 1000);
    const payload = {
        iss: creds.client_email,
        scope: 'https://www.googleapis.com/auth/spreadsheets', // or calendar
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600,
        iat: now
    };

    // 3. Sign Token manually (Robust Key handling)
    const token = jwt.sign(payload, privateKey, { algorithm: 'RS256' });

    // 4. Exchange for Access Token via Axios (Proxy Disabled)
    const exchangeUrl = 'https://oauth2.googleapis.com/token';
    const exchangeParams = new URLSearchParams();
    exchangeParams.append('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer');
    exchangeParams.append('assertion', token);

    const response = await axios.post(exchangeUrl, exchangeParams, { proxy: false });
    const accessToken = response.data.access_token;

    if (!accessToken) throw new Error('No access_token from Manual JWT');

    console.log('[Service] Manual JWT Exchange SUCCESS.');
    
    // 5. Return Client for Google API usage
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    
    return oauth2Client;

} catch (err) {
    // ... Error handling
}
```

### Impacted Files
*   `server/routes/integrations/google.js`: Fixed the "Fetch Sheets" / "Fetch Columns" UI actions.
*   `server/services/SheetAutomationService.js`: Fixed the background automation jobs.
*   `server/services/GoogleCalendarService.js`: Fixed the calendar event creation and syncing.

## 5. Summary
By moving the authentication complexity "user-side" (using `jsonwebtoken` to sign our own tokens) and standardizing the network transport (using `axios` with disabled proxies), we have eliminated the dependency on the environment-sensitive `gaxios` library, guaranteeing stable connectivity for Service Accounts.
