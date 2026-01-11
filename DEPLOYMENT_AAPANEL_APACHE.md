# 🚀 Deployment Guide: Hostinger VPS + aaPanel (Apache Version)

This guide details how to deploy the **WhatsApp Flow Builder** using **Apache** instead of Nginx on aaPanel for **adgend.com**.

---

## **Part 1-5: Setup (Same as Nginx)**

Follow **Parts 1 through 5** of the previous guide (`DEPLOYMENT_AAPANEL.md`), but in **Part 3 (aaPanel Setup)**, ensure you selected **Apache** (e.g., Apache 2.4) instead of Nginx.

---

## **Part 6: Apache Configuration for adgend.com**

You need to configure Apache to (1) Serve React files with SPA routing and (2) Proxy API requests to your Node.js backend running on port 5000.

1.  Go to **aaPanel** > **Website**.
2.  Click **adgend.com**.
3.  Click **Config** (or "ConfigFile").
4.  You will see a `<VirtualHost *:80>` block. **Replace the content** (or modify the relevant sections) to match this:

    ```apache
    <VirtualHost *:80>
        ServerAdmin webmaster@adgend.com
        DocumentRoot "/www/wwwroot/adgend.com"
        ServerName adgend.com
        ServerAlias www.adgend.com
        #errorDocument 404 /404.html
        ErrorLog "/www/wwwlogs/adgend.com-error_log"
        CustomLog "/www/wwwlogs/adgend.com-access_log" combined

        # --- 1. React Frontend Config (SPA Routing) ---
        <Directory "/www/wwwroot/adgend.com">
            SetOutputFilter DEFLATE
            Options FollowSymLinks
            AllowOverride All
            Require all granted
            DirectoryIndex index.html index.php index.htm

            # Rewrite Rules for SPA (If file/dir doesn't exist, serve index.html)
            RewriteEngine On
            RewriteCond %{REQUEST_FILENAME} !-f
            RewriteCond %{REQUEST_FILENAME} !-d
            RewriteRule . /index.html [L]
        </Directory>

        # --- 2. Backend Proxy Config (API -> Port 5000) ---
        # Proxies any request starting with /api to the local Node.js server
        <IfModule mod_proxy.c>
            ProxyRequests Off
            ProxyPreserveHost On
            
            # Proxy /api URLs
            ProxyPass /api http://127.0.0.1:5000/api
            ProxyPassReverse /api http://127.0.0.1:5000/api
        </IfModule>
    </VirtualHost>
    ```

5.  **Save**.
6.  Restart Apache (Go to **App Store** > **Apache** > **Restart**).

---

## **Part 7: SSL (HTTPS) Setup**

1.  In the Website Config window, go to **SSL**.
2.  Select **Let's Encrypt**.
3.  Check **adgend.com**.
4.  Click **Apply**.
5.  Wait for success, then toggle **Force HTTPS** to ON.
6.  **Crucial**: aaPanel will create a `<VirtualHost *:443>` block. You **MUST** copy the `Directory` and `ProxyPass` sections from the block above into the new `*:443` block in the configuration file, otherwise the API will likely fail on HTTPS.

---

## **Troubleshooting Apache**

*   **500 Internal Server Error**: Check logs (`/www/wwwlogs/adgend.com-error_log`). Often caused by syntax errors in `.htaccess` or Config file.
*   **404 on Refresh**: The `RewriteRule . /index.html` is missing or `AllowOverride All` is not set.
*   **API 404/503**: `mod_proxy` might not be enabled (check App Store > Apache > Modules), or the Node server isn't running on port 5000.
