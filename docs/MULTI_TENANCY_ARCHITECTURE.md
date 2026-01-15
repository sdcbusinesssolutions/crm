# Comprehensive Multi-Tenancy & White-Label Architecture

## 1. Overview
This document details the architecture for enabling **Single-Database, Multi-Domain White-Labeling**. 
The goal is to allow 100+ different domains (e.g., `chatmat.in`, `clickube.com`) to serve their own users using a single backend and database, while maintaining strict data isolation, branding, and hierarchical admin controls.

## 2. Core Architecture Strategy
- **Database**: Single Shared Postgres Database (Supabase).
- **Isolation**: Row-Level Security (RLS) & API-Level Filtering based on `user_id` and `signup_domain`.
- **Authentication**: Centralized "Bounce" strategy via a **Master Domain**.
- **Admin Hierarchy**: 
    - **Super Admin** (Role-Based): Users with role `super_admin` can manage limits, plans, and add tenants.
    - **Tenant Admin** (Client Domain): Controls ONLY their own users (users registered on their domain).
    - **Cascade Blocking**: Banning a Tenant Admin automatically bans all their users.
    - **Impersonation**: Super Admin can instantly log in as any Tenant Admin (redirects to *their* domain).

---

## 3. Implementation Details

### A. Centralized Authentication (The "Auth Bounce") - **IMPLEMENTED**
**Problem**: Supabase requires whitelisting every redirect URL. Maintaining 100+ domains manually is impossible.
**Solution**: Use a nominated Master Domain (e.g., `clickube.com`) as the authentication authority for the entire cluster.

1.  **Logic**:
    *   Tenant (`chatmat.in`) initiates login.
    *   System redirects to `https://clickube.com/auth_callback` (Master).
    *   Supabase authenticates user on `clickube.com`.
    *   `AuthCentralCallback` component extracts tokens and bounces user BACK to `https://chatmat.in/#access_token=...`.
2.  **Strict Redirection & Isolation (Updated)**:
    *   **Login Check**: When a user logs in, the system fetches their authoritative `signup_domain` from the `profiles` table.
    *   **Enforcement**: If `assignedDomain !== currentDomain`, the user is **automatically signed out** and redirected to the login page of their *correct* domain.
    *   **Expired Token Handling**: If `INITIAL_SESSION` provides an expired token, the specific dashboard logic (**Race Condition Handling**) prevents API calls until a valid refresh occurs.

### B. Deployment Configuration - **IMPLEMENTED**
**Problem**: Automated deployment of multiple distinct domains.
**Solution**: Data-Driven Deployment via CSV.

1.  **File**: `domains.csv`
    *   **Structure**: `Domain, VPSIp, ..., MasterDomain`
2.  **Script**: `bulk_deploy.sh`
    *   **Logic**: Uses the CSV to configure the VITE_MASTER_URL and BRIDGE_DOMAIN for each build.

### C. Dynamic Frontend Branding (Theme Engine) - **IMPLEMENTED**
1.  **Database**: `public.domain_settings` (domain, logo_url, brand_name, primary_color).
2.  **Frontend**: `ThemeContext` automatically fetches settings based on `window.location.hostname`.

### D. Super Admin Provisioning & Limits - **IMPLEMENTED**
**Problem**: Need granular control over tenants (Limits, Manual Creation).
**Solution**: **Super Panel** (`/admin/super`) + Secure RPCs.

1.  **Access Control**: restricted to users with `role = 'super_admin'`.
2.  **Add Tenant Feature**:
    *   Button: **"+ Add New Tenant"** in Super Panel.
    *   RPC: `add_new_tenant(domain)`.
    *   Action: Creates `domain_settings`, `tenant_limits`, and `tenant_plans` records instantly.
3.  **Tenant Limits**:
    *   Feature: Restrict max users per domain.
    *   RPC: `update_tenant_limit(domain, new_limit)`.
    *   Enforcement: Database Trigger `check_tenant_limit` runs `BEFORE INSERT` on `profiles`. If limit is reached, signup fails.

### E. Tenant Plans - **IMPLEMENTED**
*   **Expiry Check**: `check_admin_status` runs on login. If `tenant_plans.expires_at` is passed, access is blocked for ALL users of that domain.

### F. Admin Impersonation (Context-Aware) - **IMPLEMENTED**
*   **Impersonate**: One-click jump into any tenant's admin panel as if you were them.
*   **Context**: Redirects Super Admin to `tenant-domain.com`, preserving the tenant's context.

---

## 4. How to Apply (End-to-End)
1.  **Run SQL Scripts**: Execute the following in order:
    1.  `200_combined_multi_tenancy.sql` (Base Setup)
    2.  `207_update_tenant_limit_rpc.sql` (Limit Update Logic)
    3.  `208_add_tenant_rpc.sql` (Add Tenant Logic)
2.  **Assign Role**: Manually assign yourself as Super Admin:
    ```sql
    UPDATE public.profiles SET role = 'super_admin' WHERE email = 'YOUR_EMAIL';
    ```
3.  **Deploy**: Use `./bulk_deploy.sh` with your `domains.csv`.

---

## 5. Security Summary
1.  **RBAC**: Critical functions (`add_tenant`, `update_limit`) REQUIRE `super_admin` role.
2.  **RLS**: Users can ONLY see data for their own `signup_domain`.
3.  **Isolation**: Users blocked from logging into wrong domains.
