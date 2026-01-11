# 🚀 Deployment Guide: Hostinger VPS + aaPanel

This guide details how to deploy the **WhatsApp Flow Builder** (Client & Server) to a Hostinger VPS using the **aaPanel** control panel.

---

## **Part 1: VPS Initialization (Hostinger)**

1.  **Purchase VPS**: Recommended **KVM 2** or higher (Ubuntu 22.04 64-bit).
2.  **Login to Terminal**: Use PuTTY or your terminal to SSH into the server:
    ```bash
    ssh root@<YOUR_VPS_IP>
    ```

---

## **Part 2: Install aaPanel**

1.  **Run Installation Script** (Ubuntu/Debian):
    ```bash
    wget -O install.sh http://www.aapanel.com/script/install-ubuntu_6.0_en.sh && sudo bash install.sh aapanel
    ```
2.  **Save Credentials**: Once finished, it will show your aaPanel Login URL, Username, and Password. **Save these!**
3.  **Login**: Open the URL in your browser and log in.

---

## **Part 3: aaPanel Setup**

1.  **Install LNMP Stack** (Recommended):
    *   When prompted, choose **Nginx** (Latest), **MySQL** (Optional, you use Supabase), **PHP** (Not needed), **phpMyAdmin** (Not needed).
    *   Wait for installation to complete.
2.  **Install Node.js**:
    *   Go to **App Store** > Search **"Node.js Version Manager"** > Install.
    *   Open it > **Registry** > Select **v18.x** or **v20.x** (LTS) > Install.
    *   Click **Modules** > Install `pm2` and `yarn` (optional).

---

## **Part 4: Backend Deployment (Node.js)**

### 1. Upload Code
1.  Go to **Files** > `/www/wwwroot`.
2.  Create a folder named `whatsapp-backend`.
3.  Upload the contents of your local `server/` folder here.
    *   *Tip: Zip your local `server` folder, upload it, then unzip in aaPanel.*

### 2. Configure Environment
1.  Inside `whatsapp-backend`, create/edit the `.env` file.
2.  Paste your production environment variables:
    ```env
    PORT=5000
    SUPABASE_URL=your_supabase_url
    SUPABASE_SERVICE_KEY=your_service_role_key
    SUPABASE_KEY=your_anon_key
    JWT_SECRET=your_secret_key
    CLIENT_URL=https://your-domain.com
    ```

### 3. Install Dependencies & Start
1.  Open **Terminal** in aaPanel (or SSH).
2.  Navigate to folder:
    ```bash
    cd /www/wwwroot/whatsapp-backend
    ```
3.  Install:
    ```bash
    npm install
    ```
4.  Start with PM2:
    ```bash
    pm2 start server.js --name "whatsapp-api"
    pm2 save
    pm2 startup
    ```
5.  Verify it's running:
    ```bash
    curl http://localhost:5000/status
    ```

---

## **Part 5: Frontend Deployment (React/Vite)**

### 1. Build Locally
1.  On your local machine, open terminal in `client/` folder.
2.  Run:
    ```bash
    npm run build
    ```
3.  This creates a `dist` folder. Zip this `dist` folder.

### 2. Upload to aaPanel
1.  Go to **Website** > **Add Site**.
    *   **Domain**: `your-domain.com` (Ensure DNS points to VPS IP).
    *   **Database**: Not created.
    *   **PHP**: Pure Static.
2.  Go to **Files** > `/www/wwwroot/your-domain.com`.
3.  Delete default files (`index.html`, `404.html`).
4.  Upload your `dist.zip` and **Unzip**.
5.  **Move files**: Ensure `index.html` is directly inside `/www/wwwroot/your-domain.com` (not inside a subfolder).

---

## **Part 6: Nginx Configuration (Crucial)**

You need to tell Nginx to (1) Serve React files and (2) Proxy API requests to your Node.js backend running on port 5000.

1.  Go to **Website** > Click your domain > **Config**.
2.  Find the `server { ... }` block and replace/add these rules:

    ```nginx
    server {
        listen 80;
        server_name your-domain.com;
        root /www/wwwroot/your-domain.com;
        index index.html;

        # 1. Serve React App (Handle Single Page Routing)
        location / {
            try_files $uri $uri/ /index.html;
        }

        # 2. Proxy API Requests to Backend (Port 5000)
        location /api {
            proxy_pass http://localhost:5000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }

        # SSL Config will be added automatically by aaPanel later...
    }
    ```
3.  **Save**.

---

## **Part 7: SSL (HTTPS) Setup**

1.  In the Website Config window, go to **SSL**.
2.  Select **Let's Encrypt**.
3.  Check your domain name.
4.  Click **Apply**.
5.  Wait for success, then toggle **Force HTTPS** to ON.

---

## **Part 8: Verification**

1.  Open `https://your-domain.com`. The frontend should load.
2.  Go to `https://your-domain.com/api/status`. It should return `{"status":"online"}`.
3.  Login and test database connectivity.

---

## **Troubleshooting**

*   **502 Bad Gateway on /api**: Means Node.js server is not running. Check `pm2 status` or `pm2 logs whatsapp-api`.
*   **404 on Refresh**: Means `try_files $uri $uri/ /index.html;` is missing in Nginx config.
*   **CORS Error**: Ensure your `.env` in backend has `CLIENT_URL=https://your-domain.com`.
