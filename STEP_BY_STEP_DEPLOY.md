# 🟢 Step-by-Step Deployment Guide (Beginner Friendly)

This guide assumes you are working on your **PC (Windows)** and need to put the code on your **VPS (aaPanel)** to run it.

---

## **Phase 1: Prepare Your Code (On your PC)**

1.  **Delete Node Modules:**
    *   Go to `server` folder -> Delete `node_modules` folder.
    *   Go to `client` folder -> Delete `node_modules` folder.
    *   *(This makes the upload much faster. Docker will reinstall them.)*

2.  **Zip the Folder:**
    *   Go one level up so you see the `wpcode` folder.
    *   Right-click `wpcode` -> **Send to** -> **Compressed (zipped) folder**.
    *   Verify the zip file contains `Dockerfile` and `docker-compose.yml` in the root.

---

## **Phase 2: Upload to aaPanel**

1.  **Login to aaPanel:** Open your browser and log in to your aaPanel dashboard.
2.  **Open File Manager:** Click **"Files"** in the left menu.
3.  **Navigate:** Go to the folder `/www/wwwroot`.
4.  **Create Directory:**
    *   Click **"Create Directory"**.
    *   Name it **exactly** like your domain (e.g., `cloudospire.in` or `abc.com`).
    *   Enter the new folder.
5.  **Upload:**
    *   Click **"Upload"**.
    *   Select your `wpcode.zip` file.
    *   Wait for it to finish.
6.  **Unzip:**
    *   Find `wpcode.zip` in the list.
    *   Right-click it -> **Unzip**.
    *   **Move Files:** Since unzipping creates a `wpcode` folder inside, move all contents OUT to the root of your domain folder (`/www/wwwroot/cloudospire.in/`). 
    *   Ensure `docker-compose.yml` is directly in `/www/wwwroot/cloudospire.in/`.

---

## **Phase 3: Configuration (Crucial Step)**

1.  **Check `.env` file:**
    *   Go into the `server` folder.
    *   Look for a file named `.env`.
    *   If it's missing (or named `.env.example`), rename it to `.env` or create a new file named `.env` and paste your Supabase credentials there.
    *   **Save** the file.

2.  **Find Network Name (The tricky part):**
    *   Click **"Terminal"** in the left menu (or the black icon).
    *   Login with your VPS root password if asked.
    *   Type this command and press Enter:
        ```bash
        docker network ls
        ```
    *   **Look at the output.** Find the network name used by n8n. It is usually `n8n_default`, `traefik_proxy`, or just `traefik`.
    *   *Copy that name.*

3.  **Create/Edit `.env` Configuration:**
    *   **Crucial:** You must create a `.env` file in the same folder as `docker-compose.yml` (`/www/wwwroot/cloudospire.in/.env`).
    *   Paste the following content and edit the values:
        ```ini
        # 1. Domain Configuration
        DOMAIN=cloudospire.in
        ROUTER_NAME=cloudospire_in  # MUST BE UNIQUE (use abc_com for abc.com)
        
        # 2. Network (Must match your existing Traefik network)
        TRAEFIK_NETWORK=root_default
        
        # 3. App URLs
        CLIENT_URL=https://cloudospire.in
        APP_URL=https://cloudospire.in
        
        # 4. Deployment Version
        IMAGE_TAG=production
        
        # 5. Supabase Secrets (Paste your actual keys here)
        SUPABASE_URL=https://dkibqgamuxjzhiwxcfzd.supabase.co
        SUPABASE_KEY=your_anon_key_here
        SUPABASE_SERVICE_KEY=your_service_key_here
        ```
    *   **Save** the file.
    *   *Note: You do NOT need to edit `server/.env` manually anymore if you use this root `.env` correctly.*

---

## **Phase 4: Run the Command**

1.  **Open Terminal again:**
    *   Click **"Terminal"** in the menu.

2.  **Navigate to your folder:**
    Type this command and press Enter:
    ```bash
    cd /www/wwwroot/cloudospire.in
    ```

3.  **Run the Build Command:**
    Type this exact command and press Enter:
    ```bash
    docker-compose up -d --build
    ```
    *   **What this does:**
        *   `up`: Starts the app.
        *   `-d`: Detached mode (runs in background so you can close the window).
        *   `--build`: Forces it to build the Docker image using your code.

4.  **Wait:** You will see a lot of text scrolling (Building...). This takes 2-5 minutes.

---

## **Phase 5: Success!**

Once the command finishes and gives you back the command prompt:
1.  **Go to your browser:** Visit `https://cloudospire.in`
2.  **Verify:** You should see your application loading securely (HTTPS).

---

### **Common Questions**

*   **"I got an error: Network not found"**
    *   You skipped Step 3.2. You MUST update the network name in `docker-compose.yml` to match what is on your server.

*   **"How do I update the code later?"**
    1.  Upload the changed files.
    2.  Run `docker-compose up -d --build` again. It will rebuild only exactly what changed.
