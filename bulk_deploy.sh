#!/usr/bin/env bash

# ==================================================================================
# 🚀 BULK DEPLOYMENT SCRIPT (Linux/Bash)
# ==================================================================================
# Usage: ./bulk_deploy.sh
# Requires: docker, docker-compose, and a 'domains.csv' file
# ==================================================================================

set -e # Exit on error
CSV_FILE="domains.csv"

# 1. Check CSV File
if [ ! -f "$CSV_FILE" ]; then
    echo "❌ '$CSV_FILE' not found."
    echo "👉 Please create '$CSV_FILE' with header: Domain,SupabaseUrl,SupabaseKey,SupabaseServiceKey"
    exit 1
fi

echo "✅ Found '$CSV_FILE'. Starting deployment..."
echo "------------------------------------------------------"

# 2. Loop Through CSV (Skipping Header)
# Using 'tail -n +2' to skip header, and Internal Field Separator (IFS) to parse CSV
# 1.5 Detect Docker Compose and Build Shared Image
if docker compose version >/dev/null 2>&1; then
    DOCKER_COMPOSE_CMD="docker compose"
    echo "✅ Using Docker Compose Plugin (docker compose)"
elif command -v docker-compose >/dev/null 2>&1; then
    DOCKER_COMPOSE_CMD="docker-compose"
    echo "✅ Using Docker Compose Standalone (docker-compose)"
else
    echo "⚠️  Docker Compose not found. Attempting fallback installation..."
    if [ -w /usr/local/bin ]; then
        curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        chmod +x /usr/local/bin/docker-compose
        DOCKER_COMPOSE_CMD="docker-compose"
    else
        echo "❌ Cannot install docker-compose (no write info). Please install it manually."
        exit 1
    fi
fi

export IMAGE_TAG="latest"
echo "🏗️  Building Shared Docker Image (whatsapp-app:$IMAGE_TAG)..."
docker build -t "whatsapp-app:$IMAGE_TAG" .

