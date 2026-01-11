# CSV Import Troubleshooting Guide

## Issue: JSON Parse Error During CSV Import

### Error Message:
```
Import failed: Server returned an error. Please check:
1. Backend server is running
2. You are logged in
3. CSV format is correct

Technical details: JSON.parse: unexpected character at line 1 column 1
```

### Root Cause:
The server is returning an HTML error page instead of JSON, which usually means:
1. Authentication token is missing or expired
2. Server encountered an error before processing the request
3. CORS or network issue

### Solutions (Try in order):

#### Solution 1: Refresh Authentication
1. **Sign out** from the application
2. **Close the browser tab** completely
3. **Open a new tab** and navigate to `http://localhost:3000`
4. **Sign in again**
5. Try the CSV import again

#### Solution 2: Check Browser Console
1. Press **F12** to open Developer Tools
2. Go to the **Console** tab
3. Try importing the CSV again
4. Look for errors mentioning:
   - `401 Unauthorized` - Your session expired
   - `CORS` - Backend server issue
   - `Failed to fetch` - Network issue
5. Share the error details for further help

#### Solution 3: Verify Backend Server
1. Check the terminal where the backend is running
2. You should see: `🚀 Server running on http://localhost:5000`
3. Open `http://localhost:5000/api` in your browser
4. You should see: `{"message":"API is running."}`
5. If not, restart the backend:
   ```bash
   cd server
   npm start
   ```

#### Solution 4: Test with Sample CSV
1. Use the provided `sample_contacts.csv` file
2. Make sure it has these exact columns:
   ```
   Name,Phone,Email,Status,Tags,Groups,Source
   ```
3. Try importing just 1-2 rows first
4. If successful, try your full CSV

#### Solution 5: Clear Browser Cache
1. Press **Ctrl+Shift+Delete** (Windows) or **Cmd+Shift+Delete** (Mac)
2. Select "Cached images and files"
3. Click "Clear data"
4. Refresh the page and sign in again

### How to Create a Valid CSV:

**Minimum Required:**
```csv
Name,Phone
John Doe,+1234567890
Jane Smith,+1987654321
```

**With All Fields:**
```csv
Name,Phone,Email,Status,Tags,Groups,Source
John Doe,+1234567890,john@example.com,New,"VIP, Premium",Sales Team,Website
Jane Smith,+1987654321,jane@example.com,Contacted,Premium,Support Team,Referral
```

**Important Rules:**
- ✅ **Phone** column is REQUIRED
- ✅ **Name** column is REQUIRED
- ✅ Use quotes for comma-separated values (Tags, Groups)
- ✅ Save as UTF-8 encoding
- ❌ Don't use special characters in column names
- ❌ Don't leave Phone column empty

### Still Not Working?

If none of the above solutions work:

1. **Check Network Tab:**
   - F12 → Network tab
   - Try import again
   - Click on the `/api/contacts/bulk` request
   - Check the "Response" tab
   - Share what you see

2. **Check Server Logs:**
   - Look at the terminal running the backend
   - Check for any error messages
   - Share the error details

3. **Verify Environment:**
   - Backend: `http://localhost:5000`
   - Frontend: `http://localhost:3000`
   - Both should be running simultaneously

### Quick Test:
Try this minimal CSV to test if the system works:
```csv
Name,Phone
Test Contact,1234567890
```

If this works, the issue is with your CSV format. If it doesn't work, the issue is with authentication or the backend.
