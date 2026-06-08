#!/usr/bin/env bash

# ==================================================================================
# 🚀 BULK DEPLOYMENT SCRIPT (Linux/Bash)
# ==================================================================================
# SINGLE-CONTAINER MODE:
#   All enabled domains sharing the same Supabase project are merged into ONE
#   container with a combined Traefik rule:
#       Host(`domain1.com`) || Host(`domain2.com`) || Host(`domain3.com`)
#
# Usage: ./bulk_deploy.sh
# Requires: docker, docker-compose, and a 'domains.csv' file
# ==================================================================================

set -e # Exit on error
CSV_FILE="domains.csv"

# 1. Check CSV File
if [ ! -f "$CSV_FILE" ]; then
    echo "❌ '$CSV_FILE' not found."
    echo "👉 Please create '$CSV_FILE' with header: Domain,VPSIp,VPSPassword,DeployEnabled,TraefikNetwork,SupabaseUrl,SupabaseKey,SupabaseServiceKey,CertResolver,DbConnection,MasterDomain,RunLocal"
    exit 1
fi

echo "✅ Found '$CSV_FILE'. Starting deployment..."
echo "------------------------------------------------------"

# 1.5 Detect Docker Compose command
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
        echo "❌ Cannot install docker-compose (no write permission). Please install it manually."
        exit 1
    fi
fi

export IMAGE_TAG="latest"
echo "🏗️  Building Shared Docker Image (whatsapp-app:$IMAGE_TAG)..."
docker build -t "whatsapp-app:$IMAGE_TAG" .

# ==================================================================================
# 2. GROUP DOMAINS BY SUPABASE PROJECT (same sbUrl = same database = single container)
# ==================================================================================
# We read the CSV into parallel arrays indexed by a "group key".
# Group key = sanitized Supabase URL (e.g. "ssckorsnhjhzqxyukexm")
# For each group we collect:
#   - All domains           → used to build the Traefik Host() rule
#   - The primary row vars  → used for env, volumes, project name

# Associative arrays to hold group data
declare -A GROUP_DOMAINS       # key -> "domain1|domain2|domain3"
declare -A GROUP_VPSIP
declare -A GROUP_TRAEFIK_NET
declare -A GROUP_SB_URL
declare -A GROUP_SB_KEY
declare -A GROUP_SB_SERVICE_KEY
declare -A GROUP_CERT_RESOLVER
declare -A GROUP_MASTER_DOMAIN
declare -A GROUP_FIRST_DOMAIN   # the primary domain (first encountered per group)
declare -A GROUP_ORDER           # to preserve insertion order
declare -A GROUP_IS_DEV          # whether this group is a development environment
GROUP_COUNT=0

echo "📋 Reading and grouping domains from '$CSV_FILE'..."
    # Process each line, ensuring we handle files without a trailing newline
    while IFS=, read -r domain vpsIp vpsPassword deployEnabled traefikNetwork sbUrl sbKey sbServiceKey certResolver dbConnection masterDomain runLocal trialDays deleteWindowDays development || [[ -n "$domain" ]]; do

        # Clean all variables: remove \r, strip quotes, and trim whitespace
        clean_var() {
            echo "$1" | tr -d '\r' | sed -e 's/^"//' -e 's/"$//' | xargs
        }

        domain=$(clean_var "$domain")
        vpsIp=$(clean_var "$vpsIp")
        deployEnabled=$(clean_var "$deployEnabled")
        traefikNetwork=$(clean_var "$traefikNetwork")
        sbUrl=$(clean_var "$sbUrl")
        sbKey=$(clean_var "$sbKey")
        sbServiceKey=$(clean_var "$sbServiceKey")
        certResolver=$(clean_var "$certResolver")
        dbConnection=$(clean_var "$dbConnection")
        masterDomain=$(clean_var "$masterDomain")
        runLocal=$(clean_var "$runLocal")
        trialDays=$(clean_var "$trialDays")
        deleteWindowDays=$(clean_var "$deleteWindowDays")
        development=$(clean_var "$development")

        # Skip blank lines or header if it somehow leaked in
        if [ -z "$domain" ] || [ "$domain" == "Domain" ]; then continue; fi

        # Skip disabled entries
        if [[ "${deployEnabled,,}" != "true" ]]; then
            echo "⏭️  Skipping $domain (DeployEnabled = $deployEnabled)"
            continue
        fi

    # Default values
    if [ -z "$certResolver" ]; then certResolver="mytlschallenge"; fi
    if [ -z "$masterDomain" ]; then masterDomain="https://$domain"; fi
    if [ -z "$trialDays" ]; then trialDays="7"; fi
    if [ -z "$deleteWindowDays" ]; then deleteWindowDays="9"; fi

    # Build group key: extract the Supabase project ref from the URL
    # e.g. https://ssckorsnhjhzqxyukexm.supabase.co → ssckorsnhjhzqxyukexm
    groupKey=$(echo "$sbUrl" | sed 's|https://||' | cut -d'.' -f1)

    # Development environments get a separate group to avoid container conflicts
    isDev="false"
    if [[ "${development,,}" == "true" ]]; then
        groupKey="dev-${groupKey}"
        isDev="true"
    fi

    if [ -z "${GROUP_FIRST_DOMAIN[$groupKey]+x}" ]; then
        # First domain in this group — record all metadata
        GROUP_ORDER[$GROUP_COUNT]="$groupKey"
        GROUP_COUNT=$((GROUP_COUNT + 1))
        GROUP_FIRST_DOMAIN[$groupKey]="$domain"
        GROUP_VPSIP[$groupKey]="$vpsIp"
        GROUP_TRAEFIK_NET[$groupKey]="$traefikNetwork"
        GROUP_SB_URL[$groupKey]="$sbUrl"
        GROUP_SB_KEY[$groupKey]="$sbKey"
        GROUP_SB_SERVICE_KEY[$groupKey]="$sbServiceKey"
        GROUP_CERT_RESOLVER[$groupKey]="$certResolver"
        GROUP_MASTER_DOMAIN[$groupKey]="$masterDomain"
        GROUP_TRIAL_DAYS[$groupKey]="$trialDays"
        GROUP_DELETE_WINDOW[$groupKey]="$deleteWindowDays"
        GROUP_IS_DEV[$groupKey]="$isDev"
        GROUP_DOMAINS[$groupKey]="$domain"
    else
        # Additional domain in same group — append to domain list
        GROUP_DOMAINS[$groupKey]="${GROUP_DOMAINS[$groupKey]}|$domain"
    fi

