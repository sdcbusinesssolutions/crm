# Google Integrations Guide: OAuth2 vs. Service Accounts

This document details the Google Integration implementation in this project, specifically focusing on the new **Service Account** support which solves the issue of frequent token expiration.

---

## 1. Authentication Methods: Which one to use?

We now support two distinct ways to connect Google Services (Sheets, Calendar, Gmail, Contacts).

### Option A: OAuth2 (User Login)
This is the standard "Sign in with Google" flow.
*   **Best For:** Accessing your personal data naturally (e.g., reading your own emails, editing your own calendar) without complex setup.
*   **The Problem:** In "Testing" mode (which requires no Google verification), refresh tokens **expire after 7 days**. This breaks automations weekly.
*   **Token Refresh:** The system automatically refreshes the `access_token` using the `refresh_token`. However, if the `refresh_token` itself expires (7 days in Testing), the connection dies.

### Option B: Service Account (Bot) **(RECOMMENDED FOR AUTOMATION)**
A Service Account is a special Google account type intended for non-human users (bots).
*   **Best For:** "Forever" automations (e.g., a backend job that runs every night).
*   **The Benefit:** **Tokens NEVER expire.** It uses a credential file (JSON) to generate short-lived tokens on the fly.
*   **The Trade-off:** The Service Account is a *separate user* with its own email (e.g., `bot@project.iam.gserviceaccount.com`). It cannot see *your* data unless you explicit **SHARE** your resources (Sheet, Calendar) with it.

---

## 2. How to Create & Setup a Service Account

Follow these steps to generate the JSON key required for Option B.

1.  **Go to Google Cloud Console:** [https://console.cloud.google.com/](https://console.cloud.google.com/)
2.  **Select a Project:** Create a new project or select your existing one.
3.  **Enable APIs:**
    *   Go to **APIs & Services > Library**.
    *   Search for and ENABLE the following APIs:
        *   Google Sheets API
        *   Google Calendar API
        *   Gmail API
        *   Google People API (for Contacts)
4.  **Create Service Account:**
    *   Go to **IAM & Admin > Service Accounts**.
    *   Click **+ CREATE SERVICE ACCOUNT**.
    *   Name it (e.g., "whatsapp-bot").
    *   Click **Create and Continue**.
    *   (Optional) Grant "Owner" or "Editor" role (simplifies permissions).
    *   Click **Done**.
5.  **Generate Key (JSON):**
    *   Click on the newly created email address in the list.
    *   Go to the **KEYS** tab.
    *   Click **ADD KEY > Create new key**.
    *   Select **JSON**.
    *   A file will download to your computer. **This is your "Service Account JSON".**
6.  **Copy Email:**
    *   Note the active email address (e.g., `whatsapp-bot@my-project.iam.gserviceaccount.com`). You will need this to share your files.

---

## 3. Specific Setup per Service

### Google Sheets
*   **Use Case:** Reading/Writing rows for automation.
*   **Setup:**
    1.  Upload the JSON in the app.
    2.  Open your Google Sheet in your browser.
    3.  Click **Share** (top right).
    4.  Paste the **Service Account Email**.
    5.  Set permission to **Editor**.
    6.  The bot can now access this specific sheet forever.

### Google Calendar
*   **Use Case:** Creating events from leads/messages.
*   **Setup:**
    1.  Upload the JSON in the app.
    2.  Open Google Calendar.
    3.  Find your calendar on the left sidebar > Click three dots > **Settings and sharing**.
    4.  Scroll to "Share with specific people".
    5.  Add the **Service Account Email**.
    6.  The bot can now read/create events on your calendar.

### Gmail (Sending)
*   **Use Case:** Sending automated emails.
*   **Behavior:** Emails will be sent **FROM** the Service Account email (`...@iam.gserviceaccount.com`), NOT your personal Gmail.
*   **Impersonation:** To send AS your domain user (e.g., `info@mycompany.com`), you need a **Google Workspace** account and must perform "Domain-Wide Delegation" in the Workspace Admin panel. This is complex and usually not needed for simple notification bots.

### Google Contacts
*   **Use Case:** Syncing contacts.
*   **Limitation:** A Service Account has its own empty contact book. It cannot see your personal contacts simply by "sharing" (Contacts doesn't work like Drive).
*   **Workaround:** You usually need Domain-Wide Delegation (Workspace) for this to be useful, or use OAuth2 instead.

---

## 4. Technical Implementation & Files Changed

### Backend Logic for "No Expiry"
**Service Account (JWT):**
*   We use `google.auth.JWT` (JSON Web Token).
*   **Mechanism:** The code reads the `private_key` from your JSON. It requests a temporary `access_token` from Google. If that token expires (usually 1 hour), the library **automatically** generates a new one using the key.
*   **Result:** Permanent connectivity. No "Refresh Token" logic needed.

**OAuth2 (Standard):**
*   We use `google.auth.OAuth2`.
*   **Mechanism:** Uses an `access_token` and `refresh_token`.
*   **Persistence:** We added a listener `oauth2Client.on('tokens', ...)` in `SheetAutomationService.js` (and logic in `google.js` routes). When Google provides a new token, we securely save it back to the database (`user_integrations` table). This attempts to prolong access, but cannot bypass the hard 7-day limit for "Testing" apps.

### Modified Files Summary

| File | Purpose of Change |
| :--- | :--- |
| **`client/src/components/Integrations/GoogleCalendarCard.tsx`** | Added UI toggle for "Service Account". Added JSON input field. |
| **`client/src/components/Integrations/GoogleContactsCard.tsx`** | Added UI toggle for "Service Account". Added JSON input field. |
| **`client/src/components/Integrations/GmailCard.tsx`** | Added UI toggle for "Service Account". Added JSON input field. |
| **`server/routes/integrations/google.js`** | Added logic to save Service Account creds. Refactored `fetchWithRefresh` to support JWT. |
| **`server/services/GoogleCalendarService.js`** | Added `_getAuthClient` helper. Now detects `private_key` to swtich to `google.auth.JWT`. |
| **`server/services/GmailService.js`** | Added `_getAuthClient` helper. Now detects `private_key` to switch to `google.auth.JWT`. |
| **`server/services/SheetAutomationService.js`** | Updated `getAuthClient` to support JWT. Added token persistence for OAuth. |
| **`server/routes/integrations/*.js`** | Added `/service-account` POST endpoints for saving JSON credentials directly. |

---

## 5. Token Refresh Logic (Deep Dive)

**Scenario: User uses OAuth2 (Old Way)**
1.  App makes a request.
2.  If `access_token` is expired (401 Error), the server catches the error.
3.  We call `oauth2Client.refreshAccessToken()`.
4.  Google verifies the `refresh_token`.
5.  If valid, Google returns new `access_token` (and sometimes a new `refresh_token`).
6.  **CRITICAL:** We save these new tokens to the Database via Supabase.
7.  We retry the original request.
8.  *Failure State:* If `refresh_token` is invalid (e.g., >7 days in Testing), the flow fails, and user must re-login.

**Scenario: User uses Service Account (New Way)**
1.  App makes a request using `GoogleCalendarService`.
2.  `_getAuthClient` sees `private_key` in DB credentials.
3.  It instantiates `new google.auth.JWT(...)`.
4.  The Google library internally checks if it has a valid cached token.
5.  If not, it signs a JWT locally using the private key and exchanges it for an `access_token`.
6.  Request succeeds.
7.  **No user intervention ever required.**
