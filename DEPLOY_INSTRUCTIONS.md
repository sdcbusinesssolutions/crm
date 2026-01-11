# Deployment Guide

This project is configured to be deployed entirely on **Netlify** as a Monorepo (Frontend + Backend).

## How it works
*   **Frontend:** The `client/` folder is built as a static React site.
*   **Backend:** The `server/` folder acts as a Netlify Serverless Function. The `server/server.js` file wraps the Express API so it runs on Netlify.
*   **Routing:** The `netlify.toml` file redirects any requests to `/api/*` to the backend function.

## Deployment Steps

1.  **Push to GitHub:** Ensure your code is committed and pushed to a GitHub repository.
2.  **Log in to Netlify:** Go to [Netlify](https://www.netlify.com/) and "Add new site" -> "Import from existing project".
3.  **Select Repository:** Choose your GitHub repo.
4.  **Build Settings:**
    *   Netlify should detect the `netlify.toml` file automatically.
    *   **Build command:** `npm run build` (This should trigger the client build).
    *   **Publish directory:** `client/dist`
    *   **Functions directory:** `server`
5.  **Environment Variables:**
    *   If you add secrets later, add them in Netlify's "Site settings" -> "Environment variables".
6.  **Deploy:** Click "Deploy Site".

## Local Development

To run everything locally with the same behavior as Netlify:

1.  Install Netlify CLI: `npm install -g netlify-cli`
2.  Run: `netlify dev`
    *   This will start the frontend and the backend function together, proxying `/api` calls correctly.
