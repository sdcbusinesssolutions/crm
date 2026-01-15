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

### B. Frontend (React)
1.  **Auth Bridge Page** (`client/src/components/WhatsAppManagement/AuthBridge.tsx`)
    *   **Role**: The "Popup" window. Loads Facebook SDK.
2.  **Account Setup** (`client/src/components/WhatsAppManagement/AccountSetup.tsx`)
    *   **Role**: The "Launcher". Uses `BRIDGE_DOMAIN` to decide popup URL.

### C. Backend & Deployment
*   **Configuration**: `domains.csv`
    *   **Column**: `MasterDomain` (Used for App Login Auth).
    *   **Variable**: `BRIDGE_DOMAIN` (defaults to SELF URL in `bulk_deploy.sh`).
*   **Logic**:
    *   Each tenant hosts their OWN Auth Bridge at their own URL (`https://chatmat.in/waba_auth_bridge`).
    *   This ensures the Meta Popup matches the Tenant's domain exactly.

---

## 3. Configuration & Use Cases

### Use Case 1: Master Provider (CloudOspire)
*   **Scenario**: The main SaaS platform. Users connect using CloudOspire's Meta App.
*   **Config**: `BRIDGE_DOMAIN` = `https://cloudospire.in` (Self).

### Use Case 2: White-Label Partner (ChatMat)
*   **Scenario**: A partner whitelabeling the platform.
*   **Config**: `BRIDGE_DOMAIN` = `https://chatmat.in` (Self).
*   **Requirement**: ChatMat MUST verify their domain in their own Meta Business Manager if they want to use their own App.
*   **Hybrid Mode**: If they use *your* Meta App, they must use YOUR bridge.
    *   **Action**: In Admin Settings > Onboarding, set Bridge Domain to `https://clickube.com`.
    *   **Result**: Popup opens on `clickube.com`, keeping *your* Meta App happy.

---

## 4. Deployment Checklist
1.  **Code**: Deploy latest `client` (React) and `server` (Node).
2.  **Env**: Ensure `bulk_deploy.sh` is used to generate correct `.env` files.
3.  **Verify**: Log into Tenant Admin -> Account Setup -> Connect. Check if popup URL matches expected domain.

