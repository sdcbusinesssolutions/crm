#!/bin/bash
# Checks if bulk_deploy.sh needs unix conversion and runs it
# Checks if bulk_deploy.sh needs unix conversion and runs it
remote_dir=$1
cd "$remote_dir" || exit 1

# 1. Install dependencies if missing (unzip, dos2unix)
if ! command -v unzip &> /dev/null; then
    echo "Installing missing dependencies..."
    if command -v apt-get &> /dev/null; then
        apt-get update -y && apt-get install -y unzip dos2unix
    elif command -v yum &> /dev/null; then
        yum install -y unzip dos2unix
    elif command -v apk &> /dev/null; then
        apk add unzip dos2unix
    else
        echo "WARNING: Could not detect package manager. Ensure 'unzip' is installed."
    fi
fi

# 2. Unzip Package (contains generic domains.csv)
# We do this BEFORE processing the uploaded specific CSV so we can overwrite the generic one
unzip -q -o deploy-package.zip

# 3. Handle CSV file (Existing specific CSV should overwrite the one from the zip)
if ls domains_temp_*.csv 1> /dev/null 2>&1; then
    echo "Overwriting domains.csv with server-specific version..."
    mv -f domains_temp_*.csv domains.csv
fi

chmod +x bulk_deploy.bin
./bulk_deploy.bin

# 4. Clean up the zip file from server to save space
rm -f deploy-package.zip
