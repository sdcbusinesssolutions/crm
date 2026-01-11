# 🐳 Final Deployment Guide (Traefik Integrated)

We have configured your app to run seamlessly alongside n8n using your existing Traefik setup.

## 1. Prepare Environment
1.  **Edit `server/.env`**:
    Ensure your `server/.env` file exists and has your Supabase credentials.
    *(Note: `CLIENT_URL` should be `https://cloudospire.in`)*

## 2. Identify Network Name
Your n8n/Traefik setup runs on a specific internal Docker network. We need to connect to it.
1.  Run `docker network ls` in your VPS terminal.
2.  Look for a network named `n8n_default` or `traefik_default`.
    *   *If your n8n folder is named `root`, it might be `root_default`.*
3.  **Update `docker-compose.yml`**:
    *   Line 23: `name: n8n_default` <-- Change this to the actual network name you found.

## 3. Deploy
Run the following command in your `wpcode` directory (where `docker-compose.yml` is):

```bash
docker-compose up -d --build
```

## 4. Troubleshooting
*   **"Network not found"**: You didn't update the network name in `docker-compose.yml` (Step 2).
*   **"Bad Gateway"**: Wait 30 seconds for the app to build and start.
*   **"404 Not Found"**: 
    *   Run `docker logs whatsapp_app`.
    *   Make sure it says `🚀 Server running on http://localhost:5000`.

## Why this works?
We are using the **exact same** Traefik labels as your n8n setup:
*   `entrypoints=websecure` (Port 443)
*   `certresolver=mytlschallenge` (Your Let's Encrypt setup)

This guarantees SSL will work automatically!
