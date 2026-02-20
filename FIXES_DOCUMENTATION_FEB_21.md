# System Fixes & Debugging Guide - February 21, 2026

This document outlines the critical fixes implemented today to resolve issues with **WhatsApp Media Handling** and **Google Sheets Automation**.

---

## 1. WhatsApp Inbound Media Fixes
### **Problem**
Users were experiencing "Media Unavailable" or "Download Failed" errors. Logs showed `ECONNRESET` during the media download phase from Meta's servers (`lookaside.fbsbx.com`).

### **Fix Implemented (in `server/routes/webhook.js`)**
The `downloadMedia` helper was significantly upgraded for robustness.

*   **Browser-like Headers**: Added `User-Agent` (Chrome), `Accept`, and `Accept-Encoding` headers. 
    *   *Purpose*: Meta's security layers often reject raw automated requests (default Axios/Node headers) with connection resets. Pretending to be a standard browser bypasses these strict filters.
*   **Multi-Stage Retry Mechanism**:
    *   **Metadata Fetch**: 2 attempts for fetching the media URL from Meta Graph API (v21.0).
    *   **Binary Download**: 3 attempts for downloading the actual file content with a 1-second delay between tries.
    *   *Purpose*: Handles intermittent network blips or temporary rejections from Meta's CDN.
*   **Increased Timeouts**: Increased binary download timeout to **60 seconds** to accommodate large videos or slow connections.

### **How to Debug Inbound Media**
1.  **Check Logs**: Look for `[Webhook] Media download returned NULL` or `downloadMedia: Failed to download binary`.
2.  **Verify Access Token**: Ensure the log says `Access Token found: true`.
3.  **Media IDs**: Capture the `mediaId` from logs and try a manual curl from the VPS:
    ```bash
    curl -H "Authorization: Bearer YOUR_TOKEN" "https://graph.facebook.com/v21.0/MEDIA_ID"
    ```

---

## 2. Google Sheets Automation Fixes
### **Problem**
Automations were failing with `status: 401 (Unauthorized)` because the stored Google access tokens had expired. The system was not automatically using the `refresh_token`.

### **Fix Implemented (in `server/services/SheetAutomationService.js`)**
Implemented a **Self-Healing Auth Mechanism** within the `executeJob` and `writeStatus` methods.

*   **Proactive Refresh-on-Fail**: 
    1.  The code attempts the Sheets API call.
    2.  If it receives a `401 Unauthorized`, it immediately checks for a `refresh_token`.
    3.  If found, it calls `oauth2Client.refreshAccessToken()`, saves the **new** tokens to the database (`user_integrations` table), and **retries** the original request.
*   **Purpose**: Ensures that once a user connects their Google account, it stays "live" forever (or until the refresh token itself is revoked), even if the server restarts or tokens expire between runs.

### **How to Debug Google Sheets**
1.  **Check `user_integrations`**: Ensure the `credentials` column has a `refresh_token`. If missing, the user MUST reconnect and approve the "Offline Access" prompt.
2.  **Verify Spreadsheet ID**: Ensure the `spreadsheet_id` in `sheet_automations` matches the URL of the Google Sheet.
3.  **Permissions**: Ensure the authenticated user (or Service Account) has **Editor** access to the sheet.

---

## 3. Outbound Media Analysis (Error #131053)
### **Issue Found**
Logs showed `WhatsAppService Send Error: (#131053) Media upload error`. Meta reported `Downloading media from weblink failed with http code 400`.

### **The Cause**
This is **not a code bug** but a **data issue**. The image URL being sent to Meta (from Supabase) returned a `400 Bad Request` because the file did not exist at that specific path in the storage bucket.

### **Resolution**
*   Verify that files exist in the `campaign-media` bucket before setting them in flows.
*   The system now logs the exact Supabase public URL being sent to Meta, allowing you to click it and verify if it's "broken" or "live."

---

## Summary of Code Changes

| File | Change | Impact |
| :--- | :--- | :--- |
| `webhook.js` | Added Retry Loop & Browser Headers | Fixes `ECONNRESET` and unstable media downloads. |
| `webhook.js` | Upgraded to API `v21.0` | Uses latest stable Meta Graph API. |
| `SheetAutomationService.js` | Added 401 Interceptor & Refresh | Prevents automation failure due to expired Google tokens. |
| `whatsappService.js` | Added descriptive error logging | Makes debugging much faster by showing raw Meta API errors. |

---
**Note**: To apply these changes to the VPS, run the `auto_deploy.sh` script or your standard deployment pipeline.
