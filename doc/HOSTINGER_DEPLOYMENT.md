# Hostinger Deployment Guide

This guide covers deploying the application to Hostinger. The recommended approach is using a **VPS (Virtual Private Server)** for full control, but instructions for **Shared Hosting (hPanel)** are also provided (with limitations).

---

## Option 1: VPS Deployment (Recommended)

**OS**: Ubuntu 20.04/22.04

### 1. Server Setup
SSH into your VPS:
```bash
ssh root@your_vps_ip
```

Update system and install dependencies:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install nodejs npm nginx git -y
# Install PM2 globally
sudo npm install -g pm2
```

### 2. Clone and Install
```bash
# Navigate to web directory
cd /var/www
git clone <your-repo-url> app
cd app

# Install dependencies
npm install # Runs postinstall for client and server
```

### 3. Build Frontend
```bash
cd client
# Create .env file with VITE_ variables
nano .env 
npm run build
```

### 4. Configure Backend
```bash
cd ../server
# Create .env file with SUPABASE_ variables and PORT=5000
nano .env
# Start with PM2
pm2 start server.js --name "whatsapp-api"
pm2 save
pm2 startup
```

### 5. Configure Nginx (Reverse Proxy)
Create a new Nginx config:
```bash
sudo nano /etc/nginx/sites-available/whatsapp-app
```

Paste the following configuration:
```nginx
server {
    listen 80;
    server_name your_domain.com; # OR your_server_ip

    root /var/www/app/client/dist;
    index index.html;

    # Serve Frontend (React SPA)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to Node.js Backend
    location /api/ {
        proxy_pass http://localhost:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/whatsapp-app /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## Option 2: Shared Hosting (hPanel)

Hostinger's shared hosting supports Node.js, but it is more restrictive.

### 1. Prepare the Build Locally
1.  Run `npm run build` in your `client` folder locally.
2.  Zip the contents of `client/dist`.
3.  Zip the contents of `server` (exclude `node_modules`).

### 2. Upload Frontend
1.  Go to **File Manager** in hPanel.
2.  Navigate to `public_html`.
3.  Upload and unzip the **Client** files.

### 3. Setup Node.js Backend
1.  In hPanel, search for **Node.js**.
2.  Create a new Node.js application:
    *   **Root**: `public_html/api-server` (Create this folder first)
    *   **Startup File**: `server.js`
3.  Upload your **Server** zip to `public_html/api-server` and unzip.
4.  Click **"NPM Install"** in the Node.js dashboard.
5.  Add Environment Variables in the Node.js dashboard (SUPABASE_URL, etc.).

### 4. Configure Routing (.htaccess)
Since the frontend and backend are on the same domain, you need to route `/api` requests to the Node.js app.

Edit the `.htaccess` file in `public_html`:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  
  # Route API requests to the Node.js app port (Hostinger assigns a port)
  # Note: Hostinger Node.js apps usually run on a specific URL or Port.
  # A common workaround is to deploy the Node app to a subdomain (e.g., api.yourdomain.com)
  # and update the frontend VITE_API_URL to point to that subdomain.
</IfModule>
```

**Recommended for Shared Hosting:**
Deploy the **Backend** to a subdomain (e.g., `api.yourdomain.com`) using the Node.js tool, and deploy the **Frontend** to the main domain (`yourdomain.com`). Update your frontend code to point to the full API URL instead of relative `/api`.
