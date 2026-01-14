# Central Authentication & Multi-Provider Strategy Configuration

## 1. Overview
This document details the implementation of the **Central Auth Bridge**, a strategy designed to overcome Meta's domain verification limits while enabling flexible White-Labeling options for partners.

**The Problem:** Meta Business Tech Providers are limited to dynamic onboarding on a specific set of verified domains.
**The Solution:** A centralized logic that allows any white-label domain to either:
1.  **Bridge** through the Master Domain (CloudOspire) for authentication.
2.  **Host** their own authentication if they have their own Meta App.

---

## 2. Architecture & Code Impact

### A. Database (PostgreSQL / Supabase)
*   **Table**: `onboarding_settings`
*   **Change**: Unified table to support both System-wide settings and per-user overrides. Added `bridge_domain` column.
*   **SQL Script**: `server/sql/100_setup_onboarding_settings.sql`
*   **Rollback**: `server/sql/100_rollback_onboarding_settings.sql`

### B. Frontend (React)
1.  **Auth Bridge Page** (`client/src/components/WhatsAppManagement/AuthBridge.tsx`)
    *   **Role**: The "Popup" window. It loads the Facebook SDK, captures the OAuth Code, and sends it back to the parent window via `postMessage`.
    *   **URL**: `/waba_auth_bridge`
2.  **Account Setup** (`client/src/components/WhatsAppManagement/AccountSetup.tsx`)
    *   **Role**: The "Launcher". It fetches the config API to decide *which* domain to open the popup on.
3.  **Admin Settings** (`client/src/components/admin/AdminOnboardingSettings.tsx`)
    *   **Role**: The "Configurator". UI for Admins to set App ID, Secret, and Bridge Domain.

### C. Backend (Node.js / Express)
1.  **Public Config API** (`server/routes/settings.js`)
    *   **Endpoint**: `GET /api/onboarding/config`
    *   **Logic**: Returns the `appId` and `bridgeDomain` to the frontend so it knows where to redirect.
2.  **Admin Update API** (`server/controllers/admin/AdminSettingsController.js`)
    *   **Endpoint**: `PUT /api/admin/settings/onboarding`
    *   **Logic**: Saves the configuration (including `bridge_domain`) to the DB.

---

## 3. Configuration & Use Cases

### Use Case 1: Master Provider (CloudOspire)
*   **Scenario**: The main SaaS platform. Users connect using CloudOspire's Meta App.
*   **Database**: CloudOspire Instance DB.
*   **Configuration**:
    *   **App ID**: `[CloudOspire_Meta_App_ID]`
    *   **Bridge Domain**: `https://cloudospire.in` (or empty)
*   **User Flow**:
    1.  User clicks "Connect" on `cloudospire.in`.
    2.  Popup opens: `https://cloudospire.in/waba_auth_bridge`.
    3.  Success.

### Use Case 2: White-Label Partner (ChatMat)
*   **Scenario**: A partner whitelabeling the platform. They **do not** have their own Meta App; they use yours.
*   **Database**: ChatMat Instance DB.
*   **Configuration**:
    *   **App ID**: `[CloudOspire_Meta_App_ID]` (Same as Master).
    *   **Bridge Domain**: `https://cloudospire.in` (**CRITICAL**).
*   **User Flow**:
    1.  User clicks "Connect" on `chatmat.in`.
    2.  System sees `bridge_domain` is `cloudospire.in`.
    3.  Popup opens: `https://cloudospire.in/waba_auth_bridge` (Cross-Domain).
    4.  User logs in on the CloudOspire bridge.
    5.  Token is sent back to `chatmat.in` securely.

### Use Case 3: Enterprise Client (Clickube - BYOA)
*   **Scenario**: A large client with their **own** Meta Tech Provider App.
*   **Database**: Clickube Instance DB.
*   **Configuration**:
    *   **App ID**: `[Clickube_Meta_App_ID]`
    *   **Bridge Domain**: `https://clickube.com` (Their own domain).
*   **User Flow**:
    1.  User clicks "Connect" on `clickube.com`.
    2.  System sees `bridge_domain` is `clickube.com`.
    3.  Popup opens: `https://clickube.com/waba_auth_bridge`.
    4.  Auth happens entirely on their domain.

---

## 4. Test Cases

| ID | Test Name | Pre-Condition | Action | Expected Result |
| :--- | :--- | :--- | :--- | :--- |
| **TC-01** | **Direct Connect** | Config: Master App ID, Bridge=`cloudospire.in` | User on `cloudospire.in` clicks "Connect" | Popup opens `cloudospire.in/waba_auth...`. Login works. Status updates to Connected. |
| **TC-02** | **Bridge Connect** | Config: Master App ID, Bridge=`cloudospire.in` | User on `chatmat.in` clicks "Connect" | Popup opens `cloudospire.in/waba_auth...`. Address bar shows CloudOspire. Login works. Window closes. `chatmat.in` refreshes with Connected status. |
| **TC-03** | **Own App Connect** | Config: Client App ID, Bridge=`clickube.com` | User on `clickube.com` clicks "Connect" | Popup opens `clickube.com/waba_auth...`. Address bar shows Clickube. Login works. Status updates. |
| **TC-04** | **Missing Config** | No Embedded Config in DB | User clicks "Connect" | Error message: "Embedded signup is not configured." |

---

## 5. Deployment Checklist

1.  **Database**:
    *   Run `server/sql/100_setup_onboarding_settings.sql` on ALL production databases.
2.  **Code**:
    *   Deploy latest `client` (React) build.
    *   Deploy latest `server` (Node) code.
3.  **App Config (Admin Panel)**:
    *   Log into each instance's Super Admin.
    *   Navigate to **Settings > Onboarding**.
    *   Fill in the App ID, Secret, and appropriate Bridge Domain for that instance.
