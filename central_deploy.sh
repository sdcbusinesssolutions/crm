#!/usr/bin/env bash

# ==================================================================================
# 🚀 CENTRALIZED MULTI-SERVER DEPLOYMENT SCRIPT (Bash/Linux)
# ==================================================================================

set -e # Exit on error
set -o pipefail

CSV_FILE="domains.csv"

# --- LOGGING SETUP ---
LOG_DIR="deployment_logs"
if [ ! -d "$LOG_DIR" ]; then
    mkdir -p "$LOG_DIR"
fi
LOG_FILE="$LOG_DIR/deploy_$(date +'%Y%m%d_%H%M%S').log"

# Duplicate stdout and stderr to the log file (like PowerShell Start-Transcript)
exec > >(tee -a "$LOG_FILE") 2>&1

# Color Codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
DARKGRAY='\033[1;30m'
NC='\033[0m' # No Color

log_magenta() { echo -e "${MAGENTA}$1${NC}"; }
log_cyan() { echo -e "${CYAN}$1${NC}"; }
log_yellow() { echo -e "${YELLOW}$1${NC}"; }
log_red() { echo -e "${RED}$1${NC}"; }
log_green() { echo -e "${GREEN}$1${NC}"; }
log_darkgray() { echo -e "${DARKGRAY}$1${NC}"; }

log_magenta "LOGGING STARTED: $LOG_FILE"

# -------------------------------------------------------------------------
# Step 0: Sanitize Shell Scripts (Resave as LF)
# -------------------------------------------------------------------------
log_cyan "Fixing line endings for shell scripts (CRLF -> LF)..."
SCRIPTS=("remote_exec.sh" "bulk_deploy.sh" "auto_deploy.sh" "entrypoint.sh")
for script in "${SCRIPTS[@]}"; do
    if [ -f "$script" ]; then
        if grep -q $'\r' "$script"; then
            log_yellow "   Sanitizing: $script"
            sed -i 's/\r$//' "$script"
        fi
    fi
done

# -------------------------------------------------------------------------
# Step 1.5: Database Backup (Pre-Deployment)
# -------------------------------------------------------------------------
log_cyan "Starting Pre-Deployment Database Backup..."
if [ -f "docker-compose-backup.yml" ]; then
    if [ -f "server/scripts/backup_databases.sh" ]; then
        OLD_PWD=$(pwd)
        cd server/scripts
        # Ensure it has execution permissions
        chmod +x backup_databases.sh
        if ./backup_databases.sh; then
            log_green "   Backup completed successfully."
        else
            log_yellow "   [WARN] Local Backup Failed."
        fi
        cd "$OLD_PWD"
    else
        log_yellow "   Backup script not found. Skipping."
    fi
else
    log_yellow "   Backup configuration missing. Skipping."
fi

# -------------------------------------------------------------------------
# 1. Validation
# -------------------------------------------------------------------------
if [ ! -f "$CSV_FILE" ]; then
    log_red "ERROR: '$CSV_FILE' not found."
    exit 1
fi

# -------------------------------------------------------------------------
# 2. Package Code
# -------------------------------------------------------------------------
log_cyan "Packaging Code..."
if [ -f "./prepare_upload.sh" ]; then
    # Ensure it's executable and run it
    chmod +x ./prepare_upload.sh
    if ! ./prepare_upload.sh; then
        log_red "Packaging failed!"
        exit 1
    fi
else
    log_red "CRITICAL ERROR: prepare_upload.sh was not found."
    exit 1
fi

if [ ! -f "deploy-package.zip" ]; then
    log_red "CRITICAL ERROR: deploy-package.zip was not created."
    exit 1
fi

# -------------------------------------------------------------------------
# 5. Process CSV and Deploy
# -------------------------------------------------------------------------
# Read the CSV header line
HEADER=$(head -n 1 "$CSV_FILE" | tr -d '\r')

declare -A SERVER_ROWS
declare -a SERVER_IPS

