# 🐳 Single Docker Image Architecture & Runtime Configuration

## 🚀 Overview
We have transitioned from building **100+ separate Docker images** (one per domain) to a **Single "Gold" Image** strategy. This significantly reduces storage costs, improves deployment speed, and simplifies maintenance.

To achieve this, we moved configuration from **Build Time** (baked into the code) to **Runtime** (injected when the container starts).

---

## 🛠️ Key Architectural Changes

### 1. Runtime Configuration (The `config.js` Strategy)
Previously, Vite "baked" environment variables like `VITE_SUPABASE_URL` directly into the JavaScript bundle during `npm run build`. This meant `site-a.com` and `site-b.com` needed different builds.

**New Approach:**
1.  **Generic Build:** We build the app *once* without hardcoded values.
2.  **Config Injection:** When the Docker container starts, an `entrypoint.sh` script runs.
3.  **File Generation:** This script creates a `config.js` file in the public directory containing that specific domain's settings.
4.  **Browser Loading:** `index.html` loads this `config.js` before the main app, making variables available via `window.env`.

### 2. Frontend Abstraction (`AppConfig.ts`)
We replaced direct access to `import.meta.env` with a helper utility `AppConfig`. This utility checks for runtime values first, falling back to build-time env vars (for local dev compatibility).

---

## 📂 File By File Changes

### 1. `client/src/AppConfig.ts` (New File)
*   **Purpose:** Centralizes access to configuration variables.
*   **Logic:** Returns `window.env.VAR_NAME` if it exists (Production), otherwise `import.meta.env.VAR_NAME` (Local Dev).
*   **Why:** Ensures the code works seamlessly in both Production (Docker) and Local (Vite) environments.

### 2. `client/index.html`
*   **Change:** Added `<script src="/config.js"></script>` before the main bundle.
*   **Why:** Ensures configuration is loaded into the browser memory *before* the React app initializes.

### 3. `client/src/lib/supabase.ts` & Services
*   **Change:** Replaced `import.meta.env.VITE_xxx` with `AppConfig.VITE_xxx`.
*   **Why:** To use the dynamic values provided by `AppConfig`.

### 4. `entrypoint.sh` (New File)
*   **Purpose:** Docker Entrypoint script.
*   **Logic:**
    1.  Reads environment variables passed to the container (`SUPABASE_URL`, `CLIENT_URL`, etc.).
    2.  Generates the `config.js` file at `/app/public_html/config.js`.
    3.  Starts the Node.js server.
*   **Why:** This is the "magic" that allows one image to serve unlimited domains.

### 5. `Dockerfile`
*   **Change:** Added `COPY entrypoint.sh` and set `ENTRYPOINT ["./entrypoint.sh"]`.
*   **Why:** Ensures the configuration generation happens every time a container starts.

### 6. `bulk_deploy.sh`
*   **Change:**
    *   Added a step to build the image **ONCE** as `whatsapp-app:latest`.
    *   Removed `--build` from the loop.
    *   Uses `IMAGE_TAG="latest"` for all domains.
*   **Why:** massive speed up. We build once (3 mins) then deploy 100 containers instantly (seconds).

### 7. `docker-compose.yml`
*   **Change:** Added `VITE_MASTER_URL` to environment variables.
*   **Why:** To ensure the frontend knows the master domain for auth redirection.

---

## 🏃‍♂️ How to Run

### Option 1: Local Development (`run_local.bat`)
**Use this for coding features.**
*   **Command:** `run_local.bat`
*   **Behavior:** Runs `npm run dev`. Config is read from your local `.env` file via `import.meta.env`. Run-time injection is skipped.

### Option 2: Local Docker Test (`run_local_docker.bat`)
**Use this to verify the production build locally.**
*   **Command:** `run_local_docker.bat`
*   **Behavior:**
    1.  Builds the production Docker image.
    2.  Starts a container on `localhost:5000`.
    3.  `entrypoint.sh` runs and generates a `config.js` using values from `.env`.
    4.  You can visit `http://localhost:5000` to see the production app running.

### Option 3: Production Deployment
**Use this to deploy to VPS.**
*   **Command:** `./central_deploy.ps1` (Windows) -> `./bulk_deploy.sh` (VPS)
*   **Behavior:** Builds the single image and deploys unique containers for every domain in `domains.csv`.

---
**Document Generated: 2026-01-17**
