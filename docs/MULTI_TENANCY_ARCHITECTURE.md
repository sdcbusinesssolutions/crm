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
**Problem**: Need granular control over tenants (Limits, Manual Creation, Deletion).
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
4.  **Delete Tenant Feature (New)**:
    *   Button: **"Delete"** (Red) in Super Panel.
    *   RPC: `delete_tenant(target_domain)`.
    *   Action: **Irreversibly removes** all limits, plans, branding, and user profiles associated with the domain.
    *   Safety: Prevents deletion of the Master Domain.

### E. Tenant Plans - **IMPLEMENTED**
*   **Expiry Check**: `check_admin_status` runs on login. If `tenant_plans.expires_at` is passed, access is blocked for ALL users of that domain.

### F. Admin Impersonation (Context-Aware) - **IMPLEMENTED**
*   **Impersonate**: One-click jump into any tenant's admin panel as if you were them.
*   **Context**: Redirects Super Admin to `tenant-domain.com`, preserving the tenant's context.
*   **Bounce Strategy (NEW)**: 
    *   Backend generates a Magic Link pointing to Master Domain (`clickube.com`) with `?bounce=target_domain`.
    *   Master App intercepts this, extracts the session token, and immediately redirects the user to `target_domain/#access_token=...`.
    *   This ensures the token is correctly handed over across domains without relying on flaky URL parameters.

### G. User Management Enhancements - **IMPLEMENTED**
*   **Direct Super Admin Creation**: Super Admins can now assign the `super_admin` role directly from the "Add User" UI.
*   **Tenant Stats**: Dashboard now dynamically fetches `user_count` vs `user_limit` using a corrected aggregation RPC (`get_my_tenant_stats`).

---

## 4. How to Apply (End-to-End)
1.  **Run SQL Scripts**: Execute the following in order:
    1.  `200_combined_multi_tenancy.sql` (Base Setup)
    2.  `207_update_tenant_limit_rpc.sql` (Limit Update Logic)
    3.  `208_add_tenant_rpc.sql` (Add Tenant Logic)
    4.  `209_get_my_tenant_stats.sql` (Stats Fix)
    5.  `210_delete_tenant_rpc.sql` (Delete Tenant Logic)
2.  **Assign Role (Initial)**: Manually assign yourself as Super Admin:
    ```sql
    UPDATE public.profiles SET role = 'super_admin' WHERE email = 'YOUR_EMAIL';
    ```
    *Subsequent Super Admins can be added via UI.*
3.  **Deploy**: Use `./bulk_deploy.sh` with your `domains.csv`.

---

## 5. Security Summary
1.  **RBAC**: Critical functions (`add_tenant`, `update_limit`, `delete_tenant`) REQUIRE `super_admin` role.
2.  **RLS**: Users can ONLY see data for their own `signup_domain`.
3.  **Isolation**: Users blocked from logging into wrong domains; Tokens strictly validated.

---

## 6. Scaling & Cost Analysis (Target: 100 Tenants / 5,000 Users)

### A. Workload Estimation
*   **Total Tenants**: 100 Domains
*   **Users per Tenant**: 50 Users
*   **Total User Base**: 5,000 Users
*   **Concurrency**: Assuming 10% active at once = **500 Concurrent Users**.
*   **Campaign Load**: High burst traffic. If 10 tenants trigger campaigns simultaneously, the system must handle thousands of outgoing webhook events per minute.

### B. Infrastructure Requirements

#### 1. Database (Supabase)
*   **Tier**: **Pro Plan ($25/mo)** is sufficient for 5k Users (limit is 100k MAU).
*   **Storage**: 5,000 users generates low relational data volume (< 1GB). Media storage (WhatsApp images) will be the main cost driver.
*   **bottleneck**: CPU usage on Row-Level Security (RLS) policies during high-concurrency campaigns.

#### 2. Compute (VPS / Backend)
*   **Strategy**: A "White-Label Cluster" using a strong single node or load-balanced setup.
*   **Recommended Spec (Hetzner/Contabo/DigitalOcean)**:
    *   **CPU**: 8 vCPU (High Performance recommended for encryption/hashing)
    *   **RAM**: 32 GB (Node.js loves RAM, plus caching)
    *   **Network**: 1 Gbps port (Vital for WhatsApp API webhooks)
