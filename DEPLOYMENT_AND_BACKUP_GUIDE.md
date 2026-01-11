# 🚀 Central Deployment & Automated Backup System
> **Comprehensive Guide** for Multi-Tenant WhatsApp Application.

---

## 🏗️ System Architecture

This system automates two critical operations for multiple white-label tenants:
1.  **Deployment**: Pushing code updates to a central VPS and restarting containers per domain.
2.  **Backup & Maintenance**: Automatically backing up databases daily and cleaning old logs.

### Key Components

| Component | File / Script | Responsibility |
| :--- | :--- | :--- |
| **Orchestrator** | `central_deploy.ps1` | Runs on **Local Windows PC**. Validates, packages, uploads, and triggers deployment. |
| **Deployer** | `bulk_deploy.sh` | Runs on **Remote VPS**. Creates/Updates Docker containers for each tenant. |
| **Backup Service** | `docker-compose-backup.yml` | Runs on **Remote VPS**. A dedicated container that wakes up daily to dump databases. |
| **Config DB** | `domains.csv` | The single source of truth for Domains, IPs, API Keys, and DB Strings. |

---

## 🛠️ 1. Deployment Workflow (End-to-End)

When you run `.\central_deploy.ps1` locally, the following chain reaction occurs:

### Step 1: Pre-Flight Checks & Local Backup
*   **Action**: The script reads `domains.csv`.
*   **Backup**: It attempts to run `server/scripts/backup_databases.ps1` locally.
    *   If `pg_dump` is installed, it saves a snapshot to local `backups/` folder.
    *   If `pg_dump` is missing, it prints a warning but **CONTINUES**.
*   **Validation**: It connects to every Supabase instance (using API Keys) and verifies the Database Schema matches the "Reference" schema (using `validate_deployment.js`).

### Step 2: Packaging
*   **Script**: `prepare_upload.bat`
*   **Action**: Creates a `deploy-package.zip` containing:
    *   Client Build (React)
    *   Server Code (Node.js)
    *   **Backup Logic** (`backup/` folder, `docker-compose-backup.yml`)
    *   `domains.csv`
    *   Traefik Configs

### Step 3: Upload & Remote Execution
*   **Action**: Uses `scp` to upload the zip to your VPS (`145.79.15.115`).
*   **Action**: Uses `ssh` to execute `remote_exec.sh`, which unzips it and runs `bulk_deploy.sh`.

### Step 4: Container Deployment (On VPS)
*   **Script**: `bulk_deploy.sh`
*   **Loop**: Iterates through `domains.csv`:
    *   Generates a unique `.env` file for the tenant (`.env.chatmat_in`).
    *   Runs `docker-compose up -d` for that specific project.
    *   Assigns Traefik routers for SSL (`chatmat.in`).

### Step 5: Backup Service Launch
*   **Final Action**: `bulk_deploy.sh` triggers the **Backup System**:
    ```bash
    docker-compose -f docker-compose-backup.yml up -d --build
    ```
    This ensures the backup worker is always running and updated.

---

## 💾 2. Automated Database Backup System

We use a "Sidecar Container" approach. Instead of installing Postgres on the host, a lightweight Docker container handles all backups.

### How it Works
*   **Container Name**: `database_backup_worker`
*   **Image**: Alpine Linux + PostgreSQL Client Tools.
*   **Schedule**: Runs infinitely, waking up **every 24 hours**.

### The Backup Script (`backup/backup_cron.sh`)
Every 24 hours (86400 seconds), this script executes inside the container:

1.  **Read CSV**: Mounts and parses `/app/domains.csv`.
2.  **Cleanup (Maintenance)**:
    *   Connects to the database using the `DbConnection` string (Column 10).
    *   Executes `server/sql/cleanup_old_logs.sql`:
        *   Deletes `flow_sessions` older than **5 Days**.
        *   Deletes `webhook_logs` older than **5 Days**.
        *   Deletes `cron.job_run_details` older than **5 Days**.
3.  **Backup (Dump)**:
    *   Run `pg_dump` (Schema Only) -> `YYYYMMDD_HHMMSS_schema.sql`
    *   Run `pg_dump` (Data Only) -> `YYYYMMDD_HHMMSS_data.sql`
    *   Run `pg_dumpall` (Roles) -> `YYYYMMDD_HHMMSS_roles.sql`
4.  **Retention (File Cleanup)**:
    *   Checks the `/app/backups` folder.
    *   Deletes any `.sql` file older than **10 Days**.

### Where are backups stored?
*   **VPS Path**: `/root/deployment/database_backups/`
*   **Inside Container**: `/app/backups/`
*   *(These are synced via Docker Volumes)*.

---

## 📝 3. Configuration Reference (`domains.csv`)

The system effectively runs on this CSV file.

### Columns
| # | Name | Description | Example |
| :--- | :--- | :--- | :--- |
| 1 | **Domain** | The website URL (No https). | `chatmat.in` |
| 2 | **VPSIp** | IP Address of the server. | `145.79.15.115` |
| 3 | **VPSPassword** | SSH Password. | `Secret123` |
| 4 | **DeployEnabled** | `true`/`false`. | `true` |
| 5 | **TraefikNetwork** | Network to join. | `n8n_default` |
| 6 | **SupabaseUrl** | API URL. | `https://xyz.supabase.co` |
| 7 | **SupabaseKey** | Anon Key (Public). | `eyJ...` |
| 8 | **SupabaseServiceKey** | Service Role Key (Admin). | `eyJ...` (Must be Service Roll!) |
| 9 | **CertResolver** | SSL Resolver Name. | `mytlschallenge` |
| 10 | **DbConnection** | **POSTGRES URI for Backups**. | `postgres://postgres:pass@db.url:5432/postgres` |

---

## ❓ 4. Troubleshooting

### SSL Errors (`429 Rate Limit` / `403 ALPN`)
*   **Cause**: You deployed too many times quickly, or DNS conflicts (IPv6).
*   **Fix**:
    1.  Check DNS: Ensure **ONLY A-Record** exists. Delete AAAA records.
    2.  Wait: Rate limit bans last **1 Hour**.
    3.  Restart Traefik: `ssh root@<IP> "docker restart n8n-traefik-1"`

### Backup Errors ("No DB Connection String")
*   **Cause**: Column 10 in `domains.csv` is empty.
*   **Fix**: Add the connection string. Note that passwords with special chars must be URL Encoded (e.g. `@` -> `%40`).

### Code Deployment Issues
*   **"Container name already in use"**: The script handles specific naming (`chatmat_in`). If you manually created a container named `chatmat.in` (with dots), use `docker rm -f chatmat.in` to clear it.

---

**Generated by Antigravity**
For: User
Date: Jan 12, 2026
