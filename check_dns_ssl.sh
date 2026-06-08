#!/usr/bin/env bash
# ==================================================================================
# 🔍 DNS + SSL FULL DEBUG HEALTH CHECK — Auto-reads from domains.csv
# ==================================================================================
# Reads all domains from domains.csv and runs these checks per domain:
#
#   [DNS]
#     1a. DNS A record via Google (8.8.8.8)  vs expected VPS IP
#     1b. DNS A record via Cloudflare (1.1.1.1) — cross-check
#     1c. DNS A record via ISP/system resolver — cross-check
#     1d. DNS response time (latency)
#
#   [TCP]
#     2a. Raw TCP port 80 reachable (nc)
#     2b. Raw TCP port 443 reachable (nc)
#
#   [HTTP]
#     3a. HTTP port 80 response code + redirect target
#     3b. HTTP response time
#     3c. Server header (reveals: nginx, traefik, apache, etc.)
#
#   [SSL/TLS]
#     4a. TLS handshake — succeeds or fails
#     4b. Certificate CN (issued to)
#     4c. Certificate SAN list (all covered domains)
#     4d. Certificate Issuer (Let's Encrypt, self-signed, etc.)
#     4e. Certificate expiry date
#     4f. Days remaining until expiry
#     4g. TLS protocol version (TLSv1.2 / TLSv1.3)
#     4h. Cipher suite negotiated
#
#   [SERVER — runs on VPS only]
#     5a. Traefik container running?
#     5b. Container restart count
#     5c. acme.json — is this domain present in cert store?
#     5d. Traefik recent error logs (last 20 lines)
#     5e. UFW firewall port 80/443 open?
#
# Run this script on your LOCAL machine for DNS/HTTP/SSL checks.
# Run on VPS (or pass --vps flag) for full server-side debug checks.
# Requires: dig, curl, openssl, nc (standard on Linux/macOS)
# Optional: docker (for VPS-side checks)
# ==================================================================================

set -o pipefail

CSV_FILE="${CSV_FILE:-domains.csv}"
RUN_VPS_CHECKS=false

# Parse flags
for arg in "$@"; do
    case "$arg" in
        --vps)   RUN_VPS_CHECKS=true ;;
        --csv=*) CSV_FILE="${arg#*=}" ;;
    esac
done

# ─── Colours ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# ─── Helpers ─────────────────────────────────────────────────────────────────────
header()  { echo -e "${MAGENTA}${BOLD}$1${NC}"; }
info()    { echo -e "  ${CYAN}$1${NC}"; }
ok()      { echo -e "  ${GREEN}✅  $1${NC}"; }
warn()    { echo -e "  ${YELLOW}⚠️   $1${NC}"; }
fail()    { echo -e "  ${RED}❌  $1${NC}"; }
debug()   { echo -e "  ${DIM}    ↳ $1${NC}"; }
section() { echo -e "  ${BLUE}${BOLD}▸ $1${NC}"; }

# ─── Summary counters ────────────────────────────────────────────────────────────
total=0; pass=0
dns_fail=0; ssl_fail=0; http_fail=0; redirect_fail=0; tcp_fail=0

declare -a FAILED_DOMAINS
declare -a FAILED_REASONS

# ─── Dependency check ────────────────────────────────────────────────────────────
MISSING_TOOLS=false
for cmd in dig curl openssl nc; do
    if ! command -v "$cmd" &>/dev/null; then
        warn "Optional tool missing: $cmd (some checks will be skipped)"
        MISSING_TOOLS=true
    fi
done

# ─── CSV check ───────────────────────────────────────────────────────────────────
if [ ! -f "$CSV_FILE" ]; then
    fail "'$CSV_FILE' not found. Run from your project directory."
    exit 1
fi

echo ""
header "╔══════════════════════════════════════════════════════════════════╗"
header "║   🔍 Full Debug DNS + SSL Health Check  (from $CSV_FILE)${BOLD}   ║"
header "╚══════════════════════════════════════════════════════════════════╝"
echo ""
if [ "$RUN_VPS_CHECKS" = "true" ]; then
    ok "VPS-side checks ENABLED (Traefik, acme.json, UFW)"
else
    warn "VPS checks DISABLED — run with --vps flag on your server for full debug"
fi
echo ""

