# 🚀 Deployment: The "Single Port" Method (Traefik Compatible)

Since you are running **Traefik** (n8n), ports 80/443 are blocked. We will bypass this by running your entire app (Frontend + Backend) on **Port 5000** and telling Traefik to send traffic there.

## Step 1: Prepare the Code (On your PC / Local)
1.  **Build the Frontend:**
    Open your `client` folder and run:
    ```bash
    npm run build
    ```
    *This creates a `dist` folder.*

2.  **Verify Structure:**
    Ensure your server serves the frontend. We just modified `server.js` to do this automatically!
    *   It now looks for `../client/dist`.

3.  **Zip Everything:**
    Zip the entire `wpcode` folder (excluding `node_modules` if possible to save space).

## Step 2: Upload to VPS
1.  **aaPanel File Manager:**
    *   Upload your zip to `/www/wwwroot/whatsapp-app`.
    *   Unzip it.
    *   You should see `server` and `client` folders there.

## Step 3: Start the App (aaPanel / Terminal)
1.  **Install Dependencies:**
    Open Terminal (aaPanel > Terminal) and run:
    ```bash
    cd /www/wwwroot/whatsapp-app/server
    npm install
    ```
2.  **Start with PM2:**
    ```bash
    pm2 start server.js --name "whatsapp-app"
    ```
3.  **Check:**
    Run `curl http://localhost:5000/status`
    *   If it says `online`, you are good!

## Step 4: Connect Traefik (The Magic Step)
You need to tell Traefik (n8n) to send `cloudospire.in` to your app running on port 5000.

**Option A: If you use a `docker-compose.yml` for n8n/Traefik:**
Add this new service to your EXISTING n8n `docker-compose.yml`:
```yaml
  whatsapp-proxy:
    image: alpine:latest
    command: sh -c "apk add socat && socat TCP-LISTEN:5000,fork,bind=0.0.0.0 TCP:host.docker.internal:5000"
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.wa.rule=Host(`cloudospire.in`)"
      - "traefik.http.routers.wa.entrypoints=websecure"
      - "traefik.http.routers.wa.tls.certresolver=myresolver" # Check your n8n config for this name
      - "traefik.http.services.wa.loadbalancer.server.port=5000"
    extra_hosts:
      - "host.docker.internal:host-gateway"
```

**Option B: The "Direct VPS" Way (If you don't want to touch Docker)**
If you cannot edit Traefik config, you can **STOP Traefik for a moment** and use Nginx on specific ports? No, that breaks n8n.

**Use the Docker Method** I sent previously (`DEPLOYMENT_DOCKER_TRAEFIK.md`). It is the **cleanest** way.
It wraps your app in Docker so Traefik can talk to it natively.

### Why not just aaPanel Nginx?
Because Traefik won't let Nginx start on port 443.
You MUST integrate with Traefik.
