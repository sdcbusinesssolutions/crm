# Comprehensive Multi-Tenancy & White-Label Architecture

## 1. Overview
This document details the architecture for enabling **Single-Database, Multi-Domain White-Labeling**. 
The goal is to allow 100+ different domains (e.g., `chatmat.in`, `clickube.com`) to serve their own users using a single backend and database, while maintaining strict data isolation, branding, and hierarchical admin controls.

## 2. Core Architecture Strategy
- **Database**: Single Shared Postgres Database (Supabase).
- **Isolation**: Row-Level Security (RLS) & API-Level Filtering based on `user_id` and `signup_domain`.
- **Infrastructure**: **Single "Gold" Docker Image** deployed as **Isolated Containers** per tenant.
- **Authentication**: Centralized "Bounce" strategy via a **Master Domain**.
- **Admin Hierarchy**: 
    - **Super Admin**: Can manage limits, plans, and add tenants via Super Panel. Limits are strictly enforced.
    - **Tenant Admin**: Controls their own users.
    - **Impersonation**: Context-aware login jumping.

---

## 3. Implementation Details

### A. Centralized Authentication (The "Auth Bounce") - **IMPLEMENTED**
*Unchanged.*

### B. Deployment Configuration (Single Image / Runtime Config) - **NEW**
**Problem**: Building 100+ Docker images (one for each domain) is slow and wastes storage.
**Solution**: **"Build Once, Deploy Everywhere"** strategy.

1.  **Single "Gold" Image**:
    *   We build `whatsapp-app:latest` **ONCE**.
    *   This image contains the simplified code but **NO hardcoded environment variables**.
    *   Reduction: 100 Images (50GB) -> 1 Image (500MB).

2.  **Runtime Configuration Injection**:
    *   **Mechanism**: `entrypoint.sh` executes when a container starts.
    *   **Action**: It reads environment variables (`SUPABASE_URL`, `CLIENT_URL`, etc.) passed by Docker Compose.
    *   **Generation**: It creates a `public/config.js` file dynamically.
    *   **Frontend**: The browser loads this `config.js` to know which API to talk to.

3.  **Automation**: `bulk_deploy.sh` handles the orchestration, spinning up unique containers using the shared image.

### C. Dynamic Frontend Branding (Theme Engine) - **IMPLEMENTED**
*Unchanged.*

### D. Super Admin Provisioning & Limits - **UPDATED**
**Problem**: Need granular control over tenants.
**Solution**: **Super Panel** + Strict Limit Enforcement.

1.  **Tenant Limits**:
    *   **Strict Enforcement**: Database Trigger `check_tenant_limit` prevents signups above quota.
    *   **User Experience**: Users see a friendly error: *"Signup Failed: This workspace has reached its user limit."*
    *   **Modification**: Limits can **ONLY** be increased by a Super Admin via the Super Panel or Database. They do NOT auto-scale.

2.  **Delete Tenant**: Irreversibly purges a tenant's data.

### E. Tenant Plans - **IMPLEMENTED**
*Unchanged.*

### F. Admin Impersonation (Context-Aware) - **IMPLEMENTED**
*Unchanged.*

---

## 7. Deep Dive: Infrastructure Cost & Resource Analysis

### A. The "Single Image, Multi-Container" Architecture (Current)
We currently run **1 Docker Container per Tenant**, but they all share **1 Docker Image**.

*   **Architecture**: 100 Containers running on the VPS.
*   **Memory Usage**: High. Each Node.js container needs RAM.
    *   100 Containers * ~100MB = **10GB RAM** (Idle).
*   **Benefits**:
    *   **Isolation**: If one tenant crashes, others are unaffected.
    *   **Logs**: Separate log files for every tenant.
    *   **Security**: Environment variables are isolated per container.
*   **Cost**: Requires a larger VPS (e.g., 32GB RAM) for 100 tenants.

### B. Future Optimization: The "Shared Cluster"
If RAM becomes a bottleneck ($$$), we can switch to a **Single Container** serving all domains (Node.js Logic Isolation).
*   **Concept**: One process handles `chatmat.in` AND `clickube.com`.
*   **Pros**: Drastically lower RAM usage (~2GB for 100 tenants).
*   **Cons**: Higher risk (one crash kills all), harder to debug logs.

**Current Verdict**: Stick with **Multi-Container** for robustness until you exceed ~150 tenants, then consider clustering.

---

## 8. Technical Mechanics: Routing & Config

### How Traefik Handles 100 Tenants
1.  **Request**: User visits `clickube.com`.
2.  **Traefik**: Looks at the `Host` header.
3.  **Routing**: Matches the Host to the Docker Container named `prod-clickube_com`.
4.  **Processing**: The request is forwarded to that specific container's port 5000.

### How The App Knows Its Identity
1.  **Frontend**: loads `config.js` (generated at startup) which contains `VITE_CLIENT_URL = 'https://clickube.com'`.
2.  **API**: Reads `process.env.DOMAIN` (injected by Docker Compose) to know it is serving `clickube.com`.
