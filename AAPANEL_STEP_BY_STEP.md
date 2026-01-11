# 🟢 Simple Step-by-Step aaPanel Guide (Frontend + Backend)

You are confused because **React Frontend** and **Node Backend** are deployed in **different** tabs in aaPanel.

### **Key Concept:**
*   **React Frontend** = 📁 **Static Files**. You deploy this in the **"PHP Project"** tab (don't worry, it works for HTML/JS too).
*   **Node Backend** = ⚙️ **Running Server**. You deploy this in the **"Node Project"** tab (as seen in your screenshot).

---

## **Step 1: DNS Setup (Hostinger)**
*Since your domain is on another account:*
1.  Log in to the **Hostinger** account where `adgend.com` is.
2.  Go to **DNS Zone Editor**.
3.  Edit the **A Record** (`@`):
    *   **Points to**: `Your VPS IP Address` (The IP of your aaPanel server).
    *   **TTL**: 300 (or default).
4.  Wait 5-10 minutes for it to propagate.

---

## **Step 2: Deploy Backend (The API)**
*Do this in the **Node Project** tab (from your screenshot).*

1.  **Upload Code**:
    *   Go to **Files**. Create a folder `/www/wwwroot/whatsapp-api`.
    *   Upload your `server` code there.
2.  **Add Project**:
    *   Go to **Website** > **Node Project** > **Add Node project**.
    *   **Path**: Select `/www/wwwroot/whatsapp-api`.
    *   **Start Command**: `npm start` or `node server.js`.
    *   **Port**: `5000`.
    *   **Domain**: You can bind `api.adgend.com` OR leave it empty if using localhost proxy (recommended).
3.  **Click Submit**.
    *   Status should say "Running".

---

## **Step 3: Deploy Frontend (The Website)**
*Do this in the **PHP Project** tab (even though it's React).*

1.  **Build Code (Locally)**:
    *   Run `npm run build` on your computer. You get a `dist` folder.
2.  **Add Site**:
    *   Go to **Website** > **PHP Project** > **Add Site**.
    *   **Domain**: `adgend.com`.
    *   **Database**: No database (you use Supabase).
    *   **PHP Version**: Pure Static (or any PHP version, doesn't matter).
    *   Click **Submit**.
3.  **Upload Files**:
    *   Go to the site directory (`/www/wwwroot/adgend.com`).
    *   **Delete** default `index.html`.
    *   **Upload** contents of your `dist` folder here.
4.  **Configure Config (Crucial)**:
    *   Click the domain **adgend.com** in the list.
    *   Go to **Config** (Apache) or **ConfigFile** (Nginx).
    *   Paste the configuration provided in `DEPLOYMENT_AAPANEL_APACHE.md` (Step 6).
    *   *This connects the Frontend (Step 3) to the Backend (Step 2).*

---

## **Summary**
1.  **Backend** -> "Node Project" tab -> Runs on port 5000.
2.  **Frontend** -> "PHP Project" tab -> Runs on port 80/443 (Public).
3.  **Config** -> Connects them together.
