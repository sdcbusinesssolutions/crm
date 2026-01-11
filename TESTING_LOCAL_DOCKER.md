# 🧪 Local Docker Testing Guide

Before uploading to your VPS, it is best practice to test the Docker image on your own computer. This ensures that the build works and the app runs correctly.

## Prerequisites
*   You must have **Docker Desktop** installed and running on your Windows PC.

---

## Step 1: Configuration Check
1.  **Server Env:** Ensure `server/.env` exists and contains your Supabase keys.
    *   *Note: Docker will read this file to inject environment variables.*
2.  **Client Build:**
    *   The Docker build process automatically runs `npm run build` for the client.
    *   It uses the files currently in your `client` folder.
    *   **Crucial:** If you rely on a `.env` file in `client/` for things like `VITE_SUPABASE_URL`, make sure it exists! (If you hardcoded keys in `supabase.ts`, you are fine).

---

## Step 2: Run the Test Command
Open your terminal (PowerShell or Command Prompt) in the `wpcode` folder and run this:

```powershell
docker-compose -f docker-compose.local.yml up --build
```

**Breakdown of component:**
*   `-f docker-compose.local.yml`: Tells it to use the *local* test file (which opens port 5000) instead of the VPS file (which uses Traefik).
*   `up`: Starts the containers.
*   `--build`: Forces a rebuild of the code.

---

## Step 3: Verify It Works
Once the logs stop scrolling and you see `🚀 Server running on http://localhost:5000`:

1.  **Open Browser:** Go to [http://localhost:5000](http://localhost:5000)
    *   You should see your web application.
    *   Try logging in.
2.  **Check API:** Go to [http://localhost:5000/api/status](http://localhost:5000/api/status)
    *   You should see `{"status":"online"}`.

---

## Step 4: Cleanup
When you are done testing, press `Ctrl+C` in the terminal to stop the storage.
To fully remove the test container:

```powershell
docker-compose -f docker-compose.local.yml down
```

---

## Troubleshooting Local Issues
*   **"Port 5000 is already in use"**:
    *   You probably hava `node server.js` running locally in another terminal. Close it.
    *   Or change `"5000:5000"` to `"5001:5000"` in `docker-compose.local.yml` and visit port 5001.
*   **Database connection fails**:
    *   Check your `server/.env` file. Does `SUPABASE_SERVICE_KEY` exist?
    *   Check your internet connection (Supabase is in the cloud).
