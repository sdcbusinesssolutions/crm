# Meta Embedded Signup (v4 / Coexistence) Troubleshooting Guide

This document explains the root causes and permanent fixes for the Meta Embedded Signup integration, specifically addressing the "WABA ID Undefined" and "502 Server Returned an Invalid Response" errors. 

If this issue ever reoccurs, refer to this document to diagnose and fix it.

---

## 🛑 The Symptoms
If the Embedded Signup is failing, you will typically see these signs:
1. **Frontend:** The UI shows a red banner: `Failed to connect embedded account: 502 - Server returned an invalid response.`
2. **Frontend Console:** `Received Code from Auth Bridge... WABA ID: undefined Phone ID: undefined`
3. **Backend PM2 Logs:** Node.js crashes with `Error: No WhatsApp Business Account found connected to this user.` at `/app/routes/settings.js`.

## 🔍 The Root Cause
The entire failure chain starts because the user's browser **fails to catch the WABA ID** from the Facebook popup when the popup closes. 

If the frontend drops the WABA ID:
1. The frontend sends `undefined` to the backend.
2. The backend is forced into "Auto-Detect Mode".
3. Auto-Detect calls Meta's `/me?fields=whatsapp_business_accounts` API.
4. Because the user is using the V4 Coexistence flow, Meta blocks this API call with a `#100 OAuthException` (permission denied).
5. The backend crashes, triggering a 502 Bad Gateway response.

---

## 🛠️ Code Changes & Why They Were Made

Here are the exact code changes that permanently fixed this issue, where they are located, and why they are necessary.

### 1. The Frontend (`AuthBridge.tsx`)
**File Path:** `client/src/components/WhatsAppManagement/AuthBridge.tsx`

This file handles the communication with Meta's popup. The following fixes ensure we perfectly capture the `postMessage` payload from Facebook.

* **Fix 1: Facebook SDK Version Upgrade (Line ~61)**
  * **Code Changed:** `version: 'v22.0'` was changed to `version: 'v25.0'`
  * **Why:** Meta frequently updates their API. Meta's official documentation strictly requires `v25.0` for the Coexistence V4 flow. When the SDK was set to `v22.0` (or `v20.0`), Facebook's internal script failed to send the `postMessage` payload.

* **Fix 2: Increased Message Timeout (Line ~142)**
  * **Code Changed:** `setTimeout(..., 2000)` was increased to `setTimeout(..., 10000)`
  * **Why:** Cross-origin messaging from a popup can sometimes be delayed. 2 seconds was too aggressive and forced the frontend to send `undefined` to the backend before Facebook had time to transmit the WABA ID.

* **Fix 3: Forced Session Info Version 3 (Line ~172)**
  * **Code Changed:** Added `sessionInfoVersion: '3'` to the `extras` config for *all* flows, not just coexistence.
  ```javascript
  extras: isCoexistence ? {
      setup: {},
      featureType: 'whatsapp_business_app_onboarding',
      sessionInfoVersion: '3'
  } : {
      setup: {},
      sessionInfoVersion: '3' // CRITICAL ADDITION
  }
  ```
  * **Why:** If the user unchecked the "Coexistence" box, `sessionInfoVersion: '3'` was being omitted. Without this parameter, Meta's `v25.0` API refuses to send the `WA_EMBEDDED_SIGNUP` event payload containing the WABA ID.


### 2. The Backend Auto-Detect (`MetaOnboardingService.js`)
**File Path:** `server/services/MetaOnboardingService.js`

If the frontend ever fails to send a WABA ID, the backend attempts to automatically detect it.

* **Fix 4: Double-Scope WABA ID Detection (Line ~95)**
  * **Code Changed:** Added `|| granularScopes.find(...)` to check for `whatsapp_business_messaging` in addition to `whatsapp_business_management`.
  ```javascript
  // OLD CODE (Only checked one scope):
  // const wabaScope = granularScopes.find(s => s.scope === 'whatsapp_business_management');
  
  // NEW CODE (Checks both scopes):
  const wabaScope = granularScopes.find(s => s.scope === 'whatsapp_business_management') || 
                    granularScopes.find(s => s.scope === 'whatsapp_business_messaging');
  ```
  * **Why:** When Meta blocks the standard `/me?fields=whatsapp_business_accounts` API call with a `#100 OAuthException` (common in V4 Coexistence tokens), the backend securely extracts the WABA ID directly from the access token's internal `granular_scopes`. Some V4 tokens hide the WABA ID under `whatsapp_business_messaging` instead of `management`. By searching both scopes, we ensure the backend can always find the WABA ID even if Meta changes their permission naming.


### 3. The Backend Crash Prevention (`settings.js`)
**File Path:** `server/routes/settings.js`

* **Fix 5: Safe Error Status Codes (Line ~916)**
  * **Code Changed:** `res.status(500).json(...)` was changed to `res.status(400).json(...)` inside the `catch` block for the `/embedded/connect` route.
  * **Why:** Nginx and Cloudflare typically intercept `500` status codes and forcefully replace the server's JSON response with an HTML error page. When the frontend tried to parse that HTML using `res.json()`, it crashed with `SyntaxError: JSON.parse`. Using `400` guarantees the clean JSON error message bypasses proxies and reaches the user interface.

---

## 🕵️ Debugging Live Traffic
If you need to see exactly what Facebook is sending to your server in the future:
1. Open `AuthBridge.tsx`.
2. Look for the `messageListener`. You can add this line to intercept every message:
   ```javascript
   logToServer('INFO', 'DEBUG_ALL_MESSAGES', { origin: event.origin, data: event.data });
   ```
3. Open your PM2 backend logs and watch for `[INFO] DEBUG_ALL_MESSAGES`. This log will print the exact raw JSON that Facebook's popup is transmitting to your website.
