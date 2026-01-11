#!/bin/sh

# ==============================================================================
# 🕒 Daily Database Backup Script (Docker Entrypoint)
# ==============================================================================

CSV_FILE="/app/domains.csv"
BACKUP_DIR="/app/backups"

echo "✅ Backup Service Started. Waiting for schedule..."

while true; do
    # Calculate current time
    CURRENT_HOUR=$(date +%H)
    
    # Run at 02:00 AM (or strictly every 24h if simple sleep)
    # For simplicity in this lightweight container, we loop daily.
    
    echo "🚀 Starting Daily Backup Job at $(date)..."

    if [ ! -f "$CSV_FILE" ]; then
        echo "❌ Error: '$CSV_FILE' not found inside container!"
    else
        # Determine column index of DbConnection (simple approach: assume last or specific)
        # Using a safer CSV parser for Docker Alpine (awk)
        
        # Skip header, read line by line
        tail -n +2 "$CSV_FILE" | while IFS=, read -r domain vpsip vpspass deployenabled traefiknet sburl sbkey sbservicekey certresolver dbconnection rest; do
            
            # Clean variables
            domain=$(echo "$domain" | tr -d '\r' | xargs)
            dbconnection=$(echo "$dbconnection" | tr -d '\r' | xargs)

            if [ -z "$domain" ]; then continue; fi
            if [ -z "$dbconnection" ]; then 
                echo "   ⚠️  Skipping $domain: No DB Connection String found (Col 10)."
                continue 
            fi

            TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
            TARGET_DIR="$BACKUP_DIR/$domain"
            mkdir -p "$TARGET_DIR"

            echo "   🧹 Running Cleanup..."
            psql "$dbconnection" -f /app/cleanup_old_logs.sql > /dev/null 2>&1
            if [ $? -eq 0 ]; then echo "      ✅ Cleanup OK"; else echo "      ⚠️  Cleanup Failed (Check Perms)"; fi

            echo "   📦 Backing up: $domain"
            
            # Dump Schema
            pg_dump "$dbconnection" --schema-only --no-owner --no-privileges > "$TARGET_DIR/${TIMESTAMP}_schema.sql" 2>/dev/null
            if [ $? -eq 0 ]; then echo "      ✅ Schema OK"; else echo "      ❌ Schema Failed"; fi

            # Dump Data
            pg_dump "$dbconnection" --data-only --no-owner --no-privileges > "$TARGET_DIR/${TIMESTAMP}_data.sql" 2>/dev/null
            if [ $? -eq 0 ]; then echo "      ✅ Data OK"; else echo "      ❌ Data Failed"; fi

            # Dump Roles (Attempt)
            # Note: This might fail if the user is not a superuser, but we try anyway.
            pg_dumpall --roles-only --dbname="$dbconnection" > "$TARGET_DIR/${TIMESTAMP}_roles.sql" 2>/dev/null
            if [ $? -eq 0 ]; then echo "      ✅ Roles OK"; else echo "      ⚠️  Roles Failed (Permission?)"; fi

        done
    fi

    echo "   🧹 Cleaning up old backups (>10 days)..."
    # Delete .sql files in /app/backups older than 10 days
    find "$BACKUP_DIR" -name "*.sql" -type f -mtime +10 -delete
    
    # Also clean up server logs if mounted (we didn't mount logs to this container yet, but if mapped to /app/logs)
    # find /app/logs -type f -mtime +10 -delete
    
    echo "💤 Sleeping for 24 Hours..."
    sleep 86400
done
