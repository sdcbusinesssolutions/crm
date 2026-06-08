#!/usr/bin/env bash

# This is a DRY RUN script to show you what bulk_deploy.sh generates
# It will NOT run docker-compose or deploy anything.

CSV_FILE="domains.csv"

declare -A SUPABASE_GROUPS

# Parse CSV
while IFS=, read -r domain vpsIp vpsPassword deployEnabled traefikNetwork supabaseUrl supabaseKey supabaseServiceKey certResolver dbConnection masterDomain runLocal trialDays deleteWindowDays isDev rest || [[ -n "$domain" ]]; do
    clean_var() { echo "$1" | tr -d '\r' | sed -e 's/^"//' -e 's/"$//' | xargs; }

    domain=$(clean_var "$domain")
    supabaseUrl=$(clean_var "$supabaseUrl")
    deployEnabled=$(clean_var "$deployEnabled")
    
    if [ -z "$domain" ] || [ "$domain" = "Domain" ]; then continue; fi
    deployEnabledLower=${deployEnabled,,}
    if [ "$deployEnabledLower" != "true" ]; then continue; fi

    if [ -z "${SUPABASE_GROUPS[$supabaseUrl]}" ]; then
        SUPABASE_GROUPS[$supabaseUrl]="$domain"
    else
        SUPABASE_GROUPS[$supabaseUrl]="${SUPABASE_GROUPS[$supabaseUrl]},$domain"
    fi
done < "$CSV_FILE"

echo -e "\n=== DRY RUN: Generating Override File ===\n"

for supabaseUrl in "${!SUPABASE_GROUPS[@]}"; do
    domains="${SUPABASE_GROUPS[$supabaseUrl]}"
    IFS=',' read -r -a domainArr <<< "$domains"
    primaryDomain="${domainArr[0]}"
    projectParam="wa_${primaryDomain//./_}"
    
    echo "Supabase Group : $supabaseUrl"
    echo "Primary Domain : $primaryDomain"
    echo "Project Name   : $projectParam"
    echo "Domains inside : ${#domainArr[@]}"
    echo ""
    echo "Output of docker-compose.override.yml for this group:"
    echo "--------------------------------------------------------"
    
    cat <<EOF
services:
  whatsapp-app:
    labels:
EOF
    
    certResolver="mytlschallenge"
    for d in "${domainArr[@]}"; do
        d_safe=${d//./_}
        cat <<EOF
      - "traefik.http.routers.${d_safe}.rule=Host(\`$d\`)"
      - "traefik.http.routers.${d_safe}.entrypoints=websecure"
      - "traefik.http.routers.${d_safe}.tls.certresolver=$certResolver"
      - "traefik.http.routers.${d_safe}-http.rule=Host(\`$d\`)"
      - "traefik.http.routers.${d_safe}-http.entrypoints=web"
      - "traefik.http.routers.${d_safe}-http.middlewares=redirect-https@file"
      - "traefik.http.routers.${d_safe}.service=$projectParam"
      - "traefik.http.routers.${d_safe}-http.service=$projectParam"
EOF
    done
    echo "--------------------------------------------------------"
    echo "Dry Run stops here (Normally it would run 'docker-compose -p $projectParam up -d')."
    echo ""
    
    # We only show the first group to keep output clean
    break
done
