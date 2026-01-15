# Comprehensive Multi-Tenancy & White-Label Architecture

## 1. Overview
This document details the architecture for enabling **Single-Database, Multi-Domain White-Labeling**. 
The goal is to allow 100+ different domains (e.g., `chatmat.in`, `clickube.com`) to serve their own users using a single backend and database, while maintaining strict data isolation, branding, and hierarchical admin controls.

## 2. Core Architecture Strategy
- **Database**: Single Shared Postgres Database (Supabase).
- **Isolation**: Row-Level Security (RLS) & API-Level Filtering based on `user_id` and `signup_domain`.
- **Authentication**: Centralized "Bounce" strategy via a **Master Domain**.
- **Admin Hierarchy**: 
    - **Super Admin** (Master Domain/Provider): Controls everything, can create users for ANY tenant manually.
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
    *   **Login Check**: When a user logs in, the system fetches their authoritative `signup_domain` from the `profiles` table (ignoring any stale metadata).
    *   **Enforcement**: If `assignedDomain !== currentDomain`, the user is **automatically signed out** and redirected to the login page of their *correct* domain.
    *   **Security**: This prevents an `apiautomation.in` user from accessing the `clickube.com` dashboard, effectively isolating the tenancy experience.

### B. Deployment Configuration - **IMPLEMENTED**
**Problem**: Automated deployment of multiple distinct domains to a single VPS or Cluster.
**Solution**: Data-Driven Deployment via CSV.

1.  **File**: `domains.csv`
    *   **Structure**: `Domain, VPSIp, ..., MasterDomain`
    *   **Logic**: Define the hierarchy directly in the file.
2.  **Script**: `bulk_deploy.sh`
    *   **Logic**:
        *   `DOMAIN` = The Tenant URL (e.g., `chatmat.in`).
        *   `BRIDGE_DOMAIN` = The Tenant URL (e.g., `chatmat.in`) - Usage for Meta Auth.
        *   `VITE_MASTER_URL` = The Master Auth Authority (e.g., `clickube.com`) - Usage for Login.

### C. Dynamic Frontend Branding (Theme Engine) - **IMPLEMENTED**
**Problem**: Each tenant needs their own Logo, Name, and Colors on the login page and dashboard.
**Solution**: Dynamic Lookup Table.

1.  **Database**: `public.domain_settings` (domain, logo_url, brand_name, primary_color).
2.  **Frontend**: `ThemeContext` automatically fetches settings based on `window.location.hostname`.
3.  **Result**: 
    *   `chatmat.in` -> Shows Green Theme + ChatMat Logo.
    *   `clickube.com` -> Shows Blue Theme + ClicKube Logo.

### D. Super Admin Dashboard & User Management - **IMPLEMENTED**
**Problem**: Managing 100 tenants via SQL is inefficient; need granular control over user creation.
**Solution**: A dedicated UI for the Provider.

1.  **Location**: `/admin/super-dashboard` (Protected Route).
2.  **Capabilities**:
    *   List all Tenants (Domains).
    *   **Manual User Creation**: Super Admin (on Master Domain) can create users for *any* specific tenant via a dropdown or manual entry.
    *   **Impersonate Button**: One-click jump into any tenant's admin panel (Context-Aware Redirect).

### E. Tenant Limits & Quotas - **IMPLEMENTED**
**Problem**: Restrict user signup counts per tenant.
**Solution**: `public.tenant_limits` table + `BEFORE INSERT` trigger on `public.profiles`.
*   If user count > limit, the database REJECTS the new sign-up.

### F. Tenant Plans & Expiry - **IMPLEMENTED**
**Problem**: Block access when a tenant subscription expires.
**Solution**: `public.tenant_plans` table + `check_admin_status` RPC.
*   Checked on every login. Use `expires_at` date to auto-block access.

### G. Admin Impersonation (Context-Aware) - **IMPLEMENTED**
**Problem**: Troubleshooting tenant issues without breaking session context.
**Solution**: `impersonateTenantAdmin` API.
*   Generates a magic link.
*   **Dynamic Redirect**: Detects the target user's `signup_domain`. If it's `apiautomation.in`, the Super Admin is redirected to `https://apiautomation.in/login...` (not the Master Domain). This ensures they see exactly what the client sees.

---

## 4. How to Apply
1.  **Run SQL**: Execute ALL setup scripts in order:
    1.  `200_setup_multi_tenancy.sql` (Base Profiles)
    2.  `202_setup_tenant_limits.sql` (Quotas)
    3.  `203_setup_tenant_plans.sql` (Tenant Plans)
    4.  `204_setup_user_plans.sql` (User Plans)
    5.  `205_setup_branding.sql` (Branding)
    6.  `206_setup_super_dashboard.sql` (Reporting RPCs)
2.  **Update Config**: Edit `domains.csv` to set `MasterDomain` for all rows.
3.  **Deploy**: Run `./bulk_deploy.sh`.

---

## 5. Security Model
1.  **Data Isolation**: Inherently enforced via RLS (Row Level Security) and API Controllers checking `signup_domain`.
2.  **Cross-Domain Protection**: Application logic prevents a user from `chatmat.in` logging into `clickube.com` (Strict Redirection).
3.  **Admin Rights**: Super Admin Logic is strictly bounded to the `VITE_MASTER_URL` hostname or `localhost`.

---

## 6. Recommendations & Known Limitations
### A. Email Delivery Branding (Pending)
*   **Limitation**: Supabase sends emails (Reset Password, Magic Link) from a single configured SMTP server.
*   **Workaround**: Use generic branding or third-party webhooks (Resend/SendGrid) for white-labeled emails.

### B. Active Session Expiry
*   **Recommendation**: Add a frontend poller (`useEffect`) to check `check_user_plan_status` periodically to kick out users whose plan expires *during* their session.
