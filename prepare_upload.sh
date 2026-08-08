#!/usr/bin/env bash

# ==================================================================================
# 🛍️ CLEAN BUILD AND PACKAGE (Optimized - Bash/Linux)
# ==================================================================================

set -e # Exit on error

echo "=========================================="
echo "🛍️  CLEAN BUILD AND PACKAGE (Optimized)"
echo "=========================================="

BUILD_DIR="../temp_deploy_build_wpcode"
ZIP_NAME="deploy-package.zip"

# 1. Cleanup previous runs
if [ -d "temp_deploy_build" ]; then
    rm -rf "temp_deploy_build"
fi
if [ -d "$BUILD_DIR" ]; then
    rm -rf "$BUILD_DIR"
fi
if [ -f "$ZIP_NAME" ]; then
    rm -f "$ZIP_NAME"
fi

echo ""
echo "🧹 Creating clean temporary directory..."
mkdir -p "$BUILD_DIR"

# 1a. Generate Deployment Info (Run locally where .git exists)
echo "🏷️  Generating Deployment Tag..."
GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "no-commit")
GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "no-branch")

# Sanitize Branch Name (replace non-alphanumeric with -)
GIT_BRANCH_CLEAN=$(echo "$GIT_BRANCH" | sed 's/[^a-zA-Z0-9]/-/g')

# Get Date
GIT_DATE=$(date +'%Y%m%d')

IMAGE_TAG="${GIT_BRANCH_CLEAN}-${GIT_DATE}-${GIT_COMMIT}"
echo "   Tag: $IMAGE_TAG"

# 1b. Automatically Build the Client
echo "🏗️  Building Client (Automated)..."
OLD_PWD=$(pwd)
cd client
echo "   Running npm install..."
npm install > /dev/null 2>&1 || { echo "❌ Failed to run npm install in client!"; exit 1; }
echo "   Running npm run build..."
npm run build > /dev/null 2>&1 || { echo "❌ Failed to build client!"; exit 1; }
cd "$OLD_PWD"
echo "✅ Client built successfully!"
echo ""

# 2. Copy CLIENT (Only Source Code and Dist)
echo "📂 Copying Client..."
mkdir -p "$BUILD_DIR/client"

# Use rsync if available, otherwise fallback to cp + find excludes
if command -v rsync >/dev/null 2>&1; then
    rsync -a \
        --exclude='node_modules' \
        --exclude='coverage' \
        --exclude='local_testing' \
        --exclude='doc' \
        --exclude='docs' \
        --exclude='*.log' \
        --exclude='.env*' \
        --exclude='*.md' \
        --exclude='*.txt' \
        --exclude='*.sql' \
        client/ "$BUILD_DIR/client/"
