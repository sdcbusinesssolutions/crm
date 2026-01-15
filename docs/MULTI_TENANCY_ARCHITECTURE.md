# Comprehensive Multi-Tenancy & White-Label Architecture

## 1. Overview
This document details the architecture for enabling **Single-Database, Multi-Domain White-Labeling**. 
The goal is to allow 100+ different domains (e.g., `chatmat.in`, `clickube.com`) to serve their own users using a single backend and database, while maintaining strict data isolation, branding, and hierarchical admin controls.

## 2. Core Architecture Strategy
- **Database**: Single Shared Postgres Database (Supabase).
- **Isolation**: Row-Level Security (RLS) & API-Level Filtering based on `user_id` and `signup_domain`.
- **Authentication**: Centralized "Bounce" strategy via a **Master Domain**.
- **Admin Hierarchy**: 
    - **Super Admin** (Role-Based): Users with role `super_admin` can manage limits and plans for all tenants.
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
    *   **Expired Token Handling**: If `INITIAL_SESSION` provides an expired token, the specific dashboard logic (**Race Condition Handling**) prevents API calls until a valid refresh occurs.
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
**Problem**: Managing 100 tenants via SQL is inefficient; need granular control over user creation and limits.
**Solution**: A dedicated UI for the Provider.

1.  **Location**: `/admin/super` (Protected Route).
2.  **Capabilities**:
    *   **View All Tenants**: See summary of user counts, limits, and plan status.
    *   **Edit Limits**: Update `user_limit` for any specific domain directly via UI.
    *   **Impersonate Button**: One-click jump into any tenant's admin panel (Context-Aware Redirect).

### E. Tenant Limits & Quotas - **IMPLEMENTED**
**Problem**: Restrict user signup counts per tenant.
**Solution**: `public.tenant_limits` table + `BEFORE INSERT` trigger on `public.profiles`.
*   **Enforcement**: If `current_user_count >= user_limit` for a domain, the database `trigger` **REJECTS** the new sign-up transaction immediately.
*   **Management**: Limits can be updated via the Super Admin Dashboard.

### F. Tenant Plans & Expiry - **IMPLEMENTED**
**Problem**: Block access when a tenant subscription expires.
**Solution**: `public.tenant_plans` table + `check_admin_status` RPC.
*   Checked on every login. Use `expires_at` date to auto-block access.

### G. Admin Impersonation (Context-Aware) - **IMPLEMENTED**
**Problem**: Troubleshooting tenant issues without breaking session context.
**Solution**: `impersonateTenantAdmin` API.
*   Generates a magic link.
*   **Dynamic Redirect**: Detects the target user's `signup_domain` and redirects super admin to THAT domain.

---

## 4. How to Apply
1.  **Run SQL**: Execute ALL setup scripts in order:
    1.  `200_combined_multi_tenancy.sql` (Base Setup, Profiles, Plans, Branding)
    2.  `207_update_tenant_limit_rpc.sql` (Secure Limit Update)
2.  **Assign Role**: Manually assign `role = 'super_admin'` to your user in `public.profiles`.
3.  **Update Config**: Edit `domains.csv` to set `MasterDomain` for all rows.
4.  **Deploy**: Run `./bulk_deploy.sh`.

---

## 5. Security Model
1.  **Data Isolation**: Inherently enforced via RLS (Row Level Security) and API Controllers checking `signup_domain`.
2.  **Role-Based Access Control (RBAC)**: Critical RPCs (like updating limits) inspect `public.profiles.role`. Only `super_admin` can execute these changes.
3.  **Cross-Domain Protection**: Application logic prevents a user from `chatmat.in` logging into `clickube.com` (Strict Redirection).

---

## 6. Recommendations & Known Limitations
### A. Email Delivery Branding (Pending)
*   **Limitation**: Supabase sends emails (Reset Password, Magic Link) from a single configured SMTP server.
*   **Workaround**: Use generic branding or third-party webhooks (Resend/SendGrid) for white-labeled emails.

### B. Active Session Expiry
*   **Recommendation**: Add a frontend poller (`useEffect`) to check `check_user_plan_status` periodically to kick out users whose plan expires *during* their session.
