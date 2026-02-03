# SSL & Deployment Fix Report (Feb 3, 2026)

## 1. The Issue
New deployments for domains like `chatmat.in` and `whatsappflow.in` were failing to provision SSL certificates (showing `NET::ERR_CERT_AUTHORITY_INVALID`), while older deployments (like `clickube.com`) were working fine.

## 2. Root Cause Analysis
The issue was traced to a **column mismatch** in the `bulk_deploy.sh` script, which corrupted the environment variables.

### The Mechanism of Failure:
1.  **CSV Structure**: Your `domains.csv` file has a column at the end called `RunLocal`.
    ```csv
    ...,MasterDomain,RunLocal
    ...,https://clickube.com,false
    ```
2.  **Script Logic (Before Fix)**: The `bulk_deploy.sh` script was only reading up to `masterDomain`:
    ```bash
    read -r ... dbConnection masterDomain; do
    ```
3.  **The Bash Behavior**: When `read` has fewer variables than columns, it assigns the **remainder of the line** to the last variable.
4.  **The Corruption**:
    *   **Expected**: `masterDomain` = `https://clickube.com`
    *   **Actual**: `masterDomain` = `https://clickube.com,false`
5.  **The Impact**:
    *   The environment variable `VITE_MASTER_URL` became `https://clickube.com,false`.
    *   This invalid URL format likely caused the application container to crash or malfunction.
    *   Because the container wasn't healthy, Traefik could not route traffic to it to solve the Let's Encrypt challenge, resulting in a default (invalid) certificate.

### Why `clickube.com` worked?
`clickube.com` had `DeployEnabled` set to `false`. The script simply **skipped** it, leaving the old, correctly configured container (from a previous successful deploy) running.

## 3. The Solution
We updated `bulk_deploy.sh` to explicitly read the final column.

**Code Change:**
```bash
# Before
tail -n +2 "$CSV_FILE" | while IFS=, read -r ... masterDomain; do

# After
tail -n +2 "$CSV_FILE" | while IFS=, read -r ... masterDomain runLocal; do
```

This simple change ensures that `masterDomain` receives *only* the URL, and `runLocal` receives the boolean value, preventing data corruption.

## 4. Verification Steps
1.  **Deploy**: Run `.\central_deploy.ps1`.
2.  **Wait**: Allow 1-2 minutes for the container to start and Traefik to request the certificate.
3.  **Check**: Visit `https://chatmat.in`. It should now show a secure padlock.
