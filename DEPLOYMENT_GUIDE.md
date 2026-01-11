# 🚀 Central Multi-Tenant Deployment System

This document explains the architecture and usage of the automated deployment system for your white-label WhatsApp application. This system handles **Validation**, **Storage Provisioning**, **Building**, and **Deploying** to multiple VPS instances simultaneously.

---

## 1. System Architecture

The deployment is controlled by a central PowerShell script that coordinates several Node.js utilities to ensure infrastructure integrity before pushing code.

### 📁 Key Files
| File | Role | Description |
| :--- | :--- | :--- |
| **`central_deploy.ps1`** | **Orchestrator** | The main script. It manages logging, triggers validation, setup, build, and deployment. |
| **`domains.csv`** | **Configuration** | The database of all your domains, VPS IPs, and Supabase Credentials. |
| **`validate_deployment.js`** | **Deep Validator** | Connects to every database, fetches the **OpenAPI Schema**, and compares them to ensure all tables/columns match exactly. |
| **`setup_multitenant_media.js`** | **Storage Automator** | Checks/Creates the `campaign-media` storage bucket on every project, ensuring correct MIME types. |
| **`prepare_upload.bat`** | **Packager** | Zips the source code (excluding `node_modules`) for transfer. |
| **`deployment_logs/`** | **Audit Trail** | Directory containing timestamped global logs and **per-domain** detail reports. |

---

## 2. Deployment Workflow

When you run `.\central_deploy.ps1`, the following steps occur automatically:

### Step 1: Initialization & Logging
*   A unique log file is created in `deployment_logs/deploy_YYYYMMDD_HHMMSS.log`.
*   The script reads `domains.csv`.

### Step 2: 🛡️ Pre-Flight Deep Validation
*   **Script**: `server/scripts/validate_deployment.js`
*   **Action**: 
    1.  Fetches the live **OpenAPI Spec** from every Supabase instance defined in CSV.
    2.  Selects the first valid database as the "Gold Standard".
    3.  Compares every other database against it.
*   **Output**: 
    *   Generates a **Schema Match Report** for each domain (e.g., `deployment_logs/cloudospire.in_deploy.log`).
    *   Flags missing tables or columns.
    *   *Note: Deployment will check this but proceed with warnings (exit code 0).*

### Step 3: ☁️ Storage Automation
*   **Script**: `server/scripts/setup_multitenant_media.js`
*   **Action**:
    1.  Connects to each project.
    2.  Checks for the `campaign-media` bucket.
    3.  **Creates** it if missing, or **Updates** configuration if existing.
    4.  Ensures support for Images, Videos, Audio, PDFs, CSVs, and Office Docs.

### Step 4: 📦 Build & Package
*   **Action**: Runs `prepare_upload.bat`.
*   **Output**: Creates `deploy-package.zip`.

### Step 5: 🚀 Deployment (Per VPS)
*   **Action**: 
    1.  Groups domains by IP address from `domains.csv`.
    2.  Connects via SSH.
    3.  Uploads `deploy-package.zip` and a specific config CSV.
    4.  Runs `remote_exec.sh` on the server to restart Docker containers.

---

## 3. How to Use

### A. Pre-Requisites (New Domain)
1.  **Database Table**: You MUST manually run the SQL table creation script once per new project.
    *   Source: `server/sql/setup_campaign_media.sql`
    *   Location: Supabase Dashboard > SQL Editor.
2.  **Add to CSV**: Add the domain, VPS details, and Supabase Keys to `domains.csv`.

### B. Running Deployment
Open PowerShell in the root directory and run:
```powershell
.\central_deploy.ps1
```

### C. Verifying Success
1.  **Check Terminal**: Watch for "Done: <VPS_IP>" messages.
2.  **Check Logs**: Open `deployment_logs/` folder.
    *   Open `<domain>_deploy.log` to see the exact Schema Match Score and Storage Status for that client.

---

## 4. Troubleshooting

*   **"Missing Table: campaign_media"**: You forgot to run the SQL script in the dashboard. The automatic script handles *Storage Buckets* only, not *Database Tables*.
*   **"SKIP: Schema Fetch Failed"**: 
    *   **Cause**: The Supabase Service Key in `domains.csv` is invalid or expired.
    *   **Fix**: Check the `deployment_logs` or console output. If you see `{"message":"Invalid API key"}`, generate a new Service Key in Supabase (Settings > API) and update `domains.csv`.

*   **Git Push Errors ("object is corrupt")**: 
    *   **Cause**: Local repository database corruption.
    *   **Fix**: Refer to `GIT_RECOVERY_LOG.md` for the procedure used to repair the repo. In extreme cases, a fresh clone or re-init (as done on Jan 11, 2026) is required.

---

## 5. Quick Reference: domains.csv Format

The `domains.csv` file MUST strictly follow this header and structure. **Order Matters.**

```csv
Domain,VPSIp,VPSPassword,DeployEnabled,SupabaseUrl,SupabaseServiceKey,VitePort,ServerPort,DnsLink
cloudospire.in,145.79.15.115,your_ssh_pass,true,https://your-project.supabase.co,eyJ... (SERVICE_ROLE_KEY),5173,5000,cloudospire.in
```

*   **SupabaseServiceKey**: Must be the **SERVICE_ROLE** key (starts with `eyJ...`, usually long), NOT the Anon key. This is required for Storage Management and Schema Inspection.
*   **DeployEnabled**: Set to `true` to include in deployment, `false` to skip.

*   **SSL Errors ("Not Private")**: See `SSL_TROUBLESHOOTING.md`.

---
**Automated by Antigravity**