# Parse the CSV file and group domains by VPSIp
while IFS= read -r line || [[ -n "$line" ]]; do
    # Skip empty lines or header
    if [ -z "$line" ] || [[ "$line" =~ ^Domain, ]]; then
        continue
    fi

    # Extract columns from line
    # To clean quotes and carriage returns
    clean_var() {
        echo "$1" | tr -d '\r' | sed -e 's/^"//' -e 's/"$//' | xargs
    }

    # Split row columns to read Domain, VPSIp, and DeployEnabled
    IFS=',' read -r domain vpsIp vpsPassword deployEnabled rest <<< "$line"

    domain=$(clean_var "$domain")
    vpsIp=$(clean_var "$vpsIp")
    deployEnabled=$(clean_var "$deployEnabled")

    # Lowercase DeployEnabled
    deployEnabledLower=$(echo "$deployEnabled" | tr '[:upper:]' '[:lower:]')

    if [ "$deployEnabledLower" = "true" ]; then
        if [ -z "${SERVER_ROWS[$vpsIp]}" ]; then
            SERVER_IPS+=("$vpsIp")
            SERVER_ROWS[$vpsIp]="$line"
        else
            SERVER_ROWS[$vpsIp]="${SERVER_ROWS[$vpsIp]}
$line"
        fi
    fi
done < "$CSV_FILE"

if [ ${#SERVER_IPS[@]} -eq 0 ]; then
    log_yellow "WARNING: No domains enabled."
    exit 0
fi

for vpsIp in "${SERVER_IPS[@]}"; do
    rows="${SERVER_ROWS[$vpsIp]}"
    
    # Count number of domains in group (number of lines in rows)
    count=$(echo "$rows" | wc -l | xargs)

    firstRow=$(echo "$rows" | head -n 1)
    IFS=',' read -r _ _ vpsPassword _ <<< "$firstRow"
    vpsPassword=$(clean_var "$vpsPassword")

    log_cyan "SERVER: $vpsIp ($count domains)"
    log_darkgray "Tip: Setup SSH keys to avoid password prompts: ssh-copy-id root@$vpsIp"

    tempCsv="domains_temp_$vpsIp.csv"
    echo "$HEADER" > "$tempCsv"
    echo "$rows" >> "$tempCsv"
    
    remoteDir="/www/wwwroot/whatsapp-app"
    
    # Prepare local staging folder for single-batch upload
    stagingDir="staging_$vpsIp"
    mkdir -p "$stagingDir"
    cp "deploy-package.zip" "$stagingDir/deploy-package.zip"
    cp "$tempCsv" "$stagingDir/domains.csv"
    
    if [ -f "remote_exec.bin" ]; then
        cp "remote_exec.bin" "$stagingDir/remote_exec.bin"
    else
        log_red "CRITICAL ERROR: remote_exec.bin not found! Please compile it first."
        rm -rf "$stagingDir"
        rm -f "$tempCsv"
        exit 1
    fi

    # 1. Create Directory (1st Prompt)
    echo "Initializing Remote Server..."
    sshpass -p "$vpsPassword" ssh -o StrictHostKeyChecking=no "root@$vpsIp" "mkdir -p $remoteDir"

    # 2. Upload Bundle (2nd Prompt)
    echo "Uploading Bundle (Zip, Config, Script)..."
    sshpass -p "$vpsPassword" scp -o StrictHostKeyChecking=no "$stagingDir/deploy-package.zip" "$stagingDir/domains.csv" "$stagingDir/remote_exec.bin" "root@${vpsIp}:${remoteDir}/"

    # Cleanup local staging
    rm -rf "$stagingDir"
    rm -f "$tempCsv"

    # 3. Execute Deployment (3rd Prompt)
    echo "Executing Deployment..."
    sshpass -p "$vpsPassword" ssh -o StrictHostKeyChecking=no -t "root@$vpsIp" "chmod +x $remoteDir/remote_exec.bin && $remoteDir/remote_exec.bin $remoteDir"
    
    log_green "Done: $vpsIp"
done

# Clean up local zip file to save space
rm -f deploy-package.zip

echo ""
log_cyan "Finished!"
