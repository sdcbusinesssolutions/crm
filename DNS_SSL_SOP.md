# 📋 SOP: DNS & SSL Troubleshooting Guide

This Standard Operating Procedure (SOP) provides a step-by-step guide to diagnosing and fixing "Connection Not Private" or "NXDOMAIN" errors for your domains and subdomains.

---

## 🛠️ Phase 1: DNS Verification (Hostinger/DNS Panel)

Before checking the server, ensure the domain is actually pointing to your VPS correctly.

1.  **Check A Records:**
    *   `@` (Root domain) must point to `72.61.255.20`.
    *   `api` (Subdomain) must point to `72.61.255.20`.
    *   `www.api` (Subdomain) must point to `72.61.255.20`.
2.  **Avoid "Child Nameservers":**
    *   Do **NOT** add your subdomains (like `api.rdleadify.com`) in the "Child Nameservers" section.
    *   They must only be added in the **"DNS Records"** table as **A** records.
3.  **Global Verification Tool:**
    *   Use [DNSChecker.org](https://dnschecker.org) to verify that your record has updated globally.
    *   **Quick Command:** `nslookup api.rdleadify.com 8.8.8.8` (Check if it returns your VPS IP).

---

## 🏗️ Phase 2: Configuration Check (`domains.csv`)

Traefik (the routing proxy on your VPS) will only create a secure SSL connection if it knows about the domain in your configuration files.

1.  **Check `domains.csv`:**
    *   Ensure the subdomain exists in the file.
    *   Verify the **VPSIp** is `72.61.255.20`.
    *   Verify **CertResolver** is `mytlschallenge`.
2.  **Add Triple-Check:**
    *   Does the domain have ANY special characters or typos? (e.g., `api.www` instead of `www.api`).
3.  **Redeploy:**
    *   After adding a domain to the CSV, you **MUST** run the deployment script on your VPS:
        ```bash
        ./bulk_deploy.sh
        ```

---

## 🔐 Phase 3: SSL Diagnosis (Traefik Logs)

If DNS is working but the site says "Not Secure", check the Traefik logs for the real reason.

1.  **Check Let's Encrypt Status:**
    Run this on your VPS:
    ```bash
    docker logs traefik --tail 50
    ```
2.  **Common Errors & Solutions:**
    *   **❌ NXDOMAIN:** Traefik cannot find the domain in DNS.
        *   *Fix:* Give the DNS 15-30 minutes to propagate or fix the `www` record.
    *   **❌ 429 Rate Limit:** You tried too many times while DNS was broken.
        *   *Fix:* **Wait 1 hour** before attempting to redeploy. Do NOT keep trying, it will only increase the limit.
    *   **❌ Unauthorized (Challenges):** Traefik cannot reach the temporary challenge file.
        *   *Fix:* Ensure ports **80** and **443** are open on the VPS firewall.

---

## 🧪 Phase 4: Final Testing

1.  **Clear Browser Cache:** Sometimes your browser "remembers" the old SSL error. Try opening in **Incognito Mode**.
2.  **SSL Quality Check:** Use [SSL Labs](https://www.ssllabs.com/ssltest/) to see why a certificate is failing.
3.  **Success Status:**
    *   Site loads with `https://`.
    *   Lock icon 🔒 appears in the address bar.
    *   No security warnings.

---

**Last Updated:** February 26, 2026
**Primary VPS:** 72.61.255.20