# 2. Loop Through CSV (Skipping Header)
# Using 'tail -n +2' to skip header, and Internal Field Separator (IFS) to parse CSV
tail -n +2 "$CSV_FILE" | while IFS=, read -r domain vpsIp vpsPassword deployEnabled traefikNetwork sbUrl sbKey sbServiceKey certResolver dbConnection masterDomain runLocal; do
    
    # Aggressive cleaning of variables to remove spaces and newlines
    domain=$(echo "$domain" | tr -d '\r' | xargs)
    vpsIp=$(echo "$vpsIp" | tr -d '\r' | xargs)
    vpsPassword=$(echo "$vpsPassword" | tr -d '\r' | xargs)
    deployEnabled=$(echo "$deployEnabled" | tr -d '\r' | xargs)
    traefikNetwork=$(echo "$traefikNetwork" | tr -d '\r' | xargs)
    sbUrl=$(echo "$sbUrl" | tr -d '\r' | xargs)
    sbKey=$(echo "$sbKey" | tr -d '\r' | xargs)
    sbServiceKey=$(echo "$sbServiceKey" | tr -d '\r' | xargs)
    certResolver=$(echo "$certResolver" | tr -d '\r' | xargs)
    masterDomain=$(echo "$masterDomain" | tr -d '\r' | xargs)
    runLocal=$(echo "$runLocal" | tr -d '\r' | xargs)
    
    if [ -z "$domain" ]; then continue; fi
    
    # Default CertResolver if missing
    if [ -z "$certResolver" ]; then
        certResolver="mytlschallenge"
    fi

    # Default MasterDomain to current domain if missing (Self-Hosted mode)
    if [ -z "$masterDomain" ]; then
         masterDomain="https://$domain"
    fi

    # Explicitly set BridgeDomain to Self (User Requirement)
    # This ensures "Bridge" refers to the tenant's own URL, while "Master" refers to the Auth Authority
    bridgeDomain="https://$domain"
    
    # Skip if not enabled (Case insensitive check)
    if [[ "${deployEnabled,,}" != "true" ]]; then
        echo "⏭️  Skipping $domain (DeployEnabled = $deployEnabled)"
        continue
    fi

    echo "🚀 Deploying: $domain"
    
    # Generate Unique Identifiers
    safeName=${domain//./_}       # cloudospire_in
    projectParam=$safeName        # Docker Project Name
    # imageTag="prod-$safeName"   # <--- REMOVED: We use shared 'latest' tag now
    appUrl="https://$domain"
    envFileName=".env.$safeName"

    echo "   🔎 DEBUG VARS for $domain:"
    echo "     - VPS: $vpsIp"
    echo "     - Resolver: $certResolver"
    echo "     - Master: $masterDomain"
    echo "     - Bridge: $bridgeDomain"

    # 3. Generate Domain-Specific .env File
    # We use quotes around values to ensure cleanliness
    cat > "$envFileName" <<EOF
PORT=5000
DOMAIN="$domain"
ROUTER_NAME="$safeName"
IMAGE_TAG="$IMAGE_TAG"
TRAEFIK_NETWORK="$traefikNetwork"
CERT_RESOLVER="$certResolver"
CLIENT_URL="$appUrl"
APP_URL="$appUrl"
SUPABASE_URL="$sbUrl"
SUPABASE_KEY="$sbKey"
SUPABASE_SERVICE_KEY="$sbServiceKey"
BRIDGE_DOMAIN="$bridgeDomain"
VITE_MASTER_URL="$masterDomain"
EOF

    echo "   📄 Config: $envFileName generated"

    # DEBUG: Print Env File
    echo "   🔎 DEBUG: Content of $envFileName:"
    cat "$envFileName"
    echo "   ---------------------------------"

    # 3b. Ensure Network Exists
    # Check if network exists, if not create it
    if ! docker network ls | grep -q "$traefikNetwork"; then
        echo "   🌐 Network '$traefikNetwork' not found. Creating it..."
        docker network create "$traefikNetwork"
    fi

    # 4. Run Docker Compose
    echo "   🐳 Starting container for $domain..."
    
    # CRITICAL FIX: docker-compose behaves best when the file is named exactly ".env"
    # This guarantees that variables like ${ROUTER_NAME} in docker-compose.yml are substituted correctly.
    
    # 1. Back up existing .env if it's not a symlink/temp
    if [ -f .env ] && [ ! -L .env ]; then
        mv .env .env.bak
    fi
    
    # 2. Copy our domain-specific config to .env
    cp "$envFileName" .env
    
    # 3. Cleanup Conflicting Containers
    # Since we strictly name the container using ${DOMAIN}, we must ensure no old one exists.
    # docker-compose should handle this, but explicit cleanup is safer against "Conflict" errors.
    docker rm -f "$domain" 2>/dev/null || true

    # 4. Run Docker Compose (Now it will naturally read .env)
    # NOTE: removed --build since we built 'latest' once at the top
    $DOCKER_COMPOSE_CMD -p "$projectParam" up -d
    
    # 4. Cleanup (optional, but good to keep distinct files)
    # mv .env.bak .env  <-- We leave it as is or restore? 
    # Actually, for multiple domains running in parallel, renaming .env repeatedly is risky if they run at same time.
    # BUT since we use "bulk_deploy" sequentially in a loop, it is safe.
    
    # Better: explicitly pass the inline vars to the command too, just to be 1000% sure?
    # No, copying to .env is the standard fix.


    echo "   ✅ Success: $domain is running."
    echo "------------------------------------------------------"

done


# 4.5 Cleanup OLD Domain-Specific Images (Migration Cleanup)
echo "🧹 Cleaning up OLD per-domain images (whatsapp-app:prod-*)..."
# List all images matching 'whatsapp-app:prod-*' and delete them using xargs
# This is safe because the NEW containers will be running on 'whatsapp-app:latest'
docker images "whatsapp-app" --format "{{.Repository}}:{{.Tag}}" | grep "prod-" | xargs -r docker rmi -f

# Also prune dangling images (standard hygiene)
docker image prune -f



# 5. Start Global Services (Backup)
echo "💾 Starting Database Backup System..."
if [ -f "docker-compose-backup.yml" ]; then
    $DOCKER_COMPOSE_CMD -f docker-compose-backup.yml up -d --build --remove-orphans

    echo "   ✅ Backup Service Running (Check with 'docker logs database_backup_worker')"
else
    echo "   ⚠️  docker-compose-backup.yml not found. Backup system skipped."
fi

echo "🎉 Bulk Deployment Finished!"
