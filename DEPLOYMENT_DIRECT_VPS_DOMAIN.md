# 🚀 Direct VPS Deployment Guide (Complete with Domain Setup)

This guide covers everything from pointing your domain (DNS) to getting your React + Node app running on a fresh VPS (Ubuntu) without any control panel.

**Domain**: `adgend.com`
**VPS IP**: `82.29.162.225` (Replace if different)

---

## **Phase 1: Domain Configuration (DNS)**

Before touching the server, link your domain to your VPS IP.

1.  **Login to Domain Provider** (e.g., Hostinger, GoDaddy).
2.  Go to **DNS Zone / DNS Management**.
3.  **Delete** any existing **A Records** with the name `@`.
4.  **Add New Record**:
    *   **Type**: `A`
    *   **Name**: `@` (or leave blank)
    *   **Points to**: `82.29.162.225`
    *   **TTL**: `300` (or lowest possible)
5.  **Add CNAME Record** (Optional, for www):
    *   **Type**: `CNAME`
    *   **Name**: `www`
    *   **Points to**: `adgend.com`

*Wait 5-10 minutes for changes to propagate.*

---

## **Phase 2: Prepare the VPS**

1.  **Connect via SSH**:
    ```bash
    ssh root@82.29.162.225
    # Enter password when prompted
    ```

2.  **Update & Install Basics**:
    ```bash
    sudo apt update && sudo apt upgrade -y
    sudo apt install -y curl git unzip build-essential nginx certbot python3-certbot-nginx
    ```

3.  **Install Node.js (v18)**:
    ```bash
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt install -y nodejs
    ```

4.  **Install PM2 (To keep backend running)**:
    ```bash
    sudo npm install -g pm2
    ```

---

## **Phase 3: Deploy Backend (API)**

1.  **Create App Directory**:
    ```bash
    mkdir -p /var/www/adgend
    cd /var/www/adgend
    ```

2.  **Upload Backend Code**:
    *   *From your local PC*, navigate to your project folder and copy the `server` folder to the VPS using SCP:
    ```powershell
    # Run this in PowerShell on your LOCAL machine
    scp -r server root@82.29.162.225:/var/www/adgend/
    ```

3.  **Install Dependencies & Config**:
    ```bash
    # (On VPS)
    cd /var/www/adgend/server
    npm install
    
    # Create .env
    nano .env
    ```
    *   Paste your variables:
        ```env
        PORT=5000
        SUPABASE_URL=...
        SUPABASE_SERVICE_KEY=...
        CLIENT_URL=https://adgend.com
        ```
    *   Save: `Ctrl+X` -> `Y` -> `Enter`.

4.  **Start Server**:
    ```bash
    pm2 start server.js --name "whatsapp-api"
    pm2 save
    pm2 startup
    ```

---

## **Phase 4: Deploy Frontend (React)**

1.  **Build Locally**:
    *   (On Local PC) `cd client` -> `npm run build`.
    *   This creates a `dist` folder.

2.  **Upload Frontend**:
    ```powershell
    # Run this in PowerShell on your LOCAL machine
    scp -r client/dist root@82.29.162.225:/var/www/adgend/
    ```

---

## **Phase 5: Nginx Domain Configuration (The Bridge)**

This connects `adgend.com` to your React files and proxies `/api` to your Backend.

1.  **Create Config File**:
    ```bash
    nano /etc/nginx/sites-available/adgend
    ```

2.  **Paste Configuration**:
    ```nginx
    server {
        listen 80;
        server_name adgend.com www.adgend.com;

        # frontend
        root /var/www/adgend/dist;  # Points to uploaded 'dist' folder
        index index.html;

        # 1. React Routing (Fixes 404s)
        location / {
            try_files $uri $uri/ /index.html;
        }

        # 2. Backend Proxy
        location /api {
            proxy_pass http://localhost:5000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }
    }
    ```

3.  **Enable Site**:
    ```bash
    ln -s /etc/nginx/sites-available/adgend /etc/nginx/sites-enabled/
    rm /etc/nginx/sites-enabled/default  # Remove default page
    ```

4.  **Test & Restart**:
    ```bash
    nginx -t
    # If successful:
    systemctl restart nginx
    ```

---

## **Phase 6: SSL Security (HTTPS)**

1.  **Run Certbot**:
    ```bash
    certbot --nginx -d adgend.com -d www.adgend.com
    ```
2.  Enter your email and choose **"2" (Redirect)** if prompted.

---

## **Verification**

*   **Frontend**: Go to `https://adgend.com`. You should see your app.
*   **Backend**: Go to `https://adgend.com/api/status`. Should show `online`.
