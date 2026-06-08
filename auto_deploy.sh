#!/bin/bash

# ==========================================
# 🚀 Automated WhatsApp App Deployment Script
# ==========================================




echo "Started Deployment Setup (Using Packaged Production Config)..."

# 0. Generate Dynamic Image Tag
# Check if a pre-generated env file exists (uploaded from local machine)
if [ -f deploy_env ]; then
    echo "📄 Found deploy_env, loading..."
    export $(cat deploy_env | xargs)
fi

# If IMAGE_TAG is still not set, try to generate it using git (Local fallback)
if [ -z "$IMAGE_TAG" ]; then
    echo "⚠️  IMAGE_TAG not found in deploy_env. Attempting to generate via Git..."
    if command -v git &> /dev/null && git rev-parse --is-inside-work-tree &> /dev/null; then
        GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD | sed 's/[^a-zA-Z0-9]/-/g')
        GIT_DATE=$(date +%Y%m%d)
        GIT_COMMIT=$(git rev-parse --short HEAD)
        export IMAGE_TAG="${GIT_BRANCH}-${GIT_DATE}-${GIT_COMMIT}"
    else
        echo "❌ Git not found or not a git repo. using 'latest-timestamp'"
        export IMAGE_TAG="latest-$(date +%Y%m%d%H%M%S)"
    fi
fi

echo "🏷️  Generated Docker Tag: $IMAGE_TAG"

# Write to .env for persistence/debugging
sed -i '/IMAGE_TAG=/d' .env
echo "IMAGE_TAG=$IMAGE_TAG" >> .env



# 1. Detect Traefik/N8N Network
echo "🔍 Detecting Traefik network..."

# 1. Detect Traefik/N8N Network
echo "🔍 Detecting Traefik network..."

# User confirmed network is 'root_default'
TRAEFIK_NETWORK="root_default"

# Verify if it exists, otherwise try to detect
if ! docker network inspect "$TRAEFIK_NETWORK" >/dev/null 2>&1; then
    echo "⚠️  'root_default' network not found. Trying auto-detection..."
    TRAEFIK_NETWORK=$(docker network ls --format "{{.Name}}" | grep -E "n8n|traefik|proxy|web|root_default" | head -n 1)
fi

if [ -z "$TRAEFIK_NETWORK" ]; then
    echo "❌ Could not find a network. Defaulting to 'root_default' and hoping for the best."
    TRAEFIK_NETWORK="root_default"
fi

echo "🎯 Using Network: $TRAEFIK_NETWORK"

# 2. Check for .env file
if [ ! -f .env ]; then
    echo "📄 Creating .env file..."
    touch .env
fi

# 3. Add/Update the TRAEFIK_NETWORK variable in .env
# Remove old entry if exists to avoid duplicates
sed -i '/TRAEFIK_NETWORK=/d' .env
echo "TRAEFIK_NETWORK=$TRAEFIK_NETWORK" >> .env
echo "✅ Added TRAEFIK_NETWORK to .env"

# 4. Check Supabase Config
if ! grep -q "SUPABASE_URL" server/.env; then
    echo "⚠️  WARNING: server/.env seems to be missing Supabase credentials!"
    echo "Please edit server/.env explicitly before the app will work."
    read -p "Press Enter to continue anyway..."
fi

# 4b. Load Production Config (From packaged .env)
echo "🌍 Loading Production Config..."

# Export CLIENT_URL from server/.env for build args
# This reads the key=value from the file and exports it to the shell
export $(grep "CLIENT_URL" server/.env | xargs)

# Export Supabase Config and APP_URL for Docker Compose variable substitution
export $(grep "SUPABASE_URL" server/.env | xargs)
export $(grep "SUPABASE_KEY" server/.env | xargs)
export $(grep "SUPABASE_SERVICE_KEY" server/.env | xargs)
export $(grep "APP_URL" server/.env | xargs)

echo "🎯 Targeted URL: $CLIENT_URL"

# Ensure docker-compose sees it in root .env too
sed -i '/CLIENT_URL=/d' .env
echo "CLIENT_URL=$CLIENT_URL" | tr -d '\r' >> .env

sed -i '/APP_URL=/d' .env
echo "APP_URL=$APP_URL" | tr -d '\r' >> .env

sed -i '/SUPABASE_URL=/d' .env
echo "SUPABASE_URL=$SUPABASE_URL" | tr -d '\r' >> .env

sed -i '/SUPABASE_KEY=/d' .env
echo "SUPABASE_KEY=$SUPABASE_KEY" | tr -d '\r' >> .env

sed -i '/SUPABASE_SERVICE_KEY=/d' .env
echo "SUPABASE_SERVICE_KEY=$SUPABASE_SERVICE_KEY" | tr -d '\r' >> .env

# Extract Domain from CLIENT_URL for Traefik Host Rule
# Removes protocol (http:// or https://) and any trailing path
DOMAIN=$(echo "$CLIENT_URL" | sed -E 's|^\w+://||' | cut -d/ -f1)
echo "🌐 Extracted Domain: $DOMAIN"
sed -i '/DOMAIN=/d' .env
echo "DOMAIN=$DOMAIN" | tr -d '\r' >> .env

sed -i '/ROUTER_NAME=/d' .env
d_safe=${DOMAIN//./_}
echo "ROUTER_NAME=$d_safe" | tr -d '\r' >> .env

# 5. Fix Permissions (Crucial for Non-Root Docker User)
echo "🔒 Fixing permissions for '${TRAEFIK_NETWORK}'..."
mkdir -p server_logs server_uploads
chown -R 1000:1000 server_logs server_uploads

# 5.5 Generate Traefik Override
echo "📝 Generating Traefik labels..."
d_safe=${DOMAIN//./_}
cat > docker-compose.override.yml <<EOF
services:
  whatsapp-app:
    labels:
      - "traefik.http.routers.${d_safe}.rule=Host(\`${DOMAIN}\`)"
      - "traefik.http.routers.${d_safe}.entrypoints=websecure"
      - "traefik.http.routers.${d_safe}.tls.certresolver=mytlschallenge"
      - "traefik.http.routers.${d_safe}-http.rule=Host(\`${DOMAIN}\`)"
      - "traefik.http.routers.${d_safe}-http.entrypoints=web"
      - "traefik.http.routers.${d_safe}-http.middlewares=redirect-https@file"
      - "traefik.http.routers.${d_safe}.service=whatsapp-app"
      - "traefik.http.routers.${d_safe}-http.service=whatsapp-app"
EOF

# 6. Build and Run (FORCE REBUILD)
echo "🚀 Building and Starting Containers (Fresh Build)..."
# Prune old builds to free space and ensure freshness
docker system prune -f
docker-compose down --remove-orphans
docker-compose build --no-cache
docker-compose up -d

# 6. Verification
echo "-----------------------------------"
echo "✅ Deployment Command Sent!"
echo "-----------------------------------"
echo "Check status with: docker logs whatsapp_app"
echo "App should be live at: $CLIENT_URL"
