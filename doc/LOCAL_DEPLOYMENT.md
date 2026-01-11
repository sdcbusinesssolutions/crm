# Local Deployment Guide

This guide explains how to set up and run the WhatsApp Flow Builder application on your local machine.

## Prerequisites

*   **Node.js**: Version 18 or higher.
*   **Git**: Installed on your system.
*   **Supabase Account**: For the database and authentication.

## 1. Clone the Repository

```bash
git clone <your-repository-url>
cd wpcode
```

## 2. Database Setup (Supabase)

1.  Create a new project in [Supabase](https://supabase.com/).
2.  Go to the **SQL Editor** in your Supabase dashboard.
3.  Open the `schema.sql` file located in the root of this project.
4.  Copy the contents of `schema.sql` and paste them into the Supabase SQL Editor.
5.  Click **Run** to create the necessary tables and security policies.
6.  Go to **Project Settings -> API** and copy your:
    *   Project URL
    *   `anon` public key

## 3. Environment Configuration

### Server
1.  Navigate to the `server` directory: `cd server`
2.  Create a `.env` file (or rename `.env.example`):
    ```bash
    cp .env.example .env
    ```
3.  Edit `.env` and add your Supabase credentials:
    ```env
    SUPABASE_URL=your_supabase_project_url
    SUPABASE_KEY=your_supabase_anon_key
    PORT=5000
    ```

### Client
1.  Navigate to the `client` directory: `cd ../client`
2.  Create a `.env` file:
    ```env
    VITE_SUPABASE_URL=your_supabase_project_url
    VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
    ```
    *(Note: Ensure your client code uses these variables. If hardcoded, update `src/lib/supabaseClient.ts` or similar)*

## 4. Installation

Install dependencies for the root, client, and server. You can do this manually or use the root script.

**Manual Method:**
```bash
# Root (if any)
npm install

# Client
cd client
npm install

# Server
cd ../server
npm install
```

## 5. Running the Application

You need to run both the backend and frontend terminals.

**Terminal 1: Backend (Server)**
```bash
cd server
npm start
# Output: Server running on http://localhost:5000
```

**Terminal 2: Frontend (Client)**
```bash
cd client
npm run dev
# Output: Local: http://localhost:3000
```

Open your browser and navigate to `http://localhost:3000`.
