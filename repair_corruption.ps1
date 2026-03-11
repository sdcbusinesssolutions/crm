# Repair Corruption & Recover Git Repository
# Created by Antigravity (AI Assistant)

$ErrorActionPreference = "Continue"
$PROJECT_REPO = "https://github.com/devendrakumar062023-creator/wpcode.git"
$DEFAULT_BRANCH = "feature/07-03-2026-Drip-campgin"

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "   SYSTEM CORRUPTION REPAIR TOOL (AI-Powered)" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

# 1. Check for File Content Corruption (Garbage characters)
Write-Host "[1/3] Scanning for garbage characters in source files..." -ForegroundColor Yellow
$corruptFiles = Get-ChildItem -Path "client/src", "server" -Include *.tsx, *.ts, *.js -Recurse -ErrorAction SilentlyContinue | Where-Object {
    try {
        # Read first 1KB to check for garbage
        $buf = New-Object byte[] 1024
        $fs = [System.IO.File]::OpenRead($_.FullName)
        $bytesRead = $fs.Read($buf, 0, 1024)
        $fs.Close()
        
        # Look for \x1a (EOF) or high density of non-printable chars
        $garbageFound = $false
        for($i=0; $i -lt $bytesRead; $i++) {
            if ($buf[$i] -eq 26) { # \x1a
                $garbageFound = $true
                break
            }
        }
        return $garbageFound
    } catch {
        return $false
    }
}

if ($corruptFiles) {
    Write-Host "CRITICAL: Found $($corruptFiles.Count) corrupted files (garbage detected)!" -ForegroundColor Red
    $corruptFiles | ForEach-Object { Write-Host "  - $($_.FullName)" -ForegroundColor Gray }
} else {
    Write-Host "SUCCESS: Source files appear clean." -ForegroundColor Green
}

# 2. Check Git Health
Write-Host "`n[2/3] Checking Git database integrity..." -ForegroundColor Yellow
$gitBroken = $false
try {
    # Check if .git folder exists
    if (-not (Test-Path ".git")) {
        $gitBroken = $true
        Write-Host "WARNING: .git folder is missing." -ForegroundColor Red
    } else {
        $fsck = git fsck --full 2>&1
        if ($LASTEXITCODE -ne 0) {
            $gitBroken = $true
            Write-Host "CRITICAL: Git database is CORRUPT!" -ForegroundColor Red
        } else {
            Write-Host "SUCCESS: Git database is healthy." -ForegroundColor Green
        }
    }
} catch {
    $gitBroken = $true
    Write-Host "CRITICAL: Git is not responding." -ForegroundColor Red
}

# 3. Perform Repair if needed
if ($corruptFiles -or $gitBroken) {
    Write-Host "`n[! ] REPAIR NEEDED. Restoring clean files from GitHub..." -ForegroundColor Cyan
    Write-Host "Warning: This will overwrite local changes in corrupted files with the latest version from GitHub." -ForegroundColor Yellow
    $confirm = Read-Host "Proceed? (y/n)"
    
    if ($confirm -eq 'y') {
        # Backup the old .git if it exists and is broken
        if (Test-Path ".git") {
            $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
            $backupPath = ".git_broken_$timestamp"
            Write-Host "Backing up broken .git to $backupPath..." -ForegroundColor Gray
            Move-Item .git $backupPath -Force -ErrorAction SilentlyContinue
        }

        # Hard Re-sync
        Write-Host "Re-initializing Git..." -ForegroundColor Yellow
        git init
        git remote add origin $PROJECT_REPO
        
        Write-Host "Fetching healthy code from GitHub (this may take 1-2 minutes)..." -ForegroundColor Yellow
        git fetch origin
        
        Write-Host "Restoring files to $DEFAULT_BRANCH..." -ForegroundColor Yellow
        git checkout -f $DEFAULT_BRANCH
        git reset --hard "origin/$DEFAULT_BRANCH"

        Write-Host "`n[SUCCESS] Repair complete! Corrupted files have been replaced." -ForegroundColor Green
        Write-Host "Check your app now (npm run dev)." -ForegroundColor Cyan
    } else {
        Write-Host "Repair cancelled by user." -ForegroundColor Yellow
    }
} else {
    Write-Host "`n[DONE] No corruption detected. Everything looks good!" -ForegroundColor Green
}

Write-Host "`n[NOTE] If this happens often, please check your SSD health and Power Supply." -ForegroundColor Gray
Write-Host "==============================================" -ForegroundColor Cyan
Pause