done < <(tail -n +2 "$CSV_FILE")

echo "📦 Found $GROUP_COUNT deployment group(s)."
echo "======================================================"

# ==================================================================================
# 3. DEPLOY ONE CONTAINER PER GROUP
# ==================================================================================

for (( i=0; i<GROUP_COUNT; i++ )); do
    groupKey="${GROUP_ORDER[$i]}"
    primaryDomain="${GROUP_FIRST_DOMAIN[$groupKey]}"
    allDomains="${GROUP_DOMAINS[$groupKey]}"
    traefikNetwork="${GROUP_TRAEFIK_NET[$groupKey]}"
    sbUrl="${GROUP_SB_URL[$groupKey]}"
    sbKey="${GROUP_SB_KEY[$groupKey]}"
    sbServiceKey="${GROUP_SB_SERVICE_KEY[$groupKey]}"
    certResolver="${GROUP_CERT_RESOLVER[$groupKey]}"
    masterDomain="${GROUP_MASTER_DOMAIN[$groupKey]}"
    trialDays="${GROUP_TRIAL_DAYS[$groupKey]}"
    deleteWindowDays="${GROUP_DELETE_WINDOW[$groupKey]}"

    # Build Traefik Host() rule from the pipe-delimited domain list
    # Input: "clickube.com|apiautomation.in|chatmat.in"
    # Output: "Host(`clickube.com`) || Host(`apiautomation.in`) || Host(`chatmat.in`)"
    hostRule=""
    tlsMain="$primaryDomain"
    tlsSans=""
    IFS='|' read -ra domainArr <<< "$allDomains"
    for d in "${domainArr[@]}"; do
        if [ -z "$hostRule" ]; then
            hostRule="Host(\`$d\`)"
            # primary domain is already tlsMain, skip it for SANs
        else
            hostRule="$hostRule || Host(\`$d\`)"
            # All non-primary domains → SANs for the SAN certificate
            if [ -z "$tlsSans" ]; then
                tlsSans="$d"
            else
                tlsSans="$tlsSans,$d"
            fi
        fi
    done

    # Identifiers based on primary domain
    safeName=${primaryDomain//./_}
    isDev="${GROUP_IS_DEV[$groupKey]}"

    # Development environments get 'dev-' prefix to avoid conflicts with production
    if [[ "$isDev" == "true" ]]; then
        projectParam="dev-$safeName"
        echo "   🧪 MODE: DEVELOPMENT (container prefix: dev-)"
    else
        projectParam="$safeName"
    fi
    appUrl="https://$primaryDomain"
    bridgeDomain="$appUrl"
    envFileName=".env.$safeName"

    echo ""
    echo "🚀 Deploying single container for group: [$groupKey]"
    echo "   📌 Primary Domain : $primaryDomain"
    echo "   🌐 All Domains    : $(echo "$allDomains" | tr '|' ' ')"
    echo "   🔀 Traefik Rule   : $hostRule"
    echo "   🔒 TLS Main       : $tlsMain"
    echo "   🔒 TLS SANs       : ${tlsSans:-'(none – single domain)'}"
    echo "   🔑 Supabase URL   : $sbUrl"
    echo "   🔒 Cert Resolver  : $certResolver"

    # Ensure Traefik network exists
    if ! docker network ls | grep -q "$traefikNetwork"; then
        echo "   🌐 Network '$traefikNetwork' not found. Creating it..."
        docker network create "$traefikNetwork"
    fi

    # Generate .env file
    cat > "$envFileName" <<EOF
PORT=5000
DOMAIN="$primaryDomain"
ROUTER_NAME="$projectParam"
ROUTER_RULE=$hostRule
TLS_MAIN="$tlsMain"
TLS_SANS="$tlsSans"
IMAGE_TAG="$IMAGE_TAG"
TRAEFIK_NETWORK="$traefikNetwork"
CERT_RESOLVER="$certResolver"
CLIENT_URL="$appUrl"
APP_URL="$appUrl"
SUPABASE_URL="$sbUrl"
SUPABASE_KEY="$sbKey"
SUPABASE_SERVICE_KEY="$sbServiceKey"
BRIDGE_DOMAIN="$bridgeDomain"
VITE_MASTER_URL=$masterDomain
TRIAL_DAYS=$trialDays
TENANT_ADMIN_DELETE_WINDOW_DAYS=$deleteWindowDays
EOF

    echo "   📄 Config: $envFileName generated"
    echo "   🔎 DEBUG: Content of $envFileName:"
    cat "$envFileName"
    echo "   ---------------------------------"

    # Remove old container named after primary domain (cleanup)
    docker rm -f "$primaryDomain" 2>/dev/null || true

    # Copy to .env and deploy
    if [ -f .env ] && [ ! -L .env ]; then
        mv .env .env.bak
    fi
    cp "$envFileName" .env

    # Generate dynamic override file for per-domain routing
    echo "   📝 Generating docker-compose.override.yml for Traefik routers..."
    cat > docker-compose.override.yml <<EOF
services:
  whatsapp-app:
    labels:
EOF
    for d in "${domainArr[@]}"; do
        # Create safe router name from domain
        d_safe=${d//./_}
        cat >> docker-compose.override.yml <<EOF
      - "traefik.http.routers.\${d_safe}.rule=Host(\`\$d\`)"
      - "traefik.http.routers.\${d_safe}.entrypoints=websecure"
      - "traefik.http.routers.\${d_safe}.tls.certresolver=\$certResolver"
      - "traefik.http.routers.\${d_safe}-http.rule=Host(\`\$d\`)"
      - "traefik.http.routers.\${d_safe}-http.entrypoints=web"
      - "traefik.http.routers.\${d_safe}-http.middlewares=redirect-https@file"
      - "traefik.http.routers.\${d_safe}.service=\$projectParam"
      - "traefik.http.routers.\${d_safe}-http.service=\$projectParam"
EOF
    done

    # Development: 1 replica only. Production: use docker-compose.yml default (8 replicas)
    if [[ "$isDev" == "true" ]]; then
        echo "   🧪 DEV MODE: Starting with 1 replica only..."
        $DOCKER_COMPOSE_CMD -p "$projectParam" up -d --scale whatsapp-app=1
    else
        $DOCKER_COMPOSE_CMD -p "$projectParam" up -d
    fi

    echo "   ✅ Success: container for [$primaryDomain] is running (serving ${#domainArr[@]} domain(s))."
    echo "======================================================"

done

# ==================================================================================
# 4. Cleanup OLD per-domain images (Migration Cleanup)
# ==================================================================================
echo "🧹 Cleaning up OLD per-domain images (whatsapp-app:prod-*)..."
docker images "whatsapp-app" --format "{{.Repository}}:{{.Tag}}" | grep "prod-" | xargs -r docker rmi -f

# Prune dangling images
docker image prune -f

# ==================================================================================
# 5. Start Global Services (Backup)
# ==================================================================================
echo "💾 Starting Database Backup System..."
if [ -f "docker-compose-backup.yml" ]; then
    $DOCKER_COMPOSE_CMD -f docker-compose-backup.yml up -d --build --remove-orphans
    echo "   ✅ Backup Service Running (Check with 'docker logs database_backup_worker')"
else
    echo "   ⚠️  docker-compose-backup.yml not found. Backup system skipped."
fi

echo ""
echo "🎉 Bulk Deployment Finished! ($GROUP_COUNT group(s) deployed)"
