# Local Single Port Testing Guide

This guide explains how to run the entire application (Frontend + Backend) on a single port (**5000**) for local testing, simulating a production-like environment.

**Key Feature:** This method **does not modify your actual source code**. It generates a temporary server file on the fly and cleans it up afterwards.

---

## 🚀 How to Run

1.  Navigate to the project root folder.
2.  Double-click **`run_local_test_5000.bat`**.

### What happens next?
1.  **Builds Client**: The script runs `npm run build` in the `client` folder to compile your React application into static files.
2.  **Generates Temp Server**: It creates a temporary file `server/server_temp.js`. This file is a copy of your `server.js` with added logic to serve the static client files.
3.  **Starts Server**: It runs the temporary server on **Port 5000**.
4.  **Access App**: Open your browser and go to `http://localhost:5000`.

---

## 🧹 How to Reset

The start script attempts to automatically clean up the temporary file when you close it (using Ctrl+C). However, if the window crashes or closes unexpectedly, the temporary file might remain.

To manually clean up:
1.  Double-click **`reset_local_test.bat`**.
2.  This will delete `server/server_temp.js` if it exists.

---

## 🛠️ Technical Details

*   **Original File**: `server/server.js` (Untouched)
*   **Temporary File**: `server/server_temp.js` (Created only during test)
*   **Client Build**: Located in `client/dist`

This setup ensures that your development environment remains clean while allowing you to test the "Single Port" configuration used in production.
