# aaPanel Deployment Guide

This guide provides step-by-step instructions for deploying the WhatsApp Flow Builder application on a VPS managed by **aaPanel**.

## Prerequisites

1.  **VPS** with **aaPanel** installed.
2.  **App Store** (inside aaPanel) installations:
    *   **Nginx** (Web Server)
    *   **Node.js Version Manager** (Install Node.js v18 or higher)
    *   **PM2 Manager** (Optional, but recommended for process management)

---

## Step 1: Create a Website

1.  Login to your **aaPanel Dashboard**.
2.  Go to **Website** -> **Add Site**.
3.  **Domain**: Enter your domain (e.g., `example.com`).
4.  **Database**: Not needed (we use Supabase).
5.  **PHP Version**: Pure Static (or any version, we won't use it).
6.  Click **Submit**.

## Step 2: Upload Code

You can upload the code via the File Manager or use Git (recommended).

### Option A: Using Git (Terminal)
1.  Open **Terminal** in aaPanel.
2.  Navigate to the site directory:
    ```bash
    cd /www/wwwroot/example.com
    ```
3.  Delete default files:
    ```bash
    rm -rf *
    ```
4.  Clone your repository (ensure the folder contents are in the root, or move them):
    ```bash
    git clone <your-repo-url> .
    ```

### Option B: Using File Manager
1.  Go to **Files**.
2.  Navigate to `/www/wwwroot/example.com`.
3.  Upload your project files (Server + Client).

---

## Step 3: Backend Setup (Node.js API)

1.  **Open Terminal** and navigate to the server folder:
    ```bash
    cd /www/wwwroot/example.com/server
    ```
2.  **Install Dependencies**:
    ```bash
    npm install
    ```
3.  **Configure Environment**:
    *   Create a `.env` file:
        ```bash
        nano .env
        ```
    *   Paste your Supabase credentials:
        ```env
        SUPABASE_URL=your_supabase_url
        SUPABASE_KEY=your_supabase_anon_key
        PORT=5000
        ```
    *   Save (Ctrl+O, Enter) and Exit (Ctrl+X).
4.  **Start the Server**:
    *   **Using PM2 (Recommended)**:
        ```bash
        pm2 start server.js --name "whatsapp-api"
        pm2 save
        pm2 startup
        ```
    *   *Alternatively, you can use the "Node.js Project" manager in aaPanel if you prefer GUI management.*

---

## Step 4: Frontend Setup (React)

1.  **Navigate to Client Folder**:
    ```bash
    cd /www/wwwroot/example.com/client
    ```
2.  **Install Dependencies**:
    ```bash
    npm install
    ```
3.  **Configure Environment**:
    *   Create `.env`:
        ```bash
        nano .env
        ```
    *   Add VITE variables:
        ```env
        VITE_SUPABASE_URL=your_supabase_url
        VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
        ```
4.  **Build the Project**:
    ```bash
    npm run build
    ```
    *This will create a `dist` folder inside `client`.*

---

## Step 5: Configure Website Root

1.  Go to **Website** menu.
2.  Click the **Settings** (Config) button for your site (`example.com`).
3.  Go to **Site Directory**.
4.  **Running Directory**: Select `/client/dist`.
    *   *Note: The "Site Directory" remains `/www/wwwroot/example.com`, but the "Running Directory" (what the public sees) should be the build folder.*
5.  Click **Save**.

---

## Step 6: Configure Reverse Proxy (Nginx)

We need to tell Nginx to send any requests starting with `/api` to our Node.js backend running on port 5000.

1.  In the **Website Settings** popup, go to **Config** (or **Reverse Proxy** tab if available, but manual config is safer for specific routes).
2.  If using the **Reverse Proxy** tab:
    *   **Add Reverse Proxy**.
    *   **Name**: `API`.
    *   **Target URL**: `http://127.0.0.1:5000`.
    *   **Sent Domain**: `$host`.
    *   *Important: This usually proxies the WHOLE site. For specific `/api` routing, editing the Config file is better.*

3.  **Recommended: Edit Config File Manually**:
    *   Go to **Config** (Configuration File) tab.
    *   Find the `server` block.
    *   Add this `location` block before the closing `}`:

    ```nginx
    location /api/ {
        proxy_pass http://127.0.0.1:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    ```
    *   *Note: Ensure you also have the default location block for the React app (usually handled by aaPanel automatically).*
    *   **React Router Fix**: To prevent 404s on refresh, ensure this block exists (aaPanel often adds it, but verify):
        ```nginx
        location / {
            try_files $uri $uri/ /index.html;
        }
        ```
4.  Click **Save**.

---

## Step 7: Verify

1.  Open your browser and go to `http://example.com`.
    *   You should see the React Login page.
2.  Open Developer Tools (F12) -> Network.
3.  Try to Login.
    *   You should see a request to `http://example.com/api/...` returning 200 OK.

## Troubleshooting

*   **502 Bad Gateway on /api**: The Node.js server is not running. Check `pm2 status` or `pm2 logs`.
*   **404 on Refresh**: The `try_files $uri $uri/ /index.html;` line is missing in Nginx config.
*   **Connection Refused**: Ensure the backend port (5000) matches what is in the Nginx config.
