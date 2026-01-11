# SSL Verification Guide ("Connection Not Private")

If you see **NET::ERR_CERT_AUTHORITY_INVALID**, your database and app are working, but **Traefik** (the routing software) has not generated a valid Let's Encrypt certificate yet.

## 1. Quick Checks

1.  **Do other domains work?**
    *   Check `https://cloudospire.in`.
    *   **If YES** (Cloudospire works) -> The issue is just **DNS Propagation** for `chatmat.in`. **Wait 15 minutes.**
    *   **If NO** (Cloudospire also fails) -> The issue is **Traefik Configuration** (Wrong Resolver Name).

2.  **DNS Verification**
    *   `chatmat.in` MUST point to `145.79.15.115`.

## 2. The "Resolver Name" Fix

Traefik needs a "Certificate Resolver" to talk to Let's Encrypt. Our code assumes it is named `mytlschallenge`.

**Check the Logs:**
First, **find the real name** of your Traefik container:
```powershell
ssh root@145.79.15.115 "docker ps --format '{{.Names}} -- {{.Ports}}'"
```
Look for the one handling port **443**. It might be named `traefik`, `traefik_proxy`, or `n8n_traefik_1`.

Then check its logs (replace `traefik` with the real name):
```powershell
ssh root@145.79.15.115 "docker logs traefik --tail 50"
```

*   **Error:** `"the router uses a non-existent resolver: mytlschallenge"`
    *   **Fix:** Your VPS's Traefik uses a different name (likely `myresolver` or `letsencrypt`).
    *   **Action:** Edit `docker-compose.yml` (Line 50):
        ```yaml
        # Change 'mytlschallenge' to 'myresolver' OR 'letsencrypt'
        - "traefik.http.routers.${ROUTER_NAME}.tls.certresolver=myresolver" 
        ```
    *   Then Re-Deploy: `.\central_deploy.ps1`

*   **Error:** `"Unable to obtain ACME certificate ... rate limited"`
    *   **Fix:** You deployed too many times. Wait 1 hour.