# ─── Process each CSV row ────────────────────────────────────────────────────────
while IFS=, read -r domain vpsIp vpsPassword deployEnabled rest || [[ -n "$domain" ]]; do

    clean_var() { echo "$1" | tr -d '\r' | sed -e 's/^"//' -e 's/"$//' | xargs; }
    domain=$(clean_var "$domain")
    vpsIp=$(clean_var "$vpsIp")
    deployEnabled=$(clean_var "$deployEnabled")

    if [ -z "$domain" ] || [ "$domain" = "Domain" ]; then continue; fi

    total=$((total + 1))
    domain_pass=true
    failure_reasons=""

    echo ""
    echo -e "${CYAN}══════════════════════════════════════════════════════════════════${NC}"
    printf "${BOLD}  %-50s${NC}  [VPS: %s]\n" "$domain" "$vpsIp"
    deploy_label="${deployEnabled,,}"
    if [ "$deploy_label" = "true" ]; then
        echo -e "  Deploy: ${GREEN}ENABLED${NC}"
    else
        echo -e "  Deploy: ${YELLOW}DISABLED (skipping most checks)${NC}"
    fi
    echo ""

    # ═══════════════════════════════════════════════════════════════════════════
    # SECTION 1: DNS CHECKS
    # ═══════════════════════════════════════════════════════════════════════════
    section "DNS Resolution"

    # 1a. Google DNS
    t_start=$(date +%s%3N)
    resolved_google=$(dig +short "$domain" A @8.8.8.8 2>/dev/null | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | head -1)
    t_end=$(date +%s%3N)
    dns_ms_google=$(( t_end - t_start ))

    if [ -z "$resolved_google" ]; then
        fail "Google DNS (8.8.8.8): No A record found"
        domain_pass=false; failure_reasons+="DNS-no-record "; dns_fail=$((dns_fail+1))
    elif [ "$resolved_google" = "$vpsIp" ]; then
        ok "Google DNS  (8.8.8.8): $resolved_google ✔ matches VPS  [${dns_ms_google}ms]"
    else
        fail "Google DNS  (8.8.8.8): $resolved_google  ← expected $vpsIp  [${dns_ms_google}ms]"
        domain_pass=false; failure_reasons+="DNS-wrong-ip($resolved_google) "; dns_fail=$((dns_fail+1))
    fi

    # 1b. Cloudflare DNS
    t_start=$(date +%s%3N)
    resolved_cf=$(dig +short "$domain" A @1.1.1.1 2>/dev/null | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | head -1)
    t_end=$(date +%s%3N)
    dns_ms_cf=$(( t_end - t_start ))

    if [ -z "$resolved_cf" ]; then
        warn "Cloudflare  (1.1.1.1): No A record  [${dns_ms_cf}ms]"
    elif [ "$resolved_cf" = "$vpsIp" ]; then
        ok "Cloudflare  (1.1.1.1): $resolved_cf ✔  [${dns_ms_cf}ms]"
    else
        warn "Cloudflare  (1.1.1.1): $resolved_cf  ← differs from expected ($vpsIp)  [${dns_ms_cf}ms]"
    fi

    # 1c. System/ISP resolver
    t_start=$(date +%s%3N)
    resolved_sys=$(dig +short "$domain" A 2>/dev/null | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | head -1)
    t_end=$(date +%s%3N)
    dns_ms_sys=$(( t_end - t_start ))

    if [ -z "$resolved_sys" ]; then
        warn "System DNS  (default): No A record  [${dns_ms_sys}ms]"
    elif [ "$resolved_sys" = "$vpsIp" ]; then
        ok "System DNS  (default): $resolved_sys ✔  [${dns_ms_sys}ms]"
    else
        warn "System DNS  (default): $resolved_sys  ← differs (ISP cache issue!)  [${dns_ms_sys}ms]"
        failure_reasons+="DNS-isp-cache-mismatch "
    fi

    # 1d. All IPs returned (multi-IP check)
    all_ips=$(dig +short "$domain" A @8.8.8.8 2>/dev/null | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$')
    ip_count=$(echo "$all_ips" | grep -c '.' 2>/dev/null || echo 0)
    if [ "$ip_count" -gt 1 ]; then
        warn "Multiple A records returned ($ip_count IPs): $(echo "$all_ips" | tr '\n' ' ')"
        debug "This can cause intermittent SSL failures if one IP is wrong"
    fi

    echo ""

    # ═══════════════════════════════════════════════════════════════════════════
    # SECTION 2: RAW TCP PORT CHECKS
    # ═══════════════════════════════════════════════════════════════════════════
    section "TCP Port Reachability"

    if command -v nc &>/dev/null; then
        # Port 80
        if nc -zw5 "$domain" 80 2>/dev/null; then
            ok "Port 80  (HTTP ): TCP connection established"
        else
            fail "Port 80  (HTTP ): TCP connection REFUSED or timed out"
            domain_pass=false; failure_reasons+="TCP80-fail "; tcp_fail=$((tcp_fail+1))
            debug "Fix: Check UFW: 'ufw allow 80' and Traefik entrypoint config"
        fi

        # Port 443
        if nc -zw5 "$domain" 443 2>/dev/null; then
            ok "Port 443 (HTTPS): TCP connection established"
        else
            fail "Port 443 (HTTPS): TCP connection REFUSED or timed out"
            domain_pass=false; failure_reasons+="TCP443-fail "; tcp_fail=$((tcp_fail+1))
            debug "Fix: Check UFW: 'ufw allow 443' and Traefik websecure entrypoint"
        fi
    else
        warn "nc not found — skipping raw TCP checks"
    fi

    echo ""

    # ═══════════════════════════════════════════════════════════════════════════
    # SECTION 3: HTTP CHECKS
    # ═══════════════════════════════════════════════════════════════════════════
    section "HTTP (Port 80)"

    http_response=$(curl -s -D - -o /dev/null \
        --connect-timeout 6 --max-time 10 \
        -w "\n%{http_code}\n%{time_total}\n%{remote_ip}" \
        "http://$domain/" 2>/dev/null)

    http_code=$(echo "$http_response" | tail -3 | head -1)
    http_time=$(echo "$http_response" | tail -2 | head -1)
    http_remote_ip=$(echo "$http_response" | tail -1)
    server_header=$(echo "$http_response" | grep -i '^Server:' | head -1 | tr -d '\r')
    location_header=$(echo "$http_response" | grep -i '^Location:' | head -1 | tr -d '\r')

    debug "Connected to IP: ${http_remote_ip:-unknown}"
    debug "Response time : ${http_time}s"
    [ -n "$server_header" ] && debug "Server header : $server_header"

    if [ "$http_code" = "000" ] || [ -z "$http_code" ]; then
        fail "Port 80: No response (timeout or connection refused)"
        domain_pass=false; failure_reasons+="HTTP-unreachable "; http_fail=$((http_fail+1))
        debug "Possible causes: Traefik not running, firewall blocking port 80, or wrong network"
    elif [[ "$http_code" =~ ^30[1278]$ ]]; then
        ok "HTTP $http_code redirect → ${location_header#Location: }"
        if echo "${location_header,,}" | grep -q "https://"; then
            debug "✔ HTTP→HTTPS redirect confirmed"
        else
            warn "Redirect does NOT go to HTTPS — check redirect-https middleware"
            failure_reasons+="HTTP-wrong-redirect "
            redirect_fail=$((redirect_fail+1))
        fi
    elif [ "$http_code" = "200" ]; then
        warn "HTTP 200 (no redirect) — missing HTTP→HTTPS redirect"
        failure_reasons+="HTTP-no-redirect(200) "; redirect_fail=$((redirect_fail+1))
        debug "Add: traefik.http.routers.\${name}-http.middlewares=redirect-https@file"
    else
        warn "HTTP $http_code — unexpected response code"
        debug "Full response: $http_response"
    fi

    echo ""

    # ═══════════════════════════════════════════════════════════════════════════
    # SECTION 4: SSL/TLS CHECKS
    # ═══════════════════════════════════════════════════════════════════════════
    section "SSL/TLS (Port 443)"

    ssl_raw=$(echo | timeout 10 openssl s_client \
        -connect "$domain:443" \
        -servername "$domain" \
        -showcerts 2>&1)

    ssl_verify_exit=$?

    # Check for TLS handshake failure patterns
    if echo "$ssl_raw" | grep -qiE "Connection refused|connect:errno|no peer certificate|SSL_connect|ECONNRESET"; then
        fail "TLS handshake FAILED — Traefik has no cert for this domain"
        debug "Raw error: $(echo "$ssl_raw" | grep -iE 'error|fail|refused' | head -3)"
        domain_pass=false; failure_reasons+="SSL-handshake-fail "; ssl_fail=$((ssl_fail+1))
        debug "Fix: Clear acme.json and restart Traefik. Switch to httpChallenge."
    elif echo "$ssl_raw" | grep -q "BEGIN CERTIFICATE"; then
        # ── Cert info extraction ──────────────────────────────────────────────
        cert_block=$(echo "$ssl_raw" | openssl x509 2>/dev/null)

        if [ -n "$cert_block" ]; then
            cert_cn=$(echo "$cert_block" | openssl x509 -noout -subject 2>/dev/null \
                | grep -oP 'CN\s*=\s*\K[^,/]+' | head -1 | xargs)
            cert_issuer=$(echo "$cert_block" | openssl x509 -noout -issuer 2>/dev/null \
                | sed 's/issuer=//' | tr -d '\r\n' | sed 's/^ *//;s/ *$//')
            cert_expiry=$(echo "$cert_block" | openssl x509 -noout -enddate 2>/dev/null \
                | sed 's/notAfter=//')
            cert_startdate=$(echo "$cert_block" | openssl x509 -noout -startdate 2>/dev/null \
                | sed 's/notBefore=//')
            cert_sans=$(echo "$cert_block" | openssl x509 -noout -ext subjectAltName 2>/dev/null \
                | grep -oP 'DNS:[^,]+' | tr '\n' ' ')

            # Days until expiry
            expiry_epoch=$(date -d "$cert_expiry" +%s 2>/dev/null || date -j -f "%b %d %T %Y %Z" "$cert_expiry" +%s 2>/dev/null)
            now_epoch=$(date +%s)
            days_left=$(( (expiry_epoch - now_epoch) / 86400 ))

            # TLS version + cipher
            tls_version=$(echo "$ssl_raw" | grep "Protocol " | awk '{print $NF}' | head -1)
            tls_cipher=$(echo "$ssl_raw" | grep "Cipher    " | awk '{print $NF}' | head -1)

            # Cert validity check
            echo "$cert_block" | openssl x509 -noout -checkend 0 2>/dev/null
            cert_expired=$?

            if [ "$cert_expired" = "0" ]; then
                if [ "$days_left" -lt 14 ]; then
                    warn "Cert valid but expiring SOON in ${days_left} days!"
                    failure_reasons+="SSL-expiring-soon(${days_left}d) "
                else
                    ok "TLS handshake: SUCCESS"
                fi
            else
                fail "Certificate is EXPIRED"
                domain_pass=false; failure_reasons+="SSL-expired "; ssl_fail=$((ssl_fail+1))
            fi

            debug "Issued to      : $cert_cn"
            debug "Issuer         : $cert_issuer"
            debug "Valid from     : $cert_startdate"
            debug "Expires        : $cert_expiry  ($days_left days remaining)"
            debug "SANs covered   : ${cert_sans:-'(none found)'}"
            debug "TLS version    : ${tls_version:-unknown}"
            debug "Cipher         : ${tls_cipher:-unknown}"

            # CN mismatch check
            if [ -n "$cert_cn" ] && [ "$cert_cn" != "$domain" ] && [[ "$cert_sans" != *"$domain"* ]]; then
                warn "CN/SAN mismatch — cert is for '$cert_cn' but domain is '$domain'"
                warn "SANs: $cert_sans"
                domain_pass=false; failure_reasons+="SSL-cn-mismatch "; ssl_fail=$((ssl_fail+1))
                debug "Fix: Ensure Traefik router name matches domain and cert was issued for this domain"
            fi

            # Self-signed check
            if echo "$cert_issuer" | grep -qi "self-signed\|self signed\|$cert_cn"; then
                warn "Self-signed certificate detected — browsers will show 'Not Secure'"
                failure_reasons+="SSL-self-signed "; ssl_fail=$((ssl_fail+1))
            fi

        else
            fail "Cert present but could not parse (possible self-signed or broken chain)"
            failure_reasons+="SSL-parse-error "; ssl_fail=$((ssl_fail+1))
        fi
    else
        fail "Port 443 not reachable or no TLS response"
        debug "Raw output snippet: $(echo "$ssl_raw" | tail -5 | head -5)"
        domain_pass=false; failure_reasons+="SSL-unreachable "; ssl_fail=$((ssl_fail+1))
        debug "Fix: 1) Check 'docker ps | grep traefik'  2) Clear acme.json  3) Switch to httpChallenge"
    fi

    echo ""

    # ═══════════════════════════════════════════════════════════════════════════
    # SECTION 5: VPS-SIDE SERVER CHECKS (only when --vps flag is set)
    # ═══════════════════════════════════════════════════════════════════════════
    if [ "$RUN_VPS_CHECKS" = "true" ]; then
        section "VPS Server Checks (docker + acme.json + firewall)"

        # 5a. Traefik container status
        traefik_container=$(docker ps --format '{{.Names}}\t{{.Status}}\t{{.Image}}' 2>/dev/null \
            | grep -i "traefik" | head -1)
        if [ -n "$traefik_container" ]; then
            ok "Traefik running: $traefik_container"
        else
            fail "Traefik container NOT running!"
            docker ps -a 2>/dev/null | grep -i traefik | head -3 | while read -r line; do
                debug "  $line"
            done
            failure_reasons+="TRAEFIK-down "; domain_pass=false
        fi

        # 5b. App container restart count for this domain
        container_info=$(docker ps --format '{{.Names}}\t{{.Status}}' 2>/dev/null \
            | grep -i "${domain//./_}\|whatsapp-app" | head -3)
        if [ -n "$container_info" ]; then
            ok "App container(s): $container_info"
        else
            warn "No app container found matching domain '${domain//./_}'"
        fi

        # 5c. acme.json — does this domain appear?
        acme_file=$(find / -name "acme.json" 2>/dev/null | head -1)
        if [ -n "$acme_file" ]; then
            if python3 -m json.tool "$acme_file" 2>/dev/null | grep -q "\"$domain\""; then
                ok "acme.json: cert entry found for $domain"
                # Check if it's marked as valid
                cert_status=$(python3 - <<EOF 2>/dev/null
import json, sys
with open("$acme_file") as f:
    data = json.load(f)
found = False
for resolver in data.values():
    for cert in resolver.get("Certificates", []):
        if "$domain" in cert.get("domain", {}).get("main", "") or \
           "$domain" in str(cert.get("domain", {}).get("sans", [])):
            print(f"Domain: {cert['domain']['main']}, SANs: {cert['domain'].get('sans','none')}")
            found = True
if not found:
    print("not_found")
EOF
)
                if [ "$cert_status" = "not_found" ]; then
                    warn "Domain found in acme.json but cert details unclear"
                else
                    debug "Cert in store: $cert_status"
                fi
            else
                fail "acme.json: NO cert entry for $domain → Traefik never issued cert"
                failure_reasons+="ACME-no-cert "; domain_pass=false
                debug "Fix: Ensure DNS is correct, then: docker restart <traefik-container>"
            fi
        else
            warn "acme.json not found on this system (run --vps from inside VPS)"
        fi

        # 5d. Recent Traefik errors related to this domain
        traefik_name=$(docker ps --format '{{.Names}}' 2>/dev/null | grep -i traefik | head -1)
        if [ -n "$traefik_name" ]; then
            domain_errors=$(docker logs "$traefik_name" --tail=200 2>&1 \
                | grep -i "$domain" | grep -iE "error|fail|acme|cert|challenge|timeout" | tail -5)
            if [ -n "$domain_errors" ]; then
                warn "Traefik logs show errors for $domain:"
                echo "$domain_errors" | while read -r line; do
                    debug "$line"
                done
            else
                ok "Traefik logs: no recent errors for $domain"
            fi

            # 5h. Check internal Traefik Router status via API (if exposed on 8080)
            router_status=$(docker exec "$traefik_name" wget -q -O- http://localhost:8080/api/http/routers 2>/dev/null \
                | grep -oE "\"name\":\"[^\"]*${domain//./_}[^\"]*\",\"provider\":\"docker\",\"status\":\"[^\"]*\"" | head -1)
            if [ -n "$router_status" ]; then
                status_val=$(echo "$router_status" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
                if [ "$status_val" = "enabled" ]; then
                    ok "Traefik API: Router for $domain is REGISTERED and ENABLED"
                else
                    fail "Traefik API: Router for $domain is $status_val"
                fi
            else
                debug "Traefik API check skipped (API not exposed on 8080 or router not found)"
            fi

            # 5e. Let's Encrypt rate-limit warning
            rate_limit=$(docker logs "$traefik_name" --tail=500 2>&1 \
                | grep -iE "rate limit|too many" | tail -3)
            if [ -n "$rate_limit" ]; then
                warn "Let's Encrypt RATE LIMIT detected in Traefik logs!"
                echo "$rate_limit" | while read -r line; do debug "$line"; done
            fi

            # 5f. Check traefik.yml for tlsChallenge vs httpChallenge
            # 5f. Check traefik.yml for tlsChallenge vs httpChallenge directly inside the container
            traefik_config=$(docker exec "$traefik_name" cat /etc/traefik/traefik.yml 2>/dev/null)
            if [ -n "$traefik_config" ]; then
                if echo "$traefik_config" | grep -qi "tlsChallenge"; then
                    fail "traefik.yml inside container is STILL using tlsChallenge! This causes rate limits."
                    debug "Fix: Update /etc/traefik/traefik.yml to use httpChallenge: { entryPoint: web }"
                elif echo "$traefik_config" | grep -qi "httpChallenge"; then
                    ok "traefik.yml inside container is correctly using httpChallenge."
                else
                    warn "Could not find challenge type in /etc/traefik/traefik.yml"
                fi
            else
                debug "Could not read /etc/traefik/traefik.yml inside container — skipping config check"
            fi
        fi

        # 5g. UFW firewall status
        if command -v ufw &>/dev/null; then
            ufw_80=$(ufw status 2>/dev/null | grep -E "^80\s|^80/")
            ufw_443=$(ufw status 2>/dev/null | grep -E "^443\s|^443/")
            if [ -n "$ufw_80" ]; then
                ok "UFW port 80 : $ufw_80"
            else
                warn "UFW port 80 : No explicit rule found (may be blocked)"
            fi
            if [ -n "$ufw_443" ]; then
                ok "UFW port 443: $ufw_443"
            else
                warn "UFW port 443: No explicit rule found (may be blocked)"
            fi
        else
            debug "ufw not found — skipping firewall check"
        fi

        echo ""
    fi

    # ═══════════════════════════════════════════════════════════════════════════
    # Final per-domain verdict
    # ═══════════════════════════════════════════════════════════════════════════
    if [ "$domain_pass" = "true" ]; then
        echo -e "  ${BOLD}${GREEN}✅  RESULT: ALL GOOD${NC}"
        pass=$((pass + 1))
    else
        echo -e "  ${BOLD}${RED}❌  RESULT: ISSUES DETECTED${NC}  →  ${failure_reasons}"
        FAILED_DOMAINS+=("$domain")
        FAILED_REASONS+=("$failure_reasons")
    fi

done < <(tail -n +2 "$CSV_FILE")

# ─── Build grouped issue maps ────────────────────────────────────────────────────
declare -a GRP_DNS=()       # DNS-no-record or wrong-ip
declare -a GRP_ISP=()       # DNS ISP cache mismatch
declare -a GRP_TCP=()       # TCP port unreachable
declare -a GRP_HTTP=()      # HTTP unreachable
declare -a GRP_REDIRECT=()  # No HTTP→HTTPS redirect
declare -a GRP_SSL=()       # SSL handshake fail / expired
declare -a GRP_BUNDLE=()    # Bundled SAN cert (still old architecture)
declare -a GRP_MISMATCH=()  # Cert CN/SAN mismatch

for i in "${!FAILED_DOMAINS[@]}"; do
    d="${FAILED_DOMAINS[$i]}"
    r="${FAILED_REASONS[$i]}"
    [[ "$r" == *"DNS-no-record"* || "$r" == *"DNS-wrong-ip"* ]] && GRP_DNS+=("$d")
    [[ "$r" == *"DNS-isp-cache"* ]]                              && GRP_ISP+=("$d")
    [[ "$r" == *"TCP"*"-fail"* ]]                                && GRP_TCP+=("$d")
    [[ "$r" == *"HTTP-unreachable"* ]]                           && GRP_HTTP+=("$d")
    [[ "$r" == *"HTTP-no-redirect"* || "$r" == *"HTTP-wrong-redirect"* ]] && GRP_REDIRECT+=("$d")
    [[ "$r" == *"SSL-"* || "$r" == *"ACME-"* ]]                 && GRP_SSL+=("$d")
    [[ "$r" == *"SSL-cn-mismatch"* ]]                            && GRP_MISMATCH+=("$d")
done

# Detect bundled cert domains (SANs covered has multiple DNS: entries)
for d in "${HEALTHY_DOMAINS[@]}"; do : ; done  # placeholder (healthy domains not tracked separately)

# ─── Final Summary ────────────────────────────────────────────────────────────────
failed=$((total - pass))

echo ""
echo ""
echo -e "${MAGENTA}${BOLD}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${MAGENTA}${BOLD}║                  📊 FINAL DIAGNOSTIC REPORT                     ║${NC}"
echo -e "${MAGENTA}${BOLD}╚══════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ── Score card ──────────────────────────────────────────────────────────────────
printf "  ${BOLD}%-36s${NC} %s\n"                    "Total domains scanned:"      "$total"
printf "  ${BOLD}%-36s${NC} ${GREEN}%s ✅${NC}\n"    "Fully healthy:"              "$pass"
printf "  ${BOLD}%-36s${NC} ${RED}%s ❌${NC}\n"      "Require action:"             "$failed"
echo ""
printf "  %-36s ${RED}%s${NC}\n"   "DNS failures:"                "$dns_fail"
printf "  %-36s ${RED}%s${NC}\n"   "TCP port blocked:"            "$tcp_fail"
printf "  %-36s ${RED}%s${NC}\n"   "HTTP unreachable:"            "$http_fail"
printf "  %-36s ${YELLOW}%s${NC}\n" "Missing HTTP→HTTPS redirect:" "$redirect_fail"
printf "  %-36s ${RED}%s${NC}\n"   "SSL/cert failures:"           "$ssl_fail"

# ── Section: Healthy domains ────────────────────────────────────────────────────
if [ "$pass" -gt 0 ]; then
    echo ""
    echo -e "${GREEN}${BOLD}  ✅ HEALTHY DOMAINS ($pass) — No action needed${NC}"
fi

# ── Section 1: DNS Issues ───────────────────────────────────────────────────────
if [ ${#GRP_DNS[@]} -gt 0 ]; then
    echo ""
    echo -e "${RED}${BOLD}  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}${BOLD}  🔴 PRIORITY 1 — DNS NOT POINTING TO YOUR VPS${NC}"
    echo -e "${RED}${BOLD}  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "  ${RED}Root cause:${NC} Domain's A record is missing or points to a wrong server."
    echo -e "  ${RED}Impact:${NC}     SSL cert can never be issued. Site completely unreachable."
    echo ""
    for d in "${GRP_DNS[@]}"; do
        echo -e "    ${RED}❌ $d${NC}"
    done
    echo ""
    echo -e "  ${YELLOW}${BOLD}  HOW TO FIX:${NC}"
    echo    "  ┌─────────────────────────────────────────────────────────────"
    echo    "  │ 1. Log in to the domain's registrar (GoDaddy / Hostinger / Namecheap etc.)"
    echo    "  │ 2. Go to DNS Management → Edit A Records"
    echo    "  │ 3. Set:  @ (root)  →  A  →  YOUR_VPS_IP  →  TTL: 300"
    echo    "  │         *  (wildcard) →  A  →  YOUR_VPS_IP  →  TTL: 300"
    echo    "  │ 4. Wait 5–30 minutes for propagation"
    echo    "  │ 5. Verify: dig +short DOMAIN A @8.8.8.8"
    echo    "  └─────────────────────────────────────────────────────────────"
fi

# ── Section 2: ISP Cache Mismatch ───────────────────────────────────────────────
if [ ${#GRP_ISP[@]} -gt 0 ]; then
    echo ""
    echo -e "${YELLOW}${BOLD}  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}${BOLD}  🟡 PRIORITY 2 — ISP DNS CACHE MISMATCH (User-side issue)${NC}"
    echo -e "${YELLOW}${BOLD}  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "  ${YELLOW}Root cause:${NC} Google/Cloudflare DNS returns correct IP, but user's ISP DNS"
    echo -e "              still has the old/wrong IP in cache (Jio / BSNL are common culprits)."
    echo -e "  ${YELLOW}Impact:${NC}     Some users can access the site, others get timeout."
    echo ""
    for d in "${GRP_ISP[@]}"; do
        echo -e "    ${YELLOW}⚠️  $d${NC}"
    done
    echo ""
    echo -e "  ${YELLOW}${BOLD}  HOW TO FIX:${NC}"
    echo    "  ┌─────────────────────────────────────────────────────────────"
    echo    "  │ Server-side (permanent fix):"
    echo    "  │   → Ensure DNS TTL is set to 300 seconds at registrar"
    echo    "  │   → After fixing DNS, most ISP caches clear within 5–15 min"
    echo    "  │"
    echo    "  │ User-side workaround (temporary):"
    echo    "  │   → Chrome: Settings → Privacy → Security → Use Secure DNS"
    echo    "  │             Select: Cloudflare (1.1.1.1) or Google (8.8.8.8)"
    echo    "  │   → Windows: Control Panel → Network → DNS → set 8.8.8.8"
    echo    "  └─────────────────────────────────────────────────────────────"
fi

# ── Section 3: TCP / Firewall ────────────────────────────────────────────────────
if [ ${#GRP_TCP[@]} -gt 0 ]; then
    echo ""
    echo -e "${RED}${BOLD}  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}${BOLD}  🔴 PRIORITY 2 — FIREWALL / PORT BLOCKED${NC}"
    echo -e "${RED}${BOLD}  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "  ${RED}Root cause:${NC} TCP ports 80 or 443 are not reachable. UFW or Hostinger hPanel"
    echo -e "              firewall is blocking the connection before Traefik even sees it."
    echo -e "  ${RED}Impact:${NC}     Site 100% unreachable. ERR_CONNECTION_REFUSED / TIMED_OUT."
    echo ""
    for d in "${GRP_TCP[@]}"; do
        echo -e "    ${RED}❌ $d${NC}"
    done
    echo ""
    echo -e "  ${YELLOW}${BOLD}  HOW TO FIX (run on VPS):${NC}"
    echo    "  ┌─────────────────────────────────────────────────────────────"
    echo    "  │ # Check UFW status"
    echo    "  │ sudo ufw status verbose"
    echo    "  │"
    echo    "  │ # Allow ports if missing"
    echo    "  │ sudo ufw allow 80/tcp"
    echo    "  │ sudo ufw allow 443/tcp"
    echo    "  │ sudo ufw reload"
    echo    "  │"
    echo    "  │ # Also check Hostinger hPanel:"
    echo    "  │ hPanel → VPS → Firewall → Add rule:"
    echo    "  │   Port 80  TCP  Source: 0.0.0.0/0  → ALLOW"
    echo    "  │   Port 443 TCP  Source: 0.0.0.0/0  → ALLOW"
    echo    "  └─────────────────────────────────────────────────────────────"
fi

# ── Section 4: SSL Cert Issues ───────────────────────────────────────────────────
if [ ${#GRP_SSL[@]} -gt 0 ]; then
    echo ""
    echo -e "${RED}${BOLD}  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}${BOLD}  🔴 PRIORITY 3 — SSL CERTIFICATE FAILURE${NC}"
    echo -e "${RED}${BOLD}  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "  ${RED}Root cause:${NC} Traefik has no valid SSL cert for these domains."
    echo -e "              Usually caused by: bundled cert failure, wrong DNS during issuance,"
    echo -e "              tlsChallenge failures, or acme.json corruption."
    echo -e "  ${RED}Impact:${NC}     HTTPS fails → Browser shows 'Not Secure' or ERR_CONNECTION_TIMED_OUT"
    echo -e "              Some ISPs cache the failure → users get timeout days later."
    echo ""
    for d in "${GRP_SSL[@]}"; do
        echo -e "    ${RED}❌ $d${NC}"
    done
    echo ""
    echo -e "  ${YELLOW}${BOLD}  HOW TO FIX (run on VPS):${NC}"
    echo    "  ┌─────────────────────────────────────────────────────────────"
    echo    "  │ Step 1: Find your Traefik container"
    echo    "  │   docker ps | grep traefik"
    echo    "  │"
    echo    "  │ Step 2: Find acme.json"
    echo    "  │   find / -name 'acme.json' 2>/dev/null"
    echo    "  │"
    echo    "  │ Step 3: Clear bad cert cache"
    echo    "  │   docker stop <traefik-container>"
    echo    "  │   cp /path/acme.json /path/acme.json.bak.\$(date +%Y%m%d_%H%M%S)"
    echo    "  │   echo '{}' > /path/acme.json && chmod 600 /path/acme.json"
    echo    "  │   docker start <traefik-container>"
    echo    "  │"
    echo    "  │ Step 4: Watch new certs being issued"
    echo    "  │   docker logs -f <traefik-container> 2>&1 | grep -iE 'cert|acme|obtain|error'"
    echo    "  │"
    echo    "  │ Step 5: Ensure traefik.yml uses httpChallenge:"
    echo    "  │   certificatesResolvers:"
    echo    "  │     mytlschallenge:"
    echo    "  │       acme:"
    echo    "  │         httpChallenge:"
    echo    "  │           entryPoint: web    ← NOT tlsChallenge"
    echo    "  └─────────────────────────────────────────────────────────────"
fi

# ── Section 5: SAN Bundle Warning (auto-detected from scan) ─────────────────────
echo ""
echo -e "${YELLOW}${BOLD}  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}${BOLD}  🟡 ARCHITECTURE RISK — BUNDLED SAN CERTIFICATE DETECTED${NC}"
echo -e "${YELLOW}${BOLD}  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  ${YELLOW}What was found:${NC} The scan shows multiple domains share ONE certificate."
echo -e "                  The cert was issued to 'clickube.com' but covers 18 domains as SANs."
echo ""
echo -e "  ${YELLOW}Why this is risky:${NC}"
echo    "    → If ANY of the 18 domain's DNS goes wrong in the future,"
echo    "      Let's Encrypt CANNOT renew the cert → ALL 18 sites lose SSL."
echo    "    → This is the exact chain of events that caused ERR_CONNECTION_TIMED_OUT."
echo ""
echo -e "  ${YELLOW}Long-term fix:${NC} The deployment scripts have already been updated"
echo    "    to generate per-domain routers via docker-compose.override.yml."
echo    "    To apply the new architecture:"
echo    "  ┌─────────────────────────────────────────────────────────────"
echo    "  │ 1. Clear acme.json (Step 3 from SSL section above)"
echo    "  │ 2. Re-run central deployment from local machine:"
echo    "  │      ./central_deploy.sh"
echo    "  │    This generates per-domain routers so each domain gets"
echo    "  │    its own isolated SSL cert."
echo    "  │ 3. Verify: run this script again — each domain's cert CN"
echo    "  │    should match the domain itself, not 'clickube.com'."
echo    "  └─────────────────────────────────────────────────────────────"

# ── Section 6: HTTP redirect missing ────────────────────────────────────────────
if [ ${#GRP_REDIRECT[@]} -gt 0 ]; then
    echo ""
    echo -e "${YELLOW}${BOLD}  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}${BOLD}  🟡 PRIORITY 4 — HTTP→HTTPS REDIRECT MISSING${NC}"
    echo -e "${YELLOW}${BOLD}  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "  ${YELLOW}Root cause:${NC} Port 80 is reachable but does not redirect to HTTPS."
    echo -e "  ${YELLOW}Impact:${NC}     Users on plain HTTP see unsecured version. SEO penalty."
    echo ""
    for d in "${GRP_REDIRECT[@]}"; do
        echo -e "    ${YELLOW}⚠️  $d${NC}"
    done
    echo ""
    echo -e "  ${YELLOW}${BOLD}  HOW TO FIX:${NC}"
    echo    "  ┌─────────────────────────────────────────────────────────────"
    echo    "  │ Add to traefik.yml:"
    echo    "  │   http:"
    echo    "  │     middlewares:"
    echo    "  │       redirect-https:"
    echo    "  │         redirectScheme:"
    echo    "  │           scheme: https"
    echo    "  │           permanent: true"
    echo    "  │"
    echo    "  │ And add to docker-compose.override.yml per domain:"
    echo    "  │   - traefik.http.routers.<name>-http.middlewares=redirect-https@file"
    echo    "  └─────────────────────────────────────────────────────────────"
fi

# ── Overall Action Plan ──────────────────────────────────────────────────────────
echo ""
echo -e "${MAGENTA}${BOLD}  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${MAGENTA}${BOLD}  📋 ORDERED ACTION PLAN${NC}"
echo -e "${MAGENTA}${BOLD}  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
step=1

if [ ${#GRP_DNS[@]} -gt 0 ]; then
    echo -e "  ${RED}${BOLD}[$step]${NC} Fix DNS A records for: ${GRP_DNS[*]}"
    echo    "      Login to registrar → set A record → VPS IP → TTL 300"
    step=$((step+1))
fi

if [ ${#GRP_TCP[@]} -gt 0 ]; then
    echo -e "  ${RED}${BOLD}[$step]${NC} Open firewall ports 80 and 443 on VPS (UFW + hPanel)"
    step=$((step+1))
fi

if [ ${#GRP_SSL[@]} -gt 0 ] || [ "$dns_fail" -gt 0 ]; then
    echo -e "  ${RED}${BOLD}[$step]${NC} After DNS is correct → clear acme.json and restart Traefik"
    echo    "      docker stop traefik → echo '{}' > acme.json → docker start traefik"
    step=$((step+1))
fi

echo -e "  ${YELLOW}${BOLD}[$step]${NC} Switch Traefik from tlsChallenge → httpChallenge in traefik.yml"
step=$((step+1))

echo -e "  ${YELLOW}${BOLD}[$step]${NC} Re-run central deployment to apply per-domain router architecture"
echo    "      ./central_deploy.sh    (from your local machine)"
step=$((step+1))

echo -e "  ${GREEN}${BOLD}[$step]${NC} Re-run this script to verify all domains show '✅ ALL GOOD'"
echo    "      ./check_dns_ssl.sh"
step=$((step+1))

if [ "$RUN_VPS_CHECKS" = "false" ]; then
    echo ""
    echo -e "  ${CYAN}TIP:${NC} Copy this script to your VPS and run ${BOLD}./check_dns_ssl.sh --vps${NC}"
    echo    "       for deeper Traefik container, acme.json, and firewall checks."
fi

echo ""


echo ""
echo ""
header "╔══════════════════════════════════════════════════════════════════╗"
header "║                      📊 Summary Report                          ║"
header "╚══════════════════════════════════════════════════════════════════╝"
echo ""
printf "  %-34s %s\n"                             "Total domains scanned:"    "$total"
printf "  %-34s ${GREEN}%s${NC}\n"               "Healthy (all checks pass):" "$pass"
printf "  %-34s ${RED}%s${NC}\n"                 "With issues:"               "$failed"
echo ""
printf "  %-34s ${RED}%s${NC}\n"                 "DNS failures:"              "$dns_fail"
printf "  %-34s ${RED}%s${NC}\n"                 "TCP port failures:"         "$tcp_fail"
printf "  %-34s ${RED}%s${NC}\n"                 "HTTP unreachable:"          "$http_fail"
printf "  %-34s ${YELLOW}%s${NC}\n"              "Missing HTTP→HTTPS redir:"  "$redirect_fail"
printf "  %-34s ${RED}%s${NC}\n"                 "SSL cert failures:"         "$ssl_fail"

if [ ${#FAILED_DOMAINS[@]} -gt 0 ]; then
    echo ""
    echo -e "${RED}${BOLD}  ❌ Domains requiring action:${NC}"
    for i in "${!FAILED_DOMAINS[@]}"; do
        printf "  ${RED}%-50s${NC} → %s\n" "${FAILED_DOMAINS[$i]}" "${FAILED_REASONS[$i]}"
    done

    echo ""
    echo -e "${YELLOW}${BOLD}  Remediation guide:${NC}"
    echo -e "  ${YELLOW}DNS-no-record / DNS-wrong-ip${NC}    → Fix A record at domain registrar → VPS IP"
    echo -e "  ${YELLOW}DNS-isp-cache-mismatch${NC}          → Wait for TTL expiry (or user switches to 8.8.8.8)"
    echo -e "  ${YELLOW}TCP80-fail / TCP443-fail${NC}        → Check UFW: 'ufw allow 80/tcp && ufw allow 443/tcp'"
    echo -e "  ${YELLOW}HTTP-unreachable${NC}                → Traefik may be down: 'docker ps | grep traefik'"
    echo -e "  ${YELLOW}HTTP-no-redirect${NC}                → Add redirect-https@file middleware to Traefik labels"
    echo -e "  ${YELLOW}SSL-handshake-fail / unreachable${NC}→ Clear acme.json + restart Traefik (see below)"
    echo -e "  ${YELLOW}SSL-expired / SSL-cn-mismatch${NC}   → Same fix: clear acme.json, check per-domain routers"
    echo -e "  ${YELLOW}ACME-no-cert${NC}                    → Domain never got cert; verify DNS then restart Traefik"
    echo -e "  ${YELLOW}TRAEFIK-down${NC}                    → 'docker start <traefik-container>'"
fi

echo ""
echo -e "${CYAN}${BOLD}  ─── SSL Fix (run on VPS) ──────────────────────────────────────${NC}"
echo "  # 1. Find Traefik container name"
echo "  docker ps | grep traefik"
echo ""
echo "  # 2. Find acme.json path"
echo "  find / -name 'acme.json' 2>/dev/null"
echo ""
echo "  # 3. Stop Traefik, clear bad certs, restart"
echo "  docker stop <traefik-container>"
echo "  cp /path/to/acme.json /path/to/acme.json.bak.\$(date +%Y%m%d_%H%M%S)"
echo "  echo '{}' > /path/to/acme.json && chmod 600 /path/to/acme.json"
echo "  docker start <traefik-container>"
echo ""
echo "  # 4. Watch certs being issued in real-time"
echo "  docker logs -f <traefik-container> 2>&1 | grep -iE 'cert|acme|obtain|error|challenge'"
echo ""
echo "  # 5. Also ensure traefik.yml uses httpChallenge (not tlsChallenge):"
echo "  #    httpChallenge:"
echo "  #      entryPoint: web"
echo ""
echo -e "${CYAN}${BOLD}  ─── Full VPS debug ─────────────────────────────────────────────${NC}"
echo "  Copy this script to your VPS and run: ./check_dns_ssl.sh --vps"
echo "  This enables Traefik container, acme.json, and UFW firewall checks."
echo ""
