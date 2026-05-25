#!/bin/bash

# ==============================================================================
# Bulk Supabase Backup Script
# Requires 'pg_dump' to be installed.
# Usage: ./backup_databases.sh
# ==============================================================================

CSV_FILE="../../domains.csv"
BACKUP_DIR="../../backups"

# 1. Check Requirements
if ! command -v pg_dump &> /dev/null; then
    echo "❌ Error: 'pg_dump' could not be found. Please install postgresql-client."
    exit 1
fi

if [ ! -f "$CSV_FILE" ]; then
    echo "❌ Error: '$CSV_FILE' not found."
    exit 1
fi

mkdir -p "$BACKUP_DIR"

# 2. Parse CSV (Handling Headers)
# We assume the user adds 'DbConnection' column. We'll find its index dynamically or assume last.
# Simpler approach: We read line by line and try to fetch the column by name if possible, 
# but mostly we'll assume the user appends it as the 10th column or we parse by comma.

# Finding column index for DbConnection (Advanced)
header=$(head -n 1 "$CSV_FILE")
IFS=',' read -r -a columns <<< "$header"
col_index=-1
for i in "${!columns[@]}"; do
    if [[ "${columns[$i]}" =~ "DbConnection" ]]; then
        col_index=$i
        break
    fi
done

if [ $col_index -eq -1 ]; then
    echo "⚠️  Warning: 'DbConnection' column not found in header."
    echo "👉 Please calculate the DB Connection String manually or add the column."
else
    echo "✅ Found 'DbConnection' at column index $col_index"
fi

# 3. Process Rows
tail -n +2 "$CSV_FILE" | while IFS=, read -r line; do
    # Parse CSV line respecting quotes is hard in bash. We assume simple CSV.
    IFS=',' read -r -a fields <<< "$line"
    
    domain="${fields[0]}"
    
    # If we found the index, use it. Otherwise, assume user didn't add it.
    if [ $col_index -ne -1 ]; then
        dbUrl="${fields[$col_index]}"
        # Remove carriage return if any
        dbUrl=$(echo "$dbUrl" | tr -d '\r')
    else
        dbUrl=""
    fi

    if [ -z "$domain" ]; then continue; fi

    echo "📦 Processing: $domain"

    if [ -z "$dbUrl" ]; then
        echo "   ⚠️  Skipping: No DB Connection String found."
        continue
    fi

    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    TARGET_DIR="$BACKUP_DIR/$domain"
    mkdir -p "$TARGET_DIR"

    SCHEMA_FILE="$TARGET_DIR/${TIMESTAMP}_schema.sql"
    DATA_FILE="$TARGET_DIR/${TIMESTAMP}_data.sql"

    echo "   📄 Dumping Schema..."
    pg_dump --dbname="$dbUrl" --schema-only --no-owner --no-privileges --file="$SCHEMA_FILE"
    
    echo "   💾 Dumping Data..."
    pg_dump --dbname="$dbUrl" --data-only --no-owner --no-privileges --file="$DATA_FILE"

    echo "   ✅ Parsed $domain"
done