*   **Software Stack**:
    *   **Traefik**: Handling 100 SSL certificates automatically (Let's Encrypt).
    *   **Redis**: CRITICAL for queuing WhatsApp messages. Do NOT send directly from API.
    *   **Node.js Cluster**: Use PM2 to run specific instances for incoming webhooks vs. API Workload.

### C. Monthly Cost Projection (Estimated)

| Component | Service Provider | Spec / Tier | Est. Cost |
| :--- | :--- | :--- | :--- |
| **Database** | Supabase | Pro Plan (8GB Disk, 100k MAU) | **$25.00** |
| **Compute** | Contabo / Hetzner | 8 vCPU / 30GB RAM / 1TB SSD | **$35.00** |
| **Media Storage** | Supabase Storage / S3 | 100GB (User Uploads) | **$20.00** |
| **Domain/DNS** | Cloudflare | Free Tier (Unlimited Zones) | **$0.00** |
| **Misc** | Backup / Monitoring | S3 Backup + Uptime Kuma | **$10.00** |
| **TOTAL** | | | **~$90.00 / Month** |

*Cost per Tenant: **$0.90 / Month** (Excellent Margin)*

### D. Scaling Roadmap

#### Phase 1: Single "Super Node" (Current)
*   **Capacity**: Up to ~10,000 Users / 200 Tenants.
*   **Architecture**: All services (API, Traefik, Redis) on one large VPS.
*   **Pros**: Simple deployment, lowest latency.
*   **Cons**: Single point of failure.

#### Phase 2: Horizontal split (Service Decoupling)
*   **Trigger**: CPU > 70% during campaigns.
*   **Action**: Move **Redis & Background Workers** (Campaign Senders) to a separate VP.
*   **Benefit**: User UI remains fast even when massive campaigns are running.

#### Phase 3: High Availability (Traffic > 50k Users)
*   **Trigger**: Database Connections maxing out.
*   **Action**:
    1.  Use **Supabase Read Replicas** (Enterprise feature).
    2.  Load Balance API across 3+ VPS nodes using Traefik or AWS ALB.
    3.  Implement `pgbouncer` for connection pooling.

---

## 7. Deep Dive: Architecture Alternatives & Hidden Costs

### A. Dedicated Containers vs. Shared Cluster
The user asked about **"Each Domain = Each Docker Container"**. Here is the cost comparison for 100 tenants:

#### Option 1: Shared Cluster (Current Strategy)
*   **Architecture**: Single Node.js Cluster handles ALL domains.
*   **Resource Usage**: 100 tenants share the same memory pool. 500 active users might use ~4GB RAM total.
*   **Cost**: **$35/mo** (One 8 vCPU VPS).
*   **Pros**: Max efficiency, lowest cost, instant tenant onboarding.

#### Option 2: Isolated Docker Containers (Per Tenant)
*   **Architecture**: 100 separate Docker containers (1 per domain).
*   **Resource Overhead**:
    *   Each Node.js container needs base ~200MB RAM idle.
    *   100 Containers * 200MB = **20 GB RAM** just for *idling*.
    *   Orchestration (Kubernetes/K8s) adds more overhead.
*   **Cost**: Steps up to **$200 - $400 / month**.
    *   Requires ~64GB RAM / 16 vCPU Server to run comfortably.
*   **Verdict**: **NOT RECOMMENDED** unless charging Enterprise clients >$500/mo for strict physical isolation. Use the Shared Cluster for White-Label SaaS.

### B. Supabase High Availability & Replicas
As traffic grows beyond 50k users, you might need Replicas.

1.  **Read Replicas**:
    *   Distributes "Read" load (analyzing reports, viewing dashes).
    *   **Cost**: Supabase charges for compute hours. Expect **+$75 to $150 / month** per replica depending on size.
2.  **Point-In-Time Recovery (PITR)**:
    *   Critical for disaster recovery (undoing an accidental "Delete Tenant").
    *   **Cost**: **+$28.75 / month** (Pro Add-on).
3.  **Connection Pooling (Supavisor)**:
    *   **Cost**: Free/Included. *Essential* to use port 6543 to avoid "Too Many Connections" errors during blasts.

### C. Hidden Costs & Load Handling
1.  **WhatsApp "Conversation" Charges (Meta)**:
    *   **The Big Cost**: You pay Meta per conversation (approx $0.03 - $0.05).
    *   **Handling**: You MUST pass this cost to your tenants (Credit System).
    *   **Risk**: If you pay Meta but tenants don't pay you = Bankruptcy.
2.  **Bandwidth / Egress**:
    *   VPS Providers (Hetzner/Contabo) offer generous traffic (20TB+).
    *   **AWS/GCP/Azure**: Charge ~$0.09/GB. Avoid for high-volume media sending.
3.  **Support Overhead**:
    *   100 Tenants = 100 Support Tickets.
    *   **Hidden Cost**: Hiring a Support Engineer ($500 - $2000/mo) becomes necessary once you hit 50+ active tenants.
4.  **IP Reputation**:
    *   If one tenant spams and gets your API IP blacklisted by Cloudflare or ISPs.
    *   **Mitigation**: Use "Floating IPs" or distinct Proxies for outgoing requests if sending emails.

### D. Summary Recommendation
Stick to the **Shared Cluster Architecture**. It limits overhead costs to <$100/mo, allowing you to maximize profit margins while charging tenants $50-$200/mo. Only move to Docker Isolation or Dedicated DB Replicas for Premium Enterprise Clients who pay for the infrastructure.

---

## 8. Technical Mechanics: How One Docker Container Handles 100 Tenants

Users often ask: *"How can one Node.js process serve 100 different domains?"*

### The Magic of "Logical Isolation"
Unlike physical factories where you need a separate machine for each product, a Web Server is like a **Stateless Kiosk**.

1.  **Incoming Request**:
    *   User A visits `chatmat.in`.
    *   User B visits `crm-master.com`.
    *   Both requests hit the **SAME** IP address and the **SAME** Docker container on port 3001.

2.  **Identification (The Host Header)**:
    *   The Node.js server looks at `req.headers.host`.
    *   If host is `chatmat.in`, it sets `tenant_id = 'chatmat'`.
    *   If host is `crm-master.com`, it sets `tenant_id = 'crm'`.

3.  **Data Retrieval (Context)**:
    *   When the code asks the Database: *"Get me the users"*, it implicitly adds: *"...WHERE domain = current_tenant_id"*.
    *   **Result**: The server processes thousands of mixed requests per second, but each request only ever touches its own data slice.

4.  **Memory Efficiency**:
    *   The server does **NOT** load 100 websites into RAM.
    *   It loads **1 Application Codebase** into RAM.
    *   It processes requests sequentially/concurrently using the same code, just changing the *variables* (Branding, Colors, Data) for that millisecond.

**Analogy**: Think of a single ATM machine. It serves customers from 100 different banks. It doesn't need 100 different slots. It just reads your card (Domain) and talks to the right bank account (Database Row).
