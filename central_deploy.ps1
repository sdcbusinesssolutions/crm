$ErrorActionPreference = "Stop"
$csvFile = "domains.csv"

# --- LOGGING SETUP ---
$logDir = "deployment_logs"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
$logFile = "$logDir\deploy_$(Get-Date -Format 'yyyyMMdd_HHmmss').log"
Start-Transcript -Path $logFile -Append

Write-Host "LOGGING STARTED: $logFile" -ForegroundColor Magenta

# -------------------------------------------------------------------------
# Step 0: Sanitize Shell Scripts (Resave as LF)
# -------------------------------------------------------------------------
Write-Host "Fixing line endings for shell scripts (CRLF -> LF)..." -ForegroundColor Cyan
$scripts = @("remote_exec.sh", "bulk_deploy.sh", "auto_deploy.sh", "entrypoint.sh")
foreach ($script in $scripts) {
    if (Test-Path $script) {
        $fullPath = Join-Path (Get-Location) $script
        $text = [System.IO.File]::ReadAllText($fullPath)
        if ($text.Contains("`r`n")) {
            Write-Host "   Sanitizing: $script" -ForegroundColor Yellow
            $text = $text.Replace("`r`n", "`n")
            $utf8NoBom = New-Object System.Text.UTF8Encoding $false
            [System.IO.File]::WriteAllText($fullPath, $text, $utf8NoBom)
        }
    }
}

# -------------------------------------------------------------------------
# Step 1.5: Database Backup (Pre-Deployment)
# -------------------------------------------------------------------------
Write-Host "Starting Pre-Deployment Database Backup..." -ForegroundColor Cyan
if (Test-Path "docker-compose-backup.yml") {
    if (Test-Path "server/scripts/backup_databases.ps1") {
        Set-Location "server/scripts"
        try {
            ./backup_databases.ps1 -ErrorAction Stop
        }
        catch {
            Write-Warning "   [WARN] Local Backup Failed: $_"
        }
        Set-Location ../..
    }
    else {
        Write-Warning "   Backup script not found. Skipping."
    }
}
else {
    Write-Warning "   Backup configuration missing. Skipping."
}

# -------------------------------------------------------------------------
# 1. Validation
# -------------------------------------------------------------------------
if (-not (Test-Path $csvFile)) {
    Write-Host "ERROR: '$csvFile' not found." -ForegroundColor Red
    exit 1
}

# -------------------------------------------------------------------------
# 2. Package Code
# -------------------------------------------------------------------------
Write-Host "Packaging Code..." -ForegroundColor Cyan
cmd /c prepare_upload.bat
if ($LASTEXITCODE -ne 0) {
    Write-Error "Packaging failed!"
    exit 1
}

if (-not (Test-Path "deploy-package.zip")) {
    Write-Error "CRITICAL ERROR: deploy-package.zip was not created."
    exit 1
}

# -------------------------------------------------------------------------
# 3. Pre-Flight Validation
# -------------------------------------------------------------------------
Write-Host "Validating Databases..." -ForegroundColor Cyan
node server/scripts/validate_deployment.js
if ($LASTEXITCODE -ne 0) {
    Write-Host "DEPLOYMENT HALTED: Validation Failed." -ForegroundColor Red
    exit 1
}

# -------------------------------------------------------------------------
# 4. Setup Media Storage
# -------------------------------------------------------------------------
Write-Host "Configuring Supabase Storage..." -ForegroundColor Cyan
node server/scripts/setup_multitenant_media.js

# -------------------------------------------------------------------------
# 5. Process CSV and Deploy
# -------------------------------------------------------------------------
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
    
    Write-Host "Creating Remote Directory..."
    ssh "root@$vpsIp" "mkdir -p $remoteDir"

    Write-Host "Uploading Files..."
    scp "deploy-package.zip" "root@${vpsIp}:${remoteDir}/"
    scp $tempCsv "root@${vpsIp}:${remoteDir}/domains.csv"
    scp "remote_exec.sh" "root@${vpsIp}:${remoteDir}/"

    Remove-Item $tempCsv

    Write-Host "Running Deployment..."
    ssh "root@$vpsIp" "chmod +x $remoteDir/remote_exec.sh"
    ssh -t "root@$vpsIp" "bash $remoteDir/remote_exec.sh $remoteDir"
    
    Write-Host "Done: $vpsIp" -ForegroundColor Green
}

Write-Host ""
Write-Host "Finished!" -ForegroundColor Cyan
Stop-Transcript
