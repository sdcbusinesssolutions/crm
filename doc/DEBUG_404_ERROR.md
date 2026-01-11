# CSV Import 404 Error - Complete Debugging Guide

## What We've Added

### 1. Client-Side Logging (Browser Console)
Open F12 → Console tab and you'll see:
```
🚀 Starting bulk import... { count: 4 }
📡 Making request to /api/contacts/bulk
📋 Parsed contacts from CSV: 4
📄 Sample contact: { name: "B1", phone: "12", ... }
🚀 Calling bulkCreateContacts...
📥 Response received: { status: 404, statusText: "Not Found", url: "..." }
```

### 2. Server-Side Logging (Terminal)
In your server terminal, you'll see:
```
📨 POST /contacts/bulk
📦 Bulk import endpoint hit
📊 Received 4 contacts
✅ Successfully imported 4 contacts
```

### 3. Test Endpoint
Added a test endpoint to verify routing works:
`GET http://localhost:5000/api/contacts/bulk-test`

## Step-by-Step Debugging

### Step 1: Restart Backend Server
```bash
# Stop the server (Ctrl+C in terminal)
cd server
npm start
```

**Expected output:**
```
🚀 Server running on http://localhost:5000
```

### Step 2: Test the Server is Running
Open browser: `http://localhost:5000/api`

**Expected response:**
```json
{
  "message": "API is running.",
  "service": "WhatsApp Flow Builder API",
  "timestamp": "..."
}
```

### Step 3: Test the Bulk Endpoint Route
Open browser: `http://localhost:5000/api/contacts/bulk-test`

**If you see 401 Unauthorized:** ✅ Route exists, auth is working
**If you see 404 Not Found:** ❌ Route not registered
**If you see JSON response:** ✅ Route is accessible

### Step 4: Check Browser Console Logs
1. Open your app: `http://localhost:3000`
2. Press F12 → Console tab
3. Try to upload your CSV
4. Look for these logs:

**What you should see:**
```
🚀 Starting bulk import... { count: 4 }
contactService: Token found, making authenticated request
📡 Making request to /api/contacts/bulk
📋 Parsed contacts from CSV: 4
📄 Sample contact: { name: "B1", phone: "12", email: "A@A.COM", ... }
🚀 Calling bulkCreateContacts...
📥 Response received: { status: 200, ... }
✅ Bulk import successful
```

**If you see 404:**
```
📥 Response received: { status: 404, statusText: "Not Found", url: "http://localhost:3000/api/contacts/bulk" }
```

This means the request is going to port 3000 instead of 5000!

### Step 5: Check Server Terminal Logs
Look at your server terminal when you try to import.

**What you should see:**
```
📨 POST /contacts/bulk
📦 Bulk import endpoint hit
📊 Received 4 contacts
✅ Successfully imported 4 contacts
```

**If you DON'T see these logs:**
The request is not reaching the server at all!

## Common Issues & Solutions

### Issue 1: Request Not Reaching Server
**Symptom:** No logs in server terminal
**Cause:** Vite proxy not working or server not running
**Solution:**
1. Restart both servers:
   ```bash
   # Terminal 1 - Backend
   cd server
   npm start
   
   # Terminal 2 - Frontend
   cd client
   npm run dev
   ```
2. Make sure backend is on port 5000
3. Make sure frontend is on port 3000

### Issue 2: 401 Unauthorized
**Symptom:** Server logs show request but returns 401
**Cause:** Auth token expired or missing
**Solution:**
1. Sign out
2. Close browser tab
3. Clear browser cache (Ctrl+Shift+Delete)
4. Open new tab → `http://localhost:3000`
5. Sign in again

### Issue 3: 404 Not Found
**Symptom:** Request reaches server but route not found
**Cause:** Route not registered or wrong path
**Solution:**
1. Check server logs for: `📨 POST /contacts/bulk`
2. If you see it, the route exists
3. If not, restart server
4. Test the bulk-test endpoint

### Issue 4: CORS Error
**Symptom:** "CORS policy" error in console
**Cause:** Frontend and backend on different origins
**Solution:**
Already handled in server.js with CORS middleware

## What to Share for Help

If still not working, share:

1. **Browser Console Output:**
   - F12 → Console tab
   - Screenshot of all logs when you try to import

2. **Server Terminal Output:**
   - Everything shown when you start the server
   - Everything shown when you try to import

3. **Network Tab:**
   - F12 → Network tab
   - Try import
   - Click on `/bulk` request
   - Screenshot of:
     - Request URL
     - Request Headers
     - Response

4. **Test Endpoint Result:**
   - What you see at `http://localhost:5000/api/contacts/bulk-test`

## Expected Flow (When Working)

1. User selects CSV file
2. Browser console: `🚀 Starting bulk import...`
3. Browser console: `📡 Making request to /api/contacts/bulk`
4. Server terminal: `📨 POST /contacts/bulk`
5. Server terminal: `📦 Bulk import endpoint hit`
6. Server terminal: `📊 Received 4 contacts`
7. Server terminal: `✅ Successfully imported 4 contacts`
8. Browser console: `📥 Response received: { status: 200 }`
9. Browser console: `✅ Bulk import successful`
10. Green success toast appears
11. Contacts appear in list

## Quick Test

1. Restart backend: `cd server && npm start`
2. Open: `http://localhost:5000/api/contacts/bulk-test`
3. Should see: `{"message":"Bulk endpoint is accessible",...}`
4. If yes → Route works, issue is with auth or request
5. If no → Route not registered, check server logs for errors
