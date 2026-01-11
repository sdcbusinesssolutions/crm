
# ==================================================================================
# 🚀 AUTOMATED DEPLOYMENT SCRIPT (Traefik Multi-Domain Ready)
# ==================================================================================
# This script automates setting up the environment for a specific domain.
# It ensures your Docker Setup matches your Real World URL and Keys.
# ==================================================================================

$ErrorActionPreference = "Stop"

function Show-Header {
    Write-Host "=========================================" -ForegroundColor Cyan
    Write-Host "   WHATSAPP APP - SMART DEPLOYMENT" -ForegroundColor Cyan
    Write-Host "=========================================" -ForegroundColor Cyan
}

Show-Header

# 1. Ask for Domain Configuration
# ----------------------------------------------------------------------------------
$defaultDomain = "cloudospire.in"
$domain = Read-Host "Enter Domain Name (default: $defaultDomain)"
if ([string]::IsNullOrWhiteSpace($domain)) { $domain = $defaultDomain }

# Auto-generate router name (sanitize dots to underscores)
$routerName = $domain -replace '\.', '_'

$defaultUrl = "https://$domain"
$appUrl = Read-Host "App URL (default: $defaultUrl)"
if ([string]::IsNullOrWhiteSpace($appUrl)) { $appUrl = $defaultUrl }

# 2. Ask for Supabase Keys (Critical for Frontend Build)
# ----------------------------------------------------------------------------------
# Try to read defaults from existing .env if valid
$defaults = @{}
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match "^SUPABASE_URL=(.*)") { $defaults["SUPABASE_URL"] = $matches[1] }
        if ($_ -match "^SUPABASE_KEY=(.*)") { $defaults["SUPABASE_KEY"] = $matches[1] }
        if ($_ -match "^SUPABASE_SERVICE_KEY=(.*)") { $defaults["SUPABASE_SERVICE_KEY"] = $matches[1] }
    }
}

Write-Host ""
Write-Host "Enter Supabase Credentials (Press Enter to keep existing if found):" -ForegroundColor Yellow

$sbUrl = Read-Host "Supabase URL [$(if($defaults.SUPABASE_URL){'Found'}else{'Required'})]"
if ([string]::IsNullOrWhiteSpace($sbUrl)) { $sbUrl = $defaults["SUPABASE_URL"] }

$sbKey = Read-Host "Supabase Anon Key [$(if($defaults.SUPABASE_KEY){'Found'}else{'Required'})]"
if ([string]::IsNullOrWhiteSpace($sbKey)) { $sbKey = $defaults["SUPABASE_KEY"] }

$sbServiceKey = Read-Host "Supabase Service Key [$(if($defaults.SUPABASE_SERVICE_KEY){'Found'}else{'Required'})]"
if ([string]::IsNullOrWhiteSpace($sbServiceKey)) { $sbServiceKey = $defaults["SUPABASE_SERVICE_KEY"] }

if (-not $sbUrl -or -not $sbKey -or -not $sbServiceKey) {
    Write-Error "Missing Supabase Credentials. Cannot proceed."
}

# 3. Generate Root .env File
# ----------------------------------------------------------------------------------
Write-Host "Generating .env file for $domain..." -ForegroundColor Cyan

$envContent = @"
IMAGE_TAG=production
TRAEFIK_NETWORK=root_default
CLIENT_URL=$appUrl
APP_URL=$appUrl
DOMAIN=$domain
ROUTER_NAME=$routerName
SUPABASE_URL=$sbUrl
SUPABASE_KEY=$sbKey
SUPABASE_SERVICE_KEY=$sbServiceKey
"@

$envContent | Out-File -FilePath ".env" -Encoding utf8 -Force

Write-Host "✅ Created .env file." -ForegroundColor Green

# 4. Build and Run Docker
# ----------------------------------------------------------------------------------
Write-Host "🐳 Building and Starting Docker Containers..." -ForegroundColor Cyan
Write-Host "   Target Domain: $domain" -ForegroundColor Gray
Write-Host "   Router Name:   $routerName" -ForegroundColor Gray

# Check valid docker
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Error "Docker is not installed or not in PATH."
}

# Pass the variables explicitly to ensure build args grab them
docker-compose down
docker-compose build
docker-compose up -d

# 5. Final Instructions
# ----------------------------------------------------------------------------------
Show-Header
Write-Host "✅ Deployment Complete!" -ForegroundColor Green
Write-Host "👉 App is running at: $appUrl" -ForegroundColor Cyan
Write-Host "👉 Logs are in:       ./server_logs/$domain/" -ForegroundColor Gray
Write-Host ""
Write-Host "⚠️  CRITICAL SUPABASE STEP:" -ForegroundColor Yellow
Write-Host "   1. Go to Supabase Dashboard > Auth > URL Configuration"
Write-Host "   2. Add '$appUrl' to 'Redirect URLs'"
Write-Host "   If you skip this, login links will fail or redirect wrong!" -ForegroundColor Red
Write-Host "=========================================" -ForegroundColor Cyan
