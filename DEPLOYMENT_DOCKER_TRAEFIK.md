# 🐳 Deployment via Docker (Traefik Compatible)

Since you are running **Traefik** (likely for n8n), you cannot use aaPanel's Nginx on ports 80/443. Instead, we have successfully created a `docker-compose.yml` file that integrates your WhatsApp app directly with your existing Traefik setup.

## 1. Prerequisites
You need to identify 2 things from your existing Traefik setup:
1.  **Network Name**: (e.g., `web`, `traefik-public`, `proxy`)
2.  **Cert Resolver Name**: (e.g., `myresolver`, `letsencrypt`)

Run this command on your VPS to find the network:
```bash
docker network ls
```

## 2. Update Configuration
Open `docker-compose.yml` in the root folder and update two lines:

1.  **Network Name**:
    ```yaml
    networks:
      traefik_network:
        external: true
        name: YOUR_ACTUAL_NETWORK_NAME  <-- Change this (line 32)
    ```

2.  **Cert Resolver**:
    Search for `traefik.http.routers.wa-server.tls.certresolver=` and change `letsprob` to your actual resolver name (found in your `traefik.yml` or existing n8n docker-compose).

## 3. Deploy
Run the following command from the root folder:

```bash
docker-compose up -d --build
```

## 4. Verify
-   **Frontend**: Visit `https://cloudospire.in`
-   **Backend**: Visit `https://cloudospire.in/api/status` (or `https://cloudospire.in/api`)

This setup allows n8n and your WhatsApp app to run side-by-side!
