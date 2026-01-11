# Netlify Deployment Guide

This project is configured to be deployed as a Monorepo on Netlify, hosting both the React frontend and the Express backend (as a Serverless Function).

## Prerequisites

*   **GitHub Repository**: Push your code to GitHub.
*   **Netlify Account**: Log in to [Netlify](https://www.netlify.com/).

## Configuration Files

*   **`netlify.toml`**: This file in the root directory handles the build configuration and redirects.
    *   It tells Netlify to build the client (`npm run build`).
    *   It tells Netlify where the functions live (`server` directory).
    *   It redirects `/api/*` requests to the backend function.

## Deployment Steps

1.  **Push to GitHub**
    *   Ensure all your changes, including `netlify.toml` and `schema.sql`, are committed and pushed.

2.  **Create New Site on Netlify**
    *   Log in to Netlify.
    *   Click **"Add new site"** -> **"Import from existing project"**.
    *   Select **GitHub**.
    *   Authorize Netlify and choose your repository.

3.  **Build Settings**
    *   Netlify should automatically detect the settings from `netlify.toml`.
    *   **Build Command**: `npm run build`
    *   **Publish Directory**: `client/dist`
    *   **Functions Directory**: `server`

4.  **Environment Variables**
    *   Click **"Show advanced"** or go to **Site Settings > Environment variables** after the site is created.
    *   Add the following variables (match your local `.env` values):
        *   `SUPABASE_URL`: Your Supabase Project URL
        *   `SUPABASE_KEY`: Your Supabase Anon Key
        *   `VITE_SUPABASE_URL`: Your Supabase Project URL (for frontend build)
        *   `VITE_SUPABASE_ANON_KEY`: Your Supabase Anon Key (for frontend build)

5.  **Deploy**
    *   Click **"Deploy Site"**.

## Troubleshooting

*   **404 on /api**: Check if the `netlify.toml` redirect rule is correct:
    ```toml
    [[redirects]]
      from = "/api/*"
      to = "/.netlify/functions/server/:splat"
      status = 200
      force = true
    ```
*   **Build Failures**: Check the "Deploy Log" in Netlify. Ensure `npm install` runs correctly for both client and server. The root `package.json` has a `postinstall` script that should handle this:
    ```json
    "postinstall": "cd client && npm install && cd ../server && npm install"
    ```
