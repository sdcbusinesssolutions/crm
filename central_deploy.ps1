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
    Write-Host "Tip: Setup SSH keys to avoid password prompts: ssh-copy-id root@$vpsIp" -ForegroundColor DarkGray

    $tempCsv = "domains_temp_$vpsIp.csv"
    $domains | Export-Csv -Path $tempCsv -NoTypeInformation
    $remoteDir = "/www/wwwroot/whatsapp-app"
    
    # Prepare local staging folder for single-batch upload
    $stagingDir = "staging_$vpsIp"
    New-Item -ItemType Directory -Force -Path $stagingDir | Out-Null
    Copy-Item "deploy-package.zip" -Destination "$stagingDir/deploy-package.zip"
    Copy-Item $tempCsv -Destination "$stagingDir/domains.csv"
    Copy-Item "remote_exec.sh" -Destination "$stagingDir/remote_exec.sh"

    # 1. Create Directory (1st Prompt)
    Write-Host "Initializing Remote Server..."
    # dirname $remoteDir - removed
    ssh "root@$vpsIp" "mkdir -p $remoteDir"

    # 2. Upload Bundle (2nd Prompt)
    Write-Host "Uploading Bundle (Zip, Config, Script)..."
    scp "$stagingDir/deploy-package.zip" "$stagingDir/domains.csv" "$stagingDir/remote_exec.sh" "root@${vpsIp}:${remoteDir}/"

    # Cleanup local staging
    Remove-Item $stagingDir -Recurse -Force
    Remove-Item $tempCsv

    # 3. Execute Deployment (3rd Prompt)
    Write-Host "Executing Deployment..."
    ssh -t "root@$vpsIp" "chmod +x $remoteDir/remote_exec.sh && bash $remoteDir/remote_exec.sh $remoteDir"
    
    Write-Host "Done: $vpsIp" -ForegroundColor Green
}

# Clean up local zip file to save space
if (Test-Path "deploy-package.zip") { Remove-Item "deploy-package.zip" -Force }

Write-Host ""
Write-Host "Finished!" -ForegroundColor Cyan
Stop-Transcript
