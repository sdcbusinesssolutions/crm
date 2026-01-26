
# ==================================================================================
# CENTRAL MULTI-SERVER DEPLOYMENT SCRIPT (ASCII ONLY)
# ==================================================================================
$ErrorActionPreference = "Stop"
$csvFile = "domains.csv"

# --- LOGGING SETUP ---
$logDir = "deployment_logs"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
$logFile = "$logDir\deploy_$(Get-Date -Format 'yyyyMMdd_HHmmss').log"
Start-Transcript -Path $logFile -Append

Write-Host "LOGGING STARTED: $logFile" -ForegroundColor Magenta
# ---------------------

# -------------------------------------------------------------------------
# Step 1.5: 💾 Database Backup (Pre-Deployment)
# -------------------------------------------------------------------------
Write-Host "💾 Starting Pre-Deployment Database Backup..." -ForegroundColor Cyan
if (Test-Path "docker-compose-backup.yml") {
    # We use 'run --rm' to execute the script once and exit, ignoring the 'sleep' loop if possible, 
    # but since the script loops, we might need to rely on the side-effect that it runs once on startup.
    # Actually, the script loops forever. To run it *once* here, we should override the entrypoint or just let it run in background?
    # Better: We'll rely on the standalone script 'server/scripts/backup_databases.ps1' for this synchronous task.
    
    if (Test-Path "server/scripts/backup_databases.ps1") {
        cd "server/scripts"
        try { ./backup_databases.ps1 -ErrorAction Stop } catch { Write-Warning "   [WARN] Local Backup Failed (pg_dump missing?): $_" }
        cd ../..
    }
    else {
        Write-Warning "   ⚠️  Backup script not found. Skipping."
    }
}
else {
    Write-Warning "   ⚠️  Backup configuration missing. Skipping."
}
# -------------------------------------------------------------------------

# 1. Validation
if (-not (Test-Path $csvFile)) {
    Write-Host "ERROR: '$csvFile' not found." -ForegroundColor Red
    exit 1
}

# 5. Execute Prepare Upload Batch
Write-Host "Packaging Code..." -ForegroundColor Cyan
cmd /c prepare_upload.bat
if ($LASTEXITCODE -ne 0) {
    Write-Error "Packaging failed!"
    exit 1
}

# 5.1 Verification
if (-not (Test-Path "deploy-package.zip")) {
    Write-Error "❌ CRITICAL ERROR: deploy-package.zip was not created."
    Write-Host "   Possible causes:" -ForegroundColor Yellow
    Write-Host "   1. A file is locked by another process (VS Code, Node.js, etc.)" -ForegroundColor Yellow
    Write-Host "   2. See the error message above (e.g. 'process cannot access file')." -ForegroundColor Yellow
    exit 1
}

# 3. Pre-Flight Validation (Schema & Storage)
Write-Host "Validating Databases..." -ForegroundColor Cyan
node server/scripts/validate_deployment.js
if ($LASTEXITCODE -ne 0) {
    Write-Host "DEPLOYMENT HALTED: Validation Failed." -ForegroundColor Red
    exit 1
}

# 4. Setup Media Storage
Write-Host "Configuring Supabase Storage..." -ForegroundColor Cyan
node server/scripts/setup_multitenant_media.js

# 4. Process CSV
$allDomains = Import-Csv $csvFile
$deployableDomains = $allDomains | Where-Object { $_.DeployEnabled -eq 'true' }
if ($deployableDomains.Count -eq 0) {
    Write-Host "WARNING: No domains enabled." -ForegroundColor Yellow
    exit
}

$grouped = $deployableDomains | Group-Object VPSIp

foreach ($group in $grouped) {
    $vpsIp = $group.Name
    $domains = $group.Group
    $count = $domains.Count
    
    Write-Host "SERVER: $vpsIp ($count domains)" -ForegroundColor Cyan

    $tempCsv = "domains_temp_$vpsIp.csv"
    $domains | Export-Csv -Path $tempCsv -NoTypeInformation
    $remoteDir = "/www/wwwroot/whatsapp-app"
    
    # Pre-Flight: Create Directory
    Write-Host "Creating Remote Directory..."
    ssh "root@$vpsIp" "mkdir -p $remoteDir"

    # Upload Files
    Write-Host "Uploading Files..."
    scp "deploy-package.zip" "root@${vpsIp}:${remoteDir}/"
    scp $tempCsv "root@${vpsIp}:${remoteDir}/domains.csv"
    scp "remote_exec.sh" "root@${vpsIp}:${remoteDir}/"

    Remove-Item $tempCsv

    # Execute
    Write-Host "Running Deployment..."
    
    # Fix permissions
    ssh "root@$vpsIp" "chmod +x $remoteDir/remote_exec.sh"
    
    # Run it
    ssh -t "root@$vpsIp" "bash $remoteDir/remote_exec.sh $remoteDir"
    
    Write-Host "Done: $vpsIp" -ForegroundColor Green
}

Write-Host ""
Write-Host "Finished!" -ForegroundColor Cyan
Stop-Transcript
