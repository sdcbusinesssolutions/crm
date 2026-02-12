
# ==================================================================================
# 🚀 BULK DEPLOYMENT SCRIPT (CSV Driven)
# ==================================================================================
# Automates deployment for multiple domains using a CSV file.
# Each domain gets its own isolated Docker stack and unique Frontend Build.
# ==================================================================================

$ErrorActionPreference = "Stop"
$csvFile = "domains.csv"

# 1. Check CSV File
# ----------------------------------------------------------------------------------
if (-not (Test-Path $csvFile)) {
    Write-Host "❌ '$csvFile' not found." -ForegroundColor Red
    Write-Host "👉 Created 'domains_example.csv'. Rename it to '$csvFile' and add your data." -ForegroundColor Yellow
    exit 1
}

$domains = Import-Csv $csvFile

Write-Host "✅ Found '$csvFile' with $(@($domains).Count) entries." -ForegroundColor Green
Write-Host "------------------------------------------------------" -ForegroundColor Gray

# 2. Loop Through Domains
# ----------------------------------------------------------------------------------
foreach ($entry in $domains) {
    $domain = $entry.Domain
    $sbUrl = $entry.SupabaseUrl
    $sbKey = $entry.SupabaseKey
    $sbServiceKey = $entry.SupabaseServiceKey
    
    # Optional: Replicas column (Default to 1 if missing/empty)
    $replicas = if ($entry.PSObject.Properties.Match('Replicas').Count -and -not [string]::IsNullOrWhiteSpace($entry.Replicas)) { 
        $entry.Replicas 
    }
    else { 
        1 
    }

    if ([string]::IsNullOrWhiteSpace($domain)) { continue }

    Write-Host "🚀 Deploying: $domain (Replicas: $replicas)" -ForegroundColor Cyan
    
    # Generate Unique Identifiers
    $safeName = $domain -replace '\.', '_' # e.g. abc_com
    $projectParam = $safeName               # Docker Compose Project Name
    $routerName = $safeName                 # Traefik Router Name
    $imageTag = "prod-$safeName"            # Unique Image Tag (Crucial for Frontend VITE vars)
    $appUrl = "https://$domain"

    # 3. Generate Domain-Specific .env File
    # ------------------------------------------------------------------------------
    $envFileName = ".env.$safeName"
    $envContent = @"
DOMAIN=$domain
ROUTER_NAME=$routerName
IMAGE_TAG=$imageTag
TRAEFIK_NETWORK=root_default
CLIENT_URL=$appUrl
APP_URL=$appUrl
SUPABASE_URL=$sbUrl
SUPABASE_KEY=$sbKey
SUPABASE_SERVICE_KEY=$sbServiceKey
APP_REPLICAS=$replicas
"@
    
    $envContent | Out-File -FilePath $envFileName -Encoding utf8 -Force
    Write-Host "   📄 Config: $envFileName generated" -ForegroundColor Gray

    # 4. Run Docker Compose
    # ------------------------------------------------------------------------------
    # -p : Sets project name (isolates containers: cloudospire_in_whatsapp-app_1)
    # --env-file : Uses the specific env file we just made
    
    Write-Host "   🐳 Building isolated image ($imageTag)..." -ForegroundColor Yellow
    
    # We use 'cmd /c' to explicitly call the docker-compose executable to avoid PowerShell parsing issues with flags
    cmd /c "docker-compose --env-file $envFileName -p $projectParam up -d --build"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Success: $domain is running." -ForegroundColor Green
    }
    else {
        Write-Host "   ❌ Failed to deploy $domain" -ForegroundColor Red
    }
    
    Write-Host "------------------------------------------------------" -ForegroundColor Gray
}

Write-Host "🎉 Bulk Deployment Finished!" -ForegroundColor Cyan