else
    echo "⚠️  rsync not found, using cp fallback (slower)..."
    cp -R client/* "$BUILD_DIR/client/"
    # Cleanup excludes manually
    find "$BUILD_DIR/client" -type d \( -name "node_modules" -o -name "coverage" -o -name "local_testing" -o -name "doc" -o -name "docs" \) -exec rm -rf {} + 2>/dev/null || true
    find "$BUILD_DIR/client" -type f \( -name "*.log" -o -name ".env*" -o -name "*.md" -o -name "*.txt" -o -name "*.sql" \) -delete 2>/dev/null || true
fi

# Write tag to file for remote use
echo "IMAGE_TAG=$IMAGE_TAG" > "$BUILD_DIR/deploy_env"

# 3. Copy SERVER (Only Production Code)
echo "📂 Copying Server..."
mkdir -p "$BUILD_DIR/server"

if command -v rsync >/dev/null 2>&1; then
    rsync -a \
        --exclude='node_modules' \
        --exclude='node_modules_old' \
        --exclude='uploads' \
        --exclude='logs' \
        --exclude='tests' \
        --exclude='tmp' \
        --exclude='doc' \
        --exclude='docs' \
        --exclude='documentation' \
        --exclude='sql' \
        --exclude='db_sql' \
        --exclude='debug_*.js' \
        --exclude='*.zip' \
        --exclude='*.log' \
        --exclude='.env*' \
        --exclude='.DS_Store' \
        --exclude='*.md' \
        --exclude='*.sql' \
        --exclude='*.txt' \
        --exclude='run_sql.js' \
        server/ "$BUILD_DIR/server/"

    # Explicitly ensure controllers are copied (Fix for missing module error)
    mkdir -p "$BUILD_DIR/server/controllers"
    rsync -a server/controllers/ "$BUILD_DIR/server/controllers/"
else
    echo "⚠️  rsync not found, using cp fallback (slower)..."
    cp -R server/* "$BUILD_DIR/server/"
    # Cleanup excludes manually
    find "$BUILD_DIR/server" -type d \( -name "node_modules" -o -name "node_modules_old" -o -name "uploads" -o -name "logs" -o -name "tests" -o -name "tmp" -o -name "doc" -o -name "docs" -o -name "documentation" -o -name "sql" -o -name "db_sql" \) -exec rm -rf {} + 2>/dev/null || true
    find "$BUILD_DIR/server" -type f \( -name "debug_*.js" -o -name "*.zip" -o -name "*.log" -o -name ".env*" -o -name ".DS_Store" -o -name "*.md" -o -name "*.sql" -o -name "*.txt" -o -name "run_sql.js" \) -delete 2>/dev/null || true
    # Re-copy controllers just in case
    mkdir -p "$BUILD_DIR/server/controllers"
    cp -R server/controllers/* "$BUILD_DIR/server/controllers/" 2>/dev/null || true
fi

# 3b. INJECT PRODUCTION CONFIG (The "Two Env File" Strategy)
echo "=========================================="
echo "⚠️  OVERWRITING .ENV WITH PRODUCTION CONFIG"
echo "=========================================="
if [ -f "server/.env.production" ]; then
    cp "server/.env.production" "$BUILD_DIR/server/.env"
    echo "   Successfully loaded server/.env.production"
else
    echo "⚠️  server/.env.production not found! Creating an empty one."
    touch "$BUILD_DIR/server/.env"
fi
echo ""
cat "$BUILD_DIR/server/.env"
echo ""

# 3c. Ensure SQL Scripts needed for Backup are present
mkdir -p "$BUILD_DIR/server/sql"
if [ -f "server/sql/cleanup_old_logs.sql" ]; then
    cp "server/sql/cleanup_old_logs.sql" "$BUILD_DIR/server/sql/"
fi

# 4. Copy Root Config Files
echo "📄 Copying Configs..."
[ -f "docker-compose.yml" ] && cp "docker-compose.yml" "$BUILD_DIR/"
[ -f "Dockerfile" ] && cp "Dockerfile" "$BUILD_DIR/"
[ -f "auto_deploy.sh" ] && cp "auto_deploy.sh" "$BUILD_DIR/"
[ -f "bulk_deploy.sh" ] && cp "bulk_deploy.sh" "$BUILD_DIR/"
[ -f "domains.csv" ] && cp "domains.csv" "$BUILD_DIR/"
[ -f ".dockerignore" ] && cp ".dockerignore" "$BUILD_DIR/"
[ -f "docker-compose-backup.yml" ] && cp "docker-compose-backup.yml" "$BUILD_DIR/"
[ -f "entrypoint.sh" ] && cp "entrypoint.sh" "$BUILD_DIR/"

mkdir -p "$BUILD_DIR/backup"
if [ -d "backup" ]; then
    if command -v rsync >/dev/null 2>&1; then
        rsync -a backup/ "$BUILD_DIR/backup/"
    else
        cp -R backup/* "$BUILD_DIR/backup/" 2>/dev/null || true
    fi
fi

# 5. Create Zip from Clean Folder
echo ""
echo "🗜️  Compressing optimized files..."
ZIP_OUT_PATH="$(pwd)/$ZIP_NAME"

if command -v zip >/dev/null 2>&1; then
    (cd "$BUILD_DIR" && zip -rq "$ZIP_OUT_PATH" .)
    echo "✅ Successfully compressed into $ZIP_NAME using system 'zip'"
elif command -v python3 >/dev/null 2>&1; then
    echo "⚠️  'zip' command not found, using Python 3 fallback to compress..."
    python3 -c "
import zipfile, os
zipf = zipfile.ZipFile('$ZIP_OUT_PATH', 'w', zipfile.ZIP_DEFLATED)
for root, dirs, files in os.walk('$BUILD_DIR'):
    for file in files:
        full_path = os.path.join(root, file)
        archive_name = os.path.relpath(full_path, '$BUILD_DIR')
        zipf.write(full_path, archive_name)
zipf.close()
"
    echo "✅ Successfully compressed into $ZIP_NAME using 'python3'"
else
    echo "❌ Error: Neither 'zip' nor 'python3' command was found. Please install zip."
    exit 1
fi

# 6. Cleanup Temp Folder
echo "🧹 Removing temp files..."
rm -rf "$BUILD_DIR"

echo ""
echo "=========================================="
echo "✅ DONE!"
echo "Created: $ZIP_NAME"
echo "Optimization:"
echo " - NO node_modules"
echo " - NO uploads/logs"
echo " - NO docs/md/txt"
echo " - NO sql dumps"
echo " - NO debug scripts"
echo "=========================================="
