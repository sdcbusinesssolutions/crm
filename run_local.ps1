# Windows PowerShell Script to forcefully restart the application locally

Write-Host "Force Restarting WhatsApp Flow Builder & Admin Panel..." -ForegroundColor Cyan

# -----------------------------------------------------
# 1. Kill ALL Node.js processes
# -----------------------------------------------------
Write-Host "Stopping existing Node.js processes..." -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

# -----------------------------------------------------
# 2. Kill ports 3000, 5000, 5001, 5173
# -----------------------------------------------------
Write-Host "Releasing ports..." -ForegroundColor Yellow
npx kill-port 3000 2>$null
npx kill-port 5000 2>$null
# npx kill-port 5001 2>$null
# npx kill-port 5173 2>$null

# -----------------------------------------------------
# 3. Ensure Node.js is installed
# -----------------------------------------------------
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js is not installed. Please install it first."
    exit 1
}

# -----------------------------------------------------
# Helper Function: Fix Corrupted node_modules
# -----------------------------------------------------
function Fix-CorruptedNodeModules {
    param (
        [string]$Path
    )
    
    $nodeModulesPath = Join-Path $Path "node_modules"
    
    if (Test-Path $nodeModulesPath) {
        Write-Host "  Checking for corrupted node_modules in $Path..." -ForegroundColor Yellow
        
        # Try to test if node_modules is accessible
        try {
            $null = Get-ChildItem $nodeModulesPath -ErrorAction Stop | Select-Object -First 1
        }
        catch {
            Write-Host "  Detected corrupted node_modules! Fixing..." -ForegroundColor Red
            
            # Clean npm cache
            Write-Host "  Cleaning npm cache..." -ForegroundColor Yellow
            npm cache clean --force 2>$null
            
            # Rename corrupted folder
            $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
            $backupPath = Join-Path $Path "node_modules_corrupted_$timestamp"
            
            try {
                Rename-Item -Path $nodeModulesPath -NewName "node_modules_corrupted_$timestamp" -ErrorAction SilentlyContinue
                Write-Host "  Renamed corrupted folder to: node_modules_corrupted_$timestamp" -ForegroundColor Yellow
            }
            catch {
                Write-Host "  Could not rename folder, will reinstall anyway..." -ForegroundColor Yellow
            }
            
            return $true
        }
    }
    
    return $false
}

# -----------------------------------------------------
# 4. Install dependencies if missing or corrupted
# -----------------------------------------------------

# Check and fix server dependencies
Write-Host "Checking Server dependencies..." -ForegroundColor Cyan
$serverNeedsInstall = $false
if (-not (Test-Path "server/node_modules")) {
    Write-Host "  Server node_modules not found" -ForegroundColor Yellow
    $serverNeedsInstall = $true
}
elseif (Fix-CorruptedNodeModules -Path "server") {
    $serverNeedsInstall = $true
}

if ($serverNeedsInstall) {
    Write-Host "Installing Server dependencies..." -ForegroundColor Green
    Push-Location "server"
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to install server dependencies!"
        Pop-Location
        exit 1
    }
    Pop-Location
}

# Check and fix client dependencies
Write-Host "Checking Client dependencies..." -ForegroundColor Cyan
$clientNeedsInstall = $false
if (-not (Test-Path "client/node_modules")) {
    Write-Host "  Client node_modules not found" -ForegroundColor Yellow
    $clientNeedsInstall = $true
}
elseif (Fix-CorruptedNodeModules -Path "client") {
    $clientNeedsInstall = $true
}

if ($clientNeedsInstall) {
    Write-Host "Installing Client dependencies..." -ForegroundColor Green
    Push-Location "client"
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to install client dependencies!"
        Pop-Location
        exit 1
    }
    Pop-Location
}

# Check root dependencies (if needed)
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing root dependencies..." -ForegroundColor Yellow
    npm install
}

# -----------------------------------------------------
# 5. Start Backend Server (port 5000)
# -----------------------------------------------------
Write-Host "Starting Backend Server..." -ForegroundColor Green
Start-Process -FilePath "npm.cmd" -ArgumentList "start" -WorkingDirectory "server" -NoNewWindow

# -----------------------------------------------------
# 5a. Wait for Backend to initialize
# -----------------------------------------------------
Write-Host "Waiting 5 seconds for Backend to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# -----------------------------------------------------
# 6. Start Frontend App (port 3000)
# -----------------------------------------------------
Write-Host "Starting Frontend Client..." -ForegroundColor Green
Start-Process -FilePath "npm.cmd" -ArgumentList "run dev" -WorkingDirectory "client" -NoNewWindow

# -----------------------------------------------------
# 7. Status
# -----------------------------------------------------
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Application restarted successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Backend:  http://localhost:5000" -ForegroundColor Yellow
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to stop the servers" -ForegroundColor Gray
