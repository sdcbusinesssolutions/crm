# Windows PowerShell Script to forcefully restart the application locally

Write-Host "Force Restarting WhatsApp Flow Builder & Admin Panel..." -ForegroundColor Cyan

# ----------------------------------------------------------------------------------
# 0. SELECT DOMAIN/DATABASE FROM CSV
# ----------------------------------------------------------------------------------
$csvFile = "domains.csv"
if (Test-Path $csvFile) {
    Write-Host "Reading '$csvFile' for configuration..." -ForegroundColor Cyan
    
    # Read CSV manually to handle quotes/commas if simple Import-Csv fails, 
    # but Import-Csv is usually robust enough for this standard format.
    $domains = Import-Csv $csvFile

    # 1. Try Auto-Select based on 'RunLocal' == 'true'
    $autoRows = $domains | Where-Object { $_.RunLocal -eq 'true' }
    $selectedRow = $null

    if ($autoRows) {
        if ($autoRows -is [array]) { $selectedRow = $autoRows[0] } else { $selectedRow = $autoRows }
        Write-Host "✅ Auto-selected configuration from CSV: $($selectedRow.Domain)" -ForegroundColor Green
    }
    else {
        # 2. Fallback to Interactive Menu
        Write-Host "------------------------------------------------"
        Write-Host "AVAILABLE DOMAINS FOR LOCAL DEV (No 'RunLocal=true' found):" -ForegroundColor White
        $i = 0
        foreach ($row in $domains) {
            $i++
            Write-Host "  [$i] $($row.Domain)" -ForegroundColor Yellow
        }
        Write-Host "------------------------------------------------"

        $validSelection = $false
        while (-not $validSelection) {
            $selection = Read-Host "Select a number to load configuration (1-$i)"
            if ($selection -match '^\d+$' -and [int]$selection -ge 1 -and [int]$selection -le $i) {
                $validSelection = $true
                $selectedRow = $domains[([int]$selection) - 1]
            }
            else {
                Write-Host "Invalid selection. Please try again." -ForegroundColor Red
            }
        }
        Write-Host "✅ Selected: $($selectedRow.Domain)" -ForegroundColor Green
    }

    # Extract Values
    $domain = $selectedRow.Domain
    $sbUrl = $selectedRow.SupabaseUrl
    $sbKey = $selectedRow.SupabaseKey
    $sbService = $selectedRow.SupabaseServiceKey
    $master = $selectedRow.MasterDomain

    # Handle defaults or missing columns if any
    if ([string]::IsNullOrWhiteSpace($master)) { $master = "https://$domain" }
    
    # Create valid local .env content
    # Note: We hardcode Client/App URL to localhost for dev, but inject the DB creds
    $envContent = @"
PORT=5000
NODE_ENV=development
DOMAIN=$domain
CLIENT_URL=http://localhost:3000
APP_URL=http://localhost:3000
SUPABASE_URL=$sbUrl
SUPABASE_KEY=$sbKey
SUPABASE_SERVICE_KEY=$sbService
SUPABASE_ANON_KEY=$sbKey
VITE_SUPABASE_URL=$sbUrl
VITE_SUPABASE_ANON_KEY=$sbKey
VITE_CLIENT_URL=http://localhost:3000
VITE_API_URL=http://localhost:5000
VITE_MASTER_URL=$master
BRIDGE_DOMAIN=$master
JWT_SECRET=super-secret-dev-jwt-key-change-in-prod
"@

    Write-Host "Updating local .env files..." -ForegroundColor Cyan
    
    # Update Server .env
    if (Test-Path "server/.env") { Copy-Item "server/.env" "server/.env.bak" -Force }
    Set-Content -Path "server/.env" -Value $envContent
    Write-Host "Updated server/.env" -ForegroundColor Gray

    # Update Client .env
    if (Test-Path "client/.env") { Copy-Item "client/.env" "client/.env.bak" -Force }
    Set-Content -Path "client/.env" -Value $envContent
    Write-Host "Updated client/.env" -ForegroundColor Gray
    
    Write-Host "New environment configured for '$domain'!" -ForegroundColor Green

}
else {
    Write-Warning "domains.csv not found! Using existing .env if present."
}

# 1. Kill Node.js and related processes to release locks
# -----------------------------------------------------
Write-Host "Stopping existing Node.js & Tooling processes to release file locks..." -ForegroundColor Yellow
$relatedProcesses = @("node", "nodemon", "vite", "npm")
foreach ($proc in $relatedProcesses) {
    Get-Process $proc -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
}

# -----------------------------------------------------
# 2. Release Ports (3000, 5000)
# -----------------------------------------------------
Write-Host "Releasing ports..." -ForegroundColor Yellow
npx kill-port 3000 5000 2>$null
Start-Sleep -Seconds 1 # Give OS time to release locks

# -----------------------------------------------------
# 3. Ensure Node.js is installed
# -----------------------------------------------------
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js is not installed. Please install it first."
    exit 1
}

# -----------------------------------------------------
# Helper Function: Repair Corrupted node_modules
# -----------------------------------------------------
function Repair-CorruptedNodeModules {
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
            
            try {
                # Attempt to remove forcefully first if it's really corrupted
                Remove-Item -Path $nodeModulesPath -Recurse -Force -ErrorAction SilentlyContinue
                if (Test-Path $nodeModulesPath) {
                    Rename-Item -Path $nodeModulesPath -NewName "node_modules_corrupted_$timestamp" -ErrorAction SilentlyContinue
                    Write-Host "  Renamed corrupted folder to: node_modules_corrupted_$timestamp" -ForegroundColor Yellow
                }
            }
            catch {
                Write-Host "  Strict cleanup failed, will attempt reinstall anyway..." -ForegroundColor Yellow
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
elseif (Repair-CorruptedNodeModules -Path "server") {
    $serverNeedsInstall = $true
}

if ($serverNeedsInstall) {
    Write-Host "Installing Server dependencies..." -ForegroundColor Green
    Push-Location "server"
    # Use 'npm ci' for faster, more reliable installs that match the lockfile
    # Fallback to 'npm install' only if 'npm ci' fails (e.g. lockfile mismatch/missing)
    npm ci
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  npm ci failed, falling back to npm install..." -ForegroundColor Yellow
        npm install
    }
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to install server dependencies! If you see 'symlink' errors, try running this terminal as Administrator or Enable 'Developer Mode' in Windows Settings."
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
elseif (Repair-CorruptedNodeModules -Path "client") {
    $clientNeedsInstall = $true
}

if ($clientNeedsInstall) {
    Write-Host "Installing Client dependencies..." -ForegroundColor Green
    Push-Location "client"
    # Use 'npm ci' for stability
    npm ci
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  npm ci failed, falling back to npm install..." -ForegroundColor Yellow
        npm install
    }

    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to install client dependencies! If you see 'symlink' errors, try running this terminal as Administrator or Enable 'Developer Mode' in Windows Settings."
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
Write-Host "Admin:    Admin@$domain / Admin@12345" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to stop the servers" -ForegroundColor Gray
