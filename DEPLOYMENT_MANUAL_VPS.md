# 🚀 Deployment Guide: Hostinger VPS (Manual / command-line)

This guide details how to deploy the **WhatsApp Flow Builder** to a Hostinger VPS (Ubuntu 20.04/22.04) manually using the command line, without any control panel like aaPanel.

---

## **Part 1: Initial Server Setup**

1.  **SSH into Server**:
    ```bash
    ssh root@<YOUR_VPS_IP>
    ```
2.  **Update System**:
    ```bash
    sudo apt update && sudo apt upgrade -y
    ```
3.  **Install Essential Tools**:
    ```bash
    sudo apt install -y curl git unzip build-essential nginx certbot python3-certbot-nginx
    ```

---

## **Part 2: Install Node.js & PM2**

1.  **Install Node.js (Latest LTS)**:
    ```bash
    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
    sudo apt install -y nodejs
    ```
2.  **Verify**:
    ```bash
    node -v
    npm -v
    ```
3.  **Install PM2 (Process Manager)**:
    ```bash
    sudo npm install -g pm2
    ```

---

## **Part 3: Deploy Backend (Server)**

1.  **Create Directory**:
    ```bash
    mkdir -p /var/www/whatsapp
    cd /var/www/whatsapp
    ```
2.  **Upload Code**:
    *   **Option A (Git)**:
        ```bash
        git clone <YOUR_REPO_URL> .
        ```
    *   **Option B (SCP/SFTP)**: Upload your project files from your local machine to `/var/www/whatsapp`.

3.  **Setup Backend**:
    ```bash
    cd server
    npm install
    ```

4.  **Configure Environment**:
    *   Create `.env` file:
        ```bash
        nano .env
        ```
    *   Paste your variables:
        ```env
        PORT=5000
        SUPABASE_URL=...
        SUPABASE_SERVICE_KEY=...
        SUPABASE_KEY=...
        JWT_SECRET=...
        CLIENT_URL=https://your-domain.com
        ```
    *   Press `Ctrl+X`, `Y`, `Enter` to save.

5.  **Start Backend with PM2**:
    ```bash
    pm2 start server.js --name "whatsapp-api"
    pm2 save
    pm2 startup
    # Follow the command output by pm2 startup to lock it in
    ```

---

## **Part 4: Deploy Frontend (Client)**

1.  **Build Locally**:
    *   On your PC: `cd client && npm run build`
2.  **Upload Build**:
    *   Upload the contents of the `client/dist` folder to `/var/www/whatsapp/client/dist` on the VPS.
    *   Use FileZilla (SFTP) or `scp`:
        ```bash
        # Run from your LOCAL machine
        scp -r ./client/dist/* root@<YOUR_VPS_IP>:/var/www/whatsapp/client/dist/
        ```

---

## **Part 5: Configure Nginx (Reverse Proxy)**

1.  **Remove Default Config**:
    ```bash
    sudo rm /etc/nginx/sites-enabled/default
    ```
2.  **Create New Config**:
    ```bash
    sudo nano /etc/nginx/sites-available/whatsapp
    ```
3.  **Paste Configuration**:
    *(Replace `your-domain.com` with your actual domain)*

    ```nginx
    server {
        listen 80;
        server_name your-domain.com www.your-domain.com;

        # Frontend Locations
        root /var/www/whatsapp/client/dist;
        index index.html;

        # Serve Frontend (React Routing Support)
        location / {
            try_files $uri $uri/ /index.html;
        }

        # Backend API Proxy
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
4.  **Enable Site**:
    ```bash
    sudo ln -s /etc/nginx/sites-available/whatsapp /etc/nginx/sites-enabled/
    ```
5.  **Test & Restart Nginx**:
    ```bash
    sudo nginx -t
    sudo systemctl restart nginx
    ```

---

## **Part 6: SSL Setup (HTTPS)**

1.  **Run Certbot**:
    ```bash
    sudo certbot --nginx -d your-domain.com -d www.your-domain.com
    ```
2.  **Follow Prompts**: Enter email, agree to terms. It will automatically update your Nginx config for HTTPS.

---

## **Part 7: Final Verification**

1.  Visit `https://your-domain.com` -> App should load.
2.  Visit `https://your-domain.com/api/status` -> Should return `online`.

---

## **Maintenance Commands**

*   **View Server Logs**: `pm2 logs whatsapp-api`
*   **Restart Server**: `pm2 restart whatsapp-api`
*   **Reload Nginx**: `sudo systemctl reload nginx`
